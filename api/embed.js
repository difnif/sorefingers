// ==========================================================================
// /api/embed — Voyage AI 임베딩 프록시
// 클라이언트에서 직접 호출하면 VOYAGE_API_KEY가 노출되므로 서버 경유.
//
// Voyage REST API: https://docs.voyageai.com/reference/embeddings-api
// ==========================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'VOYAGE_API_KEY not configured' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const voyageRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'voyage-3',
        input_type: 'document'   // 'query'와 분리 가능, 일단 통일
      })
    });

    if (!voyageRes.ok) {
      const err = await voyageRes.text();
      console.error('[api/embed] Voyage error:', voyageRes.status, err);
      return res.status(voyageRes.status).json({ error: err });
    }

    const data = await voyageRes.json();
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      return res.status(500).json({ error: 'Unexpected response shape' });
    }

    return res.status(200).json({ embedding });
  } catch (err) {
    console.error('[api/embed] Exception:', err);
    return res.status(500).json({ error: String(err) });
  }
}
