const https = require('https');

function callAPI(apiKey, body) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify(body);
    
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
}

module.exports = async function handler(req, res) {
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
    const { question, imageBase64, mediaType } = req.body || {};

    if (!question && !imageBase64) {
      return res.status(400).json({ error: 'question or imageBase64 is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    let finalQuestion = question;
    let extractedQuestion = null;

    // 이미지 질문인 경우 먼저 질문 내용 추출
    if (imageBase64) {
      const extractResult = await callAPI(apiKey, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: '이 이미지에서 학생이 질문하는 내용을 추출해주세요. 손글씨로 쓴 질문이 있다면 그 내용을 읽어주세요. 지문이나 작품이 있다면 무엇에 대한 질문인지 파악해주세요.'
              }
            ]
          }
        ]
      });

      if (extractResult.status !== 200) {
        const errorData = JSON.parse(extractResult.data);
        throw new Error(errorData.error?.message || '이미지 질문 추출 실패');
      }

      const extractData = JSON.parse(extractResult.data);
      extractedQuestion = extractData.content[0].text;
      finalQuestion = extractedQuestion;
    }

    // 개념/지문 질문에 대한 답변 생성
    const systemPrompt = `당신은 국어 과목 전문 선생님입니다.
학생이 문법 개념, 문학 작품 해설, 지문 해석 등에 대해 질문하면 친절하고 이해하기 쉽게 설명해주세요.

답변 원칙:
1. 학생 수준에 맞게 쉽게 설명하세요.
2. 개념을 설명할 때는 예시를 들어주세요.
3. 문학 작품에 대해서는 주제, 화자, 표현 기법 등을 설명해주세요.
4. 지문 해석을 요청받으면 핵심 내용과 구조를 분석해주세요.
5. 필요하면 관련 개념도 함께 설명해주세요.`;

    const result = await callAPI(apiKey, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: finalQuestion
        }
      ]
    });

    if (result.status !== 200) {
      const errorData = JSON.parse(result.data);
      return res.status(result.status).json({ 
        error: errorData.error?.message || 'API 호출 실패' 
      });
    }

    const data = JSON.parse(result.data);
    const answer = data.content[0].text;

    return res.status(200).json({ 
      answer,
      extractedQuestion: extractedQuestion
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
};
