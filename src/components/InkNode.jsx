// ==========================================================================
// InkNode — 노드 시각화
// type별 차별화:
//   question : 검정 잉크, 큰 점, Serif
//   answer   : 진회색, 중간 점, Serif (작게)
//   counter  : 연회색, 작은 점, Italic
//   debug    : 그냥 점
// ==========================================================================
import { Html } from '@react-three/drei';

const STYLES = {
  question: {
    color: '#1C1A17',
    radius: 0.16,
    labelColor: '#1C1A17',
    fontSize: '13px',
    fontStyle: 'normal',
    fontWeight: '500',
    opacity: 1.0
  },
  answer: {
    color: '#1C1A17',
    radius: 0.13,
    labelColor: '#5A554C',
    fontSize: '11px',
    fontStyle: 'normal',
    fontWeight: '400',
    opacity: 0.7
  },
  counter: {
    color: '#1C1A17',
    radius: 0.10,
    labelColor: '#8C857A',
    fontSize: '10px',
    fontStyle: 'italic',
    fontWeight: '400',
    opacity: 0.45
  },
  debug: {
    color: '#1C1A17',
    radius: 0.12,
    labelColor: '#BDB6A8',
    fontSize: '10px',
    fontStyle: 'normal',
    fontWeight: '400',
    opacity: 0.5
  }
};

export default function InkNode({ node }) {
  const style = STYLES[node.type] || STYLES.debug;

  return (
    <group position={[node.x, node.y, node.z || 0]}>
      <mesh>
        <circleGeometry args={[style.radius, 32]} />
        <meshBasicMaterial
          color={style.color}
          transparent
          opacity={style.opacity}
        />
      </mesh>

      {node.content && (
        <Html
          position={[style.radius + 0.08, 0, 0]}
          style={{
            color: style.labelColor,
            fontFamily: '"Noto Serif KR", serif',
            fontSize: style.fontSize,
            fontStyle: style.fontStyle,
            fontWeight: style.fontWeight,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: 'translateY(-50%)',
            maxWidth: '320px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            userSelect: 'none'
          }}
        >
          {truncate(node.content, 60)}
        </Html>
      )}
    </group>
  );
}

function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}
