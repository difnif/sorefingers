// ==========================================================================
// BranchInputDialog — 엣지 클릭 시 가지치기 입력
//
// 흐름:
//   1. 사용자가 엣지를 클릭 (InkEdge가 setBranchingEdge 호출)
//   2. 이 다이얼로그가 떠서 "이 연결에서 어떤 새 사유가 자라나는가" 입력 받음
//   3. 입력 → 임베딩 생성 → 양 끝 노드와의 simA / simB 계산
//   4. 부모 엣지 중점에서 simA-simB 비율로 기울어진 방향에 새 노드 위치 결정
//   5. 새 노드 생성 + branch 엣지 생성 (parentEdgeId, branchPoint 채워서)
//
// Part 3에서는 사용자 직접 작성만. AI 호출 없음.
// ==========================================================================
import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { embedText, cosineSimilarity } from '../lib/embedding.js';
import { createNode, createEdge } from '../lib/firestore.js';

const BRANCH_DISTANCE = 1.6;     // 중점에서 가지 노드까지 거리 (월드 단위)
const BRANCH_BIAS_AMOUNT = 0.5;  // simA-simB 차이를 얼마나 반영할지 (0~1)

export default function BranchInputDialog() {
  const branchingEdge = useStore(s => s.branchingEdge);
  const setBranchingEdge = useStore(s => s.setBranchingEdge);
  const activeProject = useStore(s => s.activeProject);
  const edges = useStore(s => s.edges);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!branchingEdge) return null;

  const { edge, sourceNode, targetNode, midPoint } = branchingEdge;

  function close() {
    setBranchingEdge(null);
    setText('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || busy) return;

    setBusy(true);
    try {
      // 임베딩 — 양 끝 노드와의 유사도 계산하기 위해
      const embedding = await embedText(content);

      // simA / simB 계산
      let simA = 0, simB = 0;
      if (embedding && sourceNode.embedding && targetNode.embedding) {
        simA = cosineSimilarity(embedding, sourceNode.embedding);
        simB = cosineSimilarity(embedding, targetNode.embedding);
      }

      // 가지의 방향 결정
      // 부모 엣지: source → target
      // 수직 방향: 부모를 90도 회전한 단위 벡터
      // simA > simB면 source 쪽으로 살짝 기울어진 방향
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const len = Math.hypot(dx, dy) || 1;

      // 부모 엣지 단위 벡터
      const ux = dx / len;
      const uy = dy / len;

      // 수직 단위 벡터 — 같은 부모 엣지에서 가지가 여러 개 나올 때 어느 쪽으로 갈지
      // 일단 위쪽으로 기본 (-uy, ux). 같은 중점에서 기존 가지가 있으면 반대편으로.
      const existingBranches = edges.filter(
        ed => ed.relation === 'branch' && ed.parentEdgeId === edge.id
      );
      const sideMultiplier = existingBranches.length % 2 === 0 ? 1 : -1;
      const px = -uy * sideMultiplier;
      const py = ux * sideMultiplier;

      // simA-simB 비율로 부모 방향 따라 기울임
      // bias > 0 → source 쪽으로
      const totalSim = simA + simB;
      const bias = totalSim > 0 ? (simA - simB) / totalSim : 0;
      // -1 ~ 1 범위. -1이면 target 끝, 1이면 source 끝, 0이면 정확히 수직.

      // 새 노드 위치
      // 중점 + 수직 * BRANCH_DISTANCE + 부모방향 * (-bias) * BRANCH_BIAS_AMOUNT
      // (부모 방향에서 -bias를 곱하면 simA가 클 때 source 쪽으로)
      const newX = midPoint.x + px * BRANCH_DISTANCE + (-ux * bias * BRANCH_BIAS_AMOUNT);
      const newY = midPoint.y + py * BRANCH_DISTANCE + (-uy * bias * BRANCH_BIAS_AMOUNT);

      // 노드 생성
      const newNodeId = await createNode(activeProject.id, {
        type: 'note',                // 사용자 직접 작성 노드 type
        content,
        x: newX,
        y: newY,
        embedding,
        branchedFromEdgeId: edge.id
      });

      // branch 엣지 생성 — source는 의미상 "부모 엣지", 시각은 중점 → 새 노드
      // Firestore에는 양 끝 노드도 기록 (관계 추적용)
      await createEdge(activeProject.id, {
        source: sourceNode.id,    // 부모 엣지의 source (관계 기록용)
        target: newNodeId,
        relation: 'branch',
        parentEdgeId: edge.id,
        branchPoint: midPoint,
        branchAffinity: { sourceAffinity: simA, targetAffinity: simB }
      });

      close();
    } catch (err) {
      console.error('[branch] 가지치기 실패:', err);
      alert('가지 만들기 중 오류. 콘솔 확인.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog branch-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-label">엣지에서 가지치기</div>

        <div className="branch-context">
          <div className="branch-side">
            <div className="dialog-existing-label">한쪽</div>
            <div className="dialog-existing-content">{truncate(sourceNode.content, 80)}</div>
          </div>
          <div className="branch-arrow">↔</div>
          <div className="branch-side">
            <div className="dialog-existing-label">다른 쪽</div>
            <div className="dialog-existing-content">{truncate(targetNode.content, 80)}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="branch-form">
          <textarea
            placeholder="이 연결에서 어떤 새 사유가 자라나는가?"
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            rows={3}
            maxLength={500}
            disabled={busy}
          />
          <div className="dialog-actions">
            <button type="submit" disabled={busy || !text.trim()}>
              {busy ? '…' : '가지 내기'}
            </button>
            <button type="button" onClick={close} className="dialog-cancel">
              취소
            </button>
          </div>
        </form>

        <div className="dialog-hint">
          가지는 엣지 중점에서 시작해, 양쪽 노드와의 유사도에 따라 방향이 정해집니다.
        </div>
      </div>
    </div>
  );
}

function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}
