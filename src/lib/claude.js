// ==========================================================================
// Claude 클라이언트
// ==========================================================================

/**
 * 질문 → 답변 + 반문 1~3
 */
export async function askClaude(question, relatedNodes = []) {
  const trimmed = (question || '').trim();
  if (!trimmed) return null;

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: trimmed,
        context: relatedNodes.slice(0, 10)
      })
    });

    if (!res.ok) {
      const errMsg = await res.text();
      console.error('[ask] API 오류:', res.status, errMsg);
      return null;
    }

    const data = await res.json();
    return {
      answer: data.answer || '',
      counters: Array.isArray(data.counters) ? data.counters : []
    };
  } catch (err) {
    console.error('[ask] 네트워크 오류:', err);
    return null;
  }
}

/**
 * 노드 N개 사이의 모순/대립 관계 찾기.
 * @param {Array<{id, type, content}>} nodes - 분석 대상
 * @returns {Promise<Array<{sourceId, targetId, reasoning}> | null>}
 */
export async function findContradictions(nodes) {
  if (!nodes || nodes.length < 2) return [];

  try {
    const res = await fetch('/api/contradiction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: nodes.slice(0, 20) })
    });

    if (!res.ok) {
      const errMsg = await res.text();
      console.error('[contradiction] API 오류:', res.status, errMsg);
      return null;
    }

    const data = await res.json();
    return Array.isArray(data.contradictions) ? data.contradictions : [];
  } catch (err) {
    console.error('[contradiction] 네트워크 오류:', err);
    return null;
  }
}
