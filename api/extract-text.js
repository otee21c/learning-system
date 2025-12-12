export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mediaType, bookName, chapter } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    // 환경 변수에서 API 키 가져오기
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('API key not found');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Anthropic API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/png',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: `이 학습 자료의 내용을 정확하게 텍스트로 추출해주세요.

교재명: ${bookName || '미지정'}
${chapter ? `단원: ${chapter}` : ''}

다음 형식으로 정리해주세요:
1. 본문 내용 (지문, 설명 등)
2. 문제가 있다면 문제 번호와 내용
3. 보기/선택지가 있다면 번호와 함께
4. 핵심 개념이나 용어 정리

가능한 원문 그대로 추출하되, 학생이 질문할 때 참고할 수 있도록 구조화해주세요.`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || 'API 호출 실패' 
      });
    }

    const data = await response.json();
    const extractedText = data.content[0].text;

    return res.status(200).json({ extractedText });

  } catch (error) {
    console.error('Extract text error:', error);
    return res.status(500).json({ error: error.message });
  }
}
