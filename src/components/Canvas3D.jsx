// ==========================================================================
// Canvas3D — R3F 캔버스 (Part 3, context lost 복구 추가)
//
// 추가:
//   - WebGL context 죽으면 자동 복구 시도 (WEBGL_lose_context 확장)
//   - 컨텍스트 죽었을 때 콘솔 경고
// ==========================================================================
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import CameraController from './CameraController.jsx';
import PhysicsWorld from './PhysicsWorld.jsx';
import InkNode from './InkNode.jsx';
import InkEdge from './InkEdge.jsx';

export default function Canvas3D({ onPhysicsReady }) {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);

  const nodeIndex = useMemo(
    () => new Map(nodes.map(n => [n.id, n])),
    [nodes]
  );

  const branchCountByEdge = useMemo(() => {
    const counts = new Map();
    for (const e of edges) {
      if (e.relation === 'branch' && e.parentEdgeId) {
        counts.set(e.parentEdgeId, (counts.get(e.parentEdgeId) || 0) + 1);
      }
    }
    return counts;
  }, [edges]);

  function handleCanvasCreated({ gl, scene }) {
    // WebGL context lost 복구
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
      console.warn('[canvas] WebGL context lost. 복구 시도...');
      event.preventDefault();
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      console.log('[canvas] WebGL context 복구됨');
    }, false);
  }

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 50], zoom: 40, near: 0.1, far: 1000 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
      }}
      style={{ background: '#F4F1EA' }}
      onCreated={handleCanvasCreated}
    >
      <ambientLight intensity={0.9} />

      <CameraController />
      <PhysicsWorld onReady={onPhysicsReady} />

      {edges.map(edge => {
        const source = edge.relation === 'branch'
          ? null
          : nodeIndex.get(edge.source);
        const target = nodeIndex.get(edge.target);
        if (!target) return null;
        if (edge.relation !== 'branch' && !source) return null;

        return (
          <InkEdge
            key={edge.id}
            edge={edge}
            source={source || { x: 0, y: 0, z: 0 }}
            target={target}
            branchCount={branchCountByEdge.get(edge.id) || 0}
          />
        );
      })}

      {nodes.map(node => (
        <InkNode key={node.id} node={node} />
      ))}
    </Canvas>
  );
}
