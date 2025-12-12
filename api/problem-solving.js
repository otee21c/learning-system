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

// URL에서 이미지를 다운로드하여 base64로 변환
function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImageAsBase64(response.headers.location).then(resolve).catch(reject);
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const contentType = response.headers['content-type'] || 'image/png';
        resolve({ base64, contentType });
      });
      response.on('error', reject);
    }).on('error', reject);
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
    const { question, material, imageBase64, mediaType } = req.body || {};

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
                text: '이 이미지에서 학생이 질문하는 내용을 추출해주세요. 손글씨로 쓴 질문이 있다면 그 내용을 읽어주세요. 문제 번호가 있다면 함께 파악해주세요.'
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

    // 참고 이미지가 있으면 다운로드해서 포함
    const imageContents = [];
    if (material?.imageUrls && material.imageUrls.length > 0) {
      for (const img of material.imageUrls) {
        try {
          const downloaded = await downloadImageAsBase64(img.url);
          imageContents.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: downloaded.contentType,
              data: downloaded.base64
            }
          });
        } catch (e) {
          console.error('이미지 다운로드 실패:', e);
        }
      }
    }

    // 문제집 기반 답변 생성
    const systemPrompt = `당신은 국어 과목 전문 선생님입니다.
학생이 문제집의 문제에 대해 질문하면 제공된 교재 내용을 바탕으로 친절하고 이해하기 쉽게 설명해주세요.

[교재 정보]
- 교재명: ${material?.bookName || '미지정'}
- 단원: ${material?.chapter || '전체'}
- 학년: ${material?.grade || '미지정'}
- 과정: ${material?.course || '미지정'}

[교재 내용]
${material?.textContent || '내용 없음'}

---

답변 원칙:
1. 먼저 교재 내용에서 관련 부분을 찾아 설명하세요.
2. 문제의 정답뿐 아니라 왜 그런지 이유를 설명해주세요.
3. 학생이 비슷한 문제도 풀 수 있도록 풀이 방법을 알려주세요.
4. 필요하면 관련 개념도 함께 설명해주세요.
5. 학생 수준에 맞게 쉽게 설명하세요.`;

    // 메시지 구성
    const userContent = [];
    
    // 참고 이미지가 있으면 먼저 추가
    if (imageContents.length > 0) {
      userContent.push(...imageContents);
      userContent.push({
        type: 'text',
        text: `[위 이미지는 교재의 참고 자료입니다]\n\n학생 질문: ${finalQuestion}`
      });
    } else {
      userContent.push({
        type: 'text',
        text: finalQuestion
      });
    }

    const result = await callAPI(apiKey, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent.length === 1 ? userContent[0].text : userContent
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
