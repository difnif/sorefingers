// ==========================================================================
// 임베딩 클라이언트 — Voyage AI voyage-3 (1024-d)
// 실제 API 호출은 /api/embed 서버리스 함수에서 (Voyage 키 보호).
// ==========================================================================

/**
 * 단일 텍스트 → 1024-d 임베딩 벡터.
 * @param {string} text
 * @returns {Promise<number[] | null>}
 */
export async function embedText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  try {
    const res = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed })
    });

    if (!res.ok) {
      const errMsg = await res.text();
      console.error('[embed] API 오류:', res.status, errMsg);
      return null;
    }

    const data = await res.json();
    return data.embedding || null;
  } catch (err) {
    console.error('[embed] 네트워크 오류:', err);
    return null;
  }
}

/**
 * 코사인 유사도 (-1 ~ 1, 동일하면 1).
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 후보 목록에서 가장 유사한 노드 1개 반환.
 * @param {number[]} queryEmbedding
 * @param {Array<{id, embedding, content}>} candidates
 * @param {number} threshold - 이 값 미만이면 null
 * @returns {{node, similarity} | null}
 */
export function findMostSimilar(queryEmbedding, candidates, threshold = 0.85) {
  if (!queryEmbedding || candidates.length === 0) return null;

  let best = null;
  let bestSim = -Infinity;

  for (const candidate of candidates) {
    const sim = cosineSimilarity(queryEmbedding, candidate.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      best = candidate;
    }
  }

  if (best && bestSim >= threshold) {
    return { node: best, similarity: bestSim };
  }
  return null;
}
