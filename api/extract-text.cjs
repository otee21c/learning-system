const https = require('https');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mediaType, bookName, chapter } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const requestBody = JSON.stringify({
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
4. 핵심 개념이나 용어 정리`
            }
          ]
        }
      ]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const apiResponse = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          resolve({ status: response.statusCode, data: data });
        });
      });
      request.on('error', reject);
      request.write(requestBody);
      request.end();
    });

    if (apiResponse.status !== 200) {
      const errorData = JSON.parse(apiResponse.data);
      return res.status(apiResponse.status).json({ 
        error: errorData.error?.message || 'API 호출 실패' 
      });
    }

    const data = JSON.parse(apiResponse.data);
    const extractedText = data.content[0].text;

    return res.status(200).json({ extractedText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
};
