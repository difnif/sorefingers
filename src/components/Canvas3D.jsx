// ==========================================================================
// Canvas3D — R3F 캔버스
// - 카메라: (0, 0, 50) at lookAt (0, 0, 0)
// - 회전 잠금 (Part 1-4), 팬 + 줌만 허용
// - Rapier 물리계 초기화 (gravity = 0)
// - 노드를 잉크 점으로 렌더링
// ==========================================================================
import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore.js';
import CameraController from './CameraController.jsx';
import PhysicsWorld from './PhysicsWorld.jsx';
import InkNode from './InkNode.jsx';

export default function Canvas3D({ onPhysicsReady }) {
  const nodes = useStore(s => s.nodes);

  return (
    <Canvas
      orthographic
      camera={{
        position: [0, 0, 50],
        zoom: 40,
        near: 0.1,
        far: 1000
      }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#F4F1EA' }}
    >
      {/* 종이 질감의 약한 조명 */}
      <ambientLight intensity={0.9} />

      <CameraController />
      <PhysicsWorld onReady={onPhysicsReady} />

      {/* 노드 렌더링 */}
      {nodes.map(node => (
        <InkNode key={node.id} node={node} />
      ))}
    </Canvas>
  );
}
