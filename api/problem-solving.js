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

// URL에서 파일을 다운로드하여 base64로 변환 (이미지, PDF 모두 지원)
function downloadFileAsBase64(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    
    protocol.get(url, (response) => {
      // 리다이렉트 처리
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFileAsBase64(response.headers.location).then(resolve).catch(reject);
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const contentType = response.headers['content-type'] || 'application/octet-stream';
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
    const { question, material, imageBase64, mediaType, images } = req.body || {};

    if (!question && !imageBase64 && (!images || images.length === 0)) {
      return res.status(400).json({ error: 'question or images is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    let finalQuestion = question;
    let extractedQuestion = null;

    // 여러 이미지 질문 처리
    const questionImages = [];
    if (images && images.length > 0) {
      for (const img of images) {
        questionImages.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType || 'image/jpeg',
            data: img.base64
          }
        });
      }
    } else if (imageBase64) {
      // 단일 이미지 (하위 호환성)
      questionImages.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType || 'image/jpeg',
          data: imageBase64
        }
      });
    }

    // 이미지 질문인 경우 먼저 질문 내용 추출
    if (questionImages.length > 0) {
      const extractContent = [
        ...questionImages,
        {
          type: 'text',
          text: '이 이미지에서 학생이 질문하는 내용을 추출해주세요. 손글씨로 쓴 질문이 있다면 그 내용을 읽어주세요. 문제 번호가 있다면 함께 파악해주세요. 여러 이미지가 있다면 전체를 종합해서 질문 내용을 파악해주세요.'
        }
      ];

      const extractResult = await callAPI(apiKey, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: extractContent
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

    // 교재 자료 준비 (PDF 또는 이미지)
    const materialContents = [];
    
    // PDF가 있으면 다운로드해서 document로 추가
    if (material?.pdfUrl) {
      try {
        console.log('PDF 다운로드 시작:', material.pdfUrl);
        const downloaded = await downloadFileAsBase64(material.pdfUrl);
        console.log('PDF 다운로드 완료, 크기:', downloaded.base64.length);
        
        materialContents.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: downloaded.base64
          }
        });
      } catch (e) {
        console.error('PDF 다운로드 실패:', e.message);
        // PDF 실패 시 텍스트 내용으로 대체
      }
    }
    
    // 참고 이미지가 있으면 다운로드해서 포함
    if (material?.imageUrls && material.imageUrls.length > 0) {
      for (const img of material.imageUrls) {
        try {
          const downloaded = await downloadFileAsBase64(img.url);
          materialContents.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: downloaded.contentType,
              data: downloaded.base64
            }
          });
        } catch (e) {
          console.error('이미지 다운로드 실패:', e.message);
        }
      }
    }

    // 시스템 프롬프트 구성
    let systemPrompt = `당신은 국어 과목 전문 선생님입니다.
학생이 문제집의 문제에 대해 질문하면 제공된 교재 내용을 바탕으로 친절하고 이해하기 쉽게 설명해주세요.

[교재 정보]
- 교재명: ${material?.bookName || '미지정'}
- 단원: ${material?.chapter || '전체'}
- 학년: ${material?.grade || '미지정'}
- 과정: ${material?.course || '미지정'}
`;

    // 텍스트 내용이 있으면 시스템 프롬프트에 추가
    if (material?.textContent) {
      systemPrompt += `
[교재 텍스트 내용]
${material.textContent}
`;
    }

    systemPrompt += `
---

답변 원칙:
1. 제공된 교재 자료(PDF, 이미지, 텍스트)를 참고하여 답변하세요.
2. 문제의 정답뿐 아니라 왜 그런지 이유를 설명해주세요.
3. 학생이 비슷한 문제도 풀 수 있도록 풀이 방법을 알려주세요.
4. 필요하면 관련 개념도 함께 설명해주세요.
5. 학생 수준에 맞게 쉽게 설명하세요.`;

    // 메시지 구성
    const userContent = [];
    
    // 교재 자료(PDF, 이미지)가 있으면 먼저 추가
    if (materialContents.length > 0) {
      userContent.push(...materialContents);
      userContent.push({
        type: 'text',
        text: `[위 자료는 교재 내용입니다. 이 내용을 참고하여 학생의 질문에 답변해주세요.]\n\n학생 질문: ${finalQuestion}`
      });
    } else {
      userContent.push({
        type: 'text',
        text: finalQuestion
      });
    }

    console.log('API 호출 시작, 컨텐츠 수:', userContent.length);

    const result = await callAPI(apiKey, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent.length === 1 && userContent[0].type === 'text' 
            ? userContent[0].text 
            : userContent
        }
      ]
    });

    console.log('API 응답 상태:', result.status);

    if (result.status !== 200) {
      const errorData = JSON.parse(result.data);
      console.error('API 오류:', errorData);
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
