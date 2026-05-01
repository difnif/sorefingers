// ==========================================================================
// InkNode — 노드 시각화
// Part 1: 단순 잉크 점. type별 색은 Part 2부터 차별화.
// ==========================================================================
const INK = '#1C1A17';

export default function InkNode({ node }) {
  return (
    <mesh position={[node.x, node.y, node.z || 0]}>
      <circleGeometry args={[0.12, 32]} />
      <meshBasicMaterial color={INK} />
    </mesh>
  );
}
