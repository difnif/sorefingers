// ==========================================================================
// Claude 클라이언트 — Anthropic Claude Sonnet 4
// 실제 API 호출은 /api/ask 서버리스 함수에서 (Anthropic 키 보호).
// ==========================================================================

/**
 * 질문에 대한 답변 + 반문 생성.
 * @param {string} question
 * @param {Array<{type, content}>} relatedNodes - 컨텍스트로 줄 인근 노드들
 * @returns {Promise<{answer: string, counters: string[]} | null>}
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
        context: relatedNodes.slice(0, 10)  // 너무 길어지지 않도록 제한
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
