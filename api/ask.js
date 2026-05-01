// ==========================================================================
// /api/ask — Anthropic Claude 호출 프록시
// 사용자 질문 → 답변 1개 + 반문 1~3개 (JSON 구조화).
// ==========================================================================

import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `당신은 sorefingers라는 사유 도구의 일부입니다. 사용자의 질문에 답하고, 그 답이 깔고 있는 전제를 흔드는 반문 1~3개를 제시합니다.

원칙:
- 답변은 결론을 단정하지 않고, 질문이 깔고 있는 언어와 전제를 먼저 짚습니다.
- 반문은 사용자의 질문이나 답변 자체를 다른 각도에서 다시 묻는 것입니다. 예시 질문이 아니라 진짜 물음표가 붙는 문장으로.
- 사용자가 이미 만든 노드들(context)이 있다면, 중복되는 답을 피하고 그것들과의 관계를 의식하세요.
- 답변은 1~4문장. 반문은 각 1문장.
- 한국어로 응답합니다.

응답은 다음 JSON 형식만 반환합니다 (다른 설명 없이):
{
  "answer": "답변 본문",
  "counters": ["반문 1", "반문 2", "반문 3"]
}

counters는 1~3개. 더 많거나 적게 만들지 마세요.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { question, context = [] } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const client = new Anthropic({ apiKey });

    // context를 사용자 메시지에 자연스럽게 녹여서 전달
    const contextStr = context.length > 0
      ? '관련 노드들 (참고):\n' + context.map(n => `- [${n.type}] ${n.content}`).join('\n') + '\n\n'
      : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: contextStr + '질문: ' + question }
      ]
    });

    // 텍스트 블록만 합쳐서 추출
    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim();

    // JSON 파싱 — Claude가 가끔 ```json``` 펜스를 두르기도 함
    const cleaned = text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[api/ask] JSON 파싱 실패. 원문:', text);
      return res.status(500).json({
        error: 'Claude가 JSON 형식으로 응답하지 않음',
        raw: text
      });
    }

    return res.status(200).json({
      answer: parsed.answer || '',
      counters: Array.isArray(parsed.counters) ? parsed.counters.slice(0, 3) : []
    });
  } catch (err) {
    console.error('[api/ask] Exception:', err);
    return res.status(500).json({ error: String(err) });
  }
}
