// ==========================================================================
// InkEdge — 엣지 시각화
// relation별:
//   qa       : 짙은 잉크, 실선
//   counter  : 짙은 잉크, 점선
//   similarity: 옅은 회색, 실선 (Part 3+)
//   contradiction: 진사색, 실선 (Part 3+)
//   user     : 짙은 잉크, 실선 (Part 3+)
// Part 2에서는 qa, counter만 활성.
// ==========================================================================
import { Line } from '@react-three/drei';

const RELATION_STYLES = {
  qa: {
    color: '#1C1A17',
    lineWidth: 1.0,
    dashed: false,
    opacity: 0.6
  },
  counter: {
    color: '#1C1A17',
    lineWidth: 1.0,
    dashed: true,
    dashSize: 0.15,
    gapSize: 0.1,
    opacity: 0.6
  },
  similarity: {
    color: '#5A554C',
    lineWidth: 0.8,
    dashed: false,
    opacity: 0.3
  },
  contradiction: {
    color: '#A03C2E',
    lineWidth: 1.0,
    dashed: false,
    opacity: 0.6
  },
  user: {
    color: '#1C1A17',
    lineWidth: 1.2,
    dashed: false,
    opacity: 0.7
  }
};

export default function InkEdge({ edge, source, target }) {
  const style = RELATION_STYLES[edge.relation] || RELATION_STYLES.qa;

  const points = [
    [source.x, source.y, source.z || 0],
    [target.x, target.y, target.z || 0]
  ];

  return (
    <Line
      points={points}
      color={style.color}
      lineWidth={style.lineWidth}
      dashed={style.dashed}
      dashSize={style.dashSize}
      gapSize={style.gapSize}
      transparent
      opacity={style.opacity}
    />
  );
}
