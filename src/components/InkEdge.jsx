// ==========================================================================
// InkEdge — 엣지 시각화 (Part 3, geometry leak fix)
//
// 핵심 수정:
//   - useMemo로 만든 BufferGeometry는 deps 바뀔 때마다 새 인스턴스 생성됨
//   - 이전 인스턴스의 GPU 메모리(VRAM)는 명시적 .dispose() 없이는 안 풀림
//   - useEffect cleanup으로 dispose 호출
// ==========================================================================
import { Line } from '@react-three/drei';
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore.js';

const RELATION_STYLES = {
  qa:            { color: '#1C1A17', baseWidth: 0.025, dashed: false, opacity: 0.6, branchable: true },
  counter:       { color: '#1C1A17', baseWidth: 0.020, dashed: true,  opacity: 0.6, branchable: true,
                   dashSize: 0.15, gapSize: 0.10 },
  similarity:    { color: '#5A554C', baseWidth: 0.018, dashed: false, opacity: 0.35, branchable: true },
  contradiction: { color: '#A03C2E', baseWidth: 0.025, dashed: false, opacity: 0.6, branchable: true },
  user:          { color: '#1C1A17', baseWidth: 0.030, dashed: false, opacity: 0.7, branchable: true },
  branch:        { color: '#1C1A17', baseWidth: 0.022, dashed: false, opacity: 0.55, branchable: false }
};

const SEGMENTS = 24;

export default function InkEdge({ edge, source, target, branchCount = 0 }) {
  const style = RELATION_STYLES[edge.relation] || RELATION_STYLES.qa;
  const setBranchingEdge = useStore(s => s.setBranchingEdge);

  // branch 엣지면 시작점은 부모 엣지의 중점
  const startVec = useMemo(() => {
    if (edge.relation === 'branch' && edge.branchPoint) {
      return new THREE.Vector3(edge.branchPoint.x, edge.branchPoint.y, edge.branchPoint.z || 0);
    }
    return new THREE.Vector3(source.x, source.y, source.z || 0);
  }, [edge.relation, edge.branchPoint, source.x, source.y, source.z]);

  const endVec = useMemo(
    () => new THREE.Vector3(target.x, target.y, target.z || 0),
    [target.x, target.y, target.z]
  );

  const midBoost = branchCount > 0 ? Math.log(1 + branchCount) * 0.6 * style.baseWidth : 0;
  const useTaperedMesh = midBoost > 0 && !style.dashed;

  // Tapered geometry — useMemo로 만들고 useEffect에서 dispose
  const taperedGeo = useMemo(() => {
    if (!useTaperedMesh) return null;
    return buildTaperedGeometry(startVec, endVec, style.baseWidth, midBoost, SEGMENTS);
  }, [useTaperedMesh, startVec, endVec, style.baseWidth, midBoost]);

  useEffect(() => {
    return () => {
      if (taperedGeo) taperedGeo.dispose();
    };
  }, [taperedGeo]);

  // Click hitbox geometry — 같은 패턴
  const hitboxGeo = useMemo(() => {
    return buildHitboxGeometry(startVec, endVec, 0.18);
  }, [startVec, endVec]);

  useEffect(() => {
    return () => {
      if (hitboxGeo) hitboxGeo.dispose();
    };
  }, [hitboxGeo]);

  function handleEdgeClick(e) {
    if (!style.branchable) return;
    e.stopPropagation();
    const mid = new THREE.Vector3()
      .addVectors(startVec, endVec)
      .multiplyScalar(0.5);
    setBranchingEdge({
      edge,
      sourceNode: source,
      targetNode: target,
      midPoint: { x: mid.x, y: mid.y, z: mid.z }
    });
  }

  return (
    <group>
      {!useTaperedMesh && (
        <Line
          points={[startVec.toArray(), endVec.toArray()]}
          color={style.color}
          lineWidth={Math.max(1, style.baseWidth * 60)}
          dashed={style.dashed}
          dashSize={style.dashSize}
          gapSize={style.gapSize}
          transparent
          opacity={style.opacity}
        />
      )}

      {useTaperedMesh && taperedGeo && (
        <mesh geometry={taperedGeo}>
          <meshBasicMaterial color={style.color} transparent opacity={style.opacity} side={THREE.DoubleSide} />
        </mesh>
      )}

      {style.branchable && hitboxGeo && (
        <mesh geometry={hitboxGeo} onClick={handleEdgeClick}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// --------------------------------------------------------------------------
// 헬퍼: tapered strip
// --------------------------------------------------------------------------
function buildTaperedGeometry(start, end, baseWidth, midBoost, segments) {
  const positions = [];
  const indices = [];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return new THREE.BufferGeometry();

  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const taper = 1 - 2 * Math.abs(t - 0.5);
    const w = baseWidth + midBoost * taper;

    const cx = start.x + dx * t;
    const cy = start.y + dy * t;

    positions.push(cx + nx * w / 2, cy + ny * w / 2, 0);
    positions.push(cx - nx * w / 2, cy - ny * w / 2, 0);

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

// --------------------------------------------------------------------------
// 헬퍼: click hitbox
// --------------------------------------------------------------------------
function buildHitboxGeometry(start, end, thickness) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;

  const nx = -dy / len * thickness / 2;
  const ny = dx / len * thickness / 2;

  const positions = new Float32Array([
    start.x + nx, start.y + ny, 0,
    start.x - nx, start.y - ny, 0,
    end.x + nx,   end.y + ny,   0,
    end.x - nx,   end.y - ny,   0
  ]);
  const indices = [0, 1, 2, 1, 3, 2];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}
