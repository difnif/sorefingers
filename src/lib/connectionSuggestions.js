// ==========================================================================
// 자동 연결 제안 로직 — Part 3
//
// 새 노드의 임베딩이 들어왔을 때:
//   - 0.85 이상 → 자동으로 similarity 엣지 생성
//   - 0.65 ~ 0.85 → suggestions 컬렉션에 pending으로
//   - 0.65 미만 → 무시
//
// contradiction은 임베딩으로 판단 불가. 사용자가 [모순 찾기] 버튼 누를 때
// Claude로 별도 분석 (api/contradiction).
// ==========================================================================
import { cosineSimilarity } from './embedding.js';
import { createEdge, createSuggestion } from './firestore.js';

const AUTO_CONNECT_THRESHOLD = 0.85;
const SUGGEST_THRESHOLD = 0.65;

// 같은 부모(parentId)를 공유하거나, 이미 직접 연결된 노드끼리는 제안 안 함
function alreadyConnected(nodeA, nodeB, edges) {
  return edges.some(e =>
    (e.source === nodeA.id && e.target === nodeB.id) ||
    (e.source === nodeB.id && e.target === nodeA.id)
  );
}

/**
 * 새 노드를 기존 노드들과 비교해서 연결을 만들거나 제안한다.
 *
 * @param {string} projectId
 * @param {object} newNode - 방금 생성된 노드 (id, embedding 필수)
 * @param {Array} candidateNodes - 비교할 기존 노드들 (임베딩 가진 것만)
 * @param {Array} existingEdges - 이미 있는 엣지들 (중복 방지용)
 * @returns {{autoConnected: number, suggested: number}}
 */
export async function processNewNodeConnections(
  projectId,
  newNode,
  candidateNodes,
  existingEdges
) {
  if (!newNode.embedding || !Array.isArray(newNode.embedding)) {
    return { autoConnected: 0, suggested: 0 };
  }

  let autoConnected = 0;
  let suggested = 0;

  for (const candidate of candidateNodes) {
    // 자기 자신 스킵
    if (candidate.id === newNode.id) continue;

    // 임베딩 없는 노드 스킵
    if (!candidate.embedding || !Array.isArray(candidate.embedding)) continue;

    // 이미 연결돼 있으면 스킵
    if (alreadyConnected(newNode, candidate, existingEdges)) continue;

    const sim = cosineSimilarity(newNode.embedding, candidate.embedding);

    if (sim >= AUTO_CONNECT_THRESHOLD) {
      // 자동 연결 — similarity 엣지 즉시 생성
      try {
        await createEdge(projectId, {
          source: newNode.id,
          target: candidate.id,
          relation: 'similarity',
          weight: sim,
          suggestionConfidence: sim,
          status: 'active'
        });
        autoConnected++;
      } catch (err) {
        console.error('[connections] auto-connect 실패:', err);
      }
    } else if (sim >= SUGGEST_THRESHOLD) {
      // 제안만 — suggestions 컬렉션에
      try {
        const suggestionId = await createSuggestion(projectId, {
          type: 'similarity',
          source: newNode.id,
          target: candidate.id,
          confidence: sim
        });
        if (suggestionId) suggested++;     // null이면 중복이라 스킵된 것
      } catch (err) {
        console.error('[connections] suggest 실패:', err);
      }
    }
    // 0.65 미만 무시
  }

  return { autoConnected, suggested };
}
