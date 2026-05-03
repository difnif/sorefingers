// ==========================================================================
// /api/contradiction — Anthropic Claude로 노드들 간 모순 분석
// 사용자가 [모순 찾기] 명시 트리거 시 호출 (자동 호출 X — 비용 발생)
// ==========================================================================

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `당신은 sorefingers라는 사유 도구의 모순 분석가입니다. 사용자가 만든 노드들을 받으면, 그중 서로 모순되거나 긴장 관계에 있는 쌍을 찾아 보고합니다.

원칙:
- 단순한 의견 차이가 아니라, 한쪽이 참이면 다른 쪽이 거짓이 되는 명제적 모순, 또는 사용자가 양립시키기 어려운 전제 충돌을 찾으세요.
- 명백한 모순이 없으면 빈 배열을 반환합니다. 억지로 만들지 마세요.
- 반환은 최대 5쌍.
- reasoning은 1~2문장으로 간결하게 한국어로.

응답은 다음 JSON 형식만 반환합니다:
{
  "contradictions": [
    { "sourceId": "노드_id_1", "targetId": "노드_id_2", "reasoning": "왜 모순인지" }
  ]
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { nodes } = req.body || {};
  if (!Array.isArray(nodes) || nodes.length < 2) {
    return res.status(400).json({ error: 'nodes (length >= 2) is required' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const nodesStr = nodes
      .map(n => `[${n.id}] (${n.type}) ${n.content}`)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: '다음 노드들에서 모순을 찾아주세요:\n\n' + nodesStr }
      ]
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    const cleaned = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[api/contradiction] JSON 파싱 실패. 원문:', text);
      return res.status(500).json({
        error: 'Claude가 JSON 형식으로 응답하지 않음',
        raw: text
      });
    }

    return res.status(200).json({
      contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions.slice(0, 5) : []
    });
  } catch (err) {
    console.error('[api/contradiction] Exception:', err);
    return res.status(500).json({ error: String(err) });
  }
}
