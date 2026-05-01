// ==========================================================================
// Canvas3D — R3F 캔버스
// 노드 + 엣지를 그리고, 카메라 제스처와 물리계를 마운트한다.
// ==========================================================================
import { Canvas } from '@react-three/fiber';
import { useStore } from '../store/useStore.js';
import CameraController from './CameraController.jsx';
import PhysicsWorld from './PhysicsWorld.jsx';
import InkNode from './InkNode.jsx';
import InkEdge from './InkEdge.jsx';

export default function Canvas3D({ onPhysicsReady }) {
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);

  // 빠른 조회용 인덱스
  const nodeIndex = new Map(nodes.map(n => [n.id, n]));

  return (
    <Canvas
      orthographic
      camera={{
        position: [0, 0, 50],
        zoom: 40,
        near: 0.1,
        far: 1000
      }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
      style={{ background: '#F4F1EA' }}
    >
      <ambientLight intensity={0.9} />

      <CameraController />
      <PhysicsWorld onReady={onPhysicsReady} />

      {/* 엣지가 노드보다 먼저 — 점이 선 위에 오도록 */}
      {edges.map(edge => {
        const source = nodeIndex.get(edge.source);
        const target = nodeIndex.get(edge.target);
        if (!source || !target) return null;
        return <InkEdge key={edge.id} edge={edge} source={source} target={target} />;
      })}

      {nodes.map(node => (
        <InkNode key={node.id} node={node} />
      ))}
    </Canvas>
  );
}
