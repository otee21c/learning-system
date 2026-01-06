// /api/analyze-workbook.js
// 교재 PDF를 분석하여 문제별 유형을 자동 분류하는 API

export default async function handler(req, res) {
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
    const { pdfBase64, workbookName, totalQuestions } = req.body;

    if (!pdfBase64 || !workbookName) {
      return res.status(400).json({ error: 'PDF와 교재명이 필요합니다.' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }

    // Claude API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64
                }
              },
              {
                type: 'text',
                text: `당신은 한국어 국어 교육 전문가입니다. 이 교재(${workbookName})의 문제들을 분석하여 각 문제의 유형을 분류해주세요.

## 유형 분류 체계

### 독서 영역
- **독서-정보**: 일치불일치, 내용전개, 서술상특징, 어휘
- **독서-의미**: 추론, 이해, 반응, 평가, 구절의미, 대상비교
- **독서-보기**: 보기가 있는 모든 문제 (보기적용, 보기분석, 보기비교)

### 문학 영역
- **문학-정보**: 일치불일치, 서술상특징, 표현상특징, 어휘
- **문학-의미**: 추론, 이해, 반응, 시어의미, 소재의미, 구절의미, 대상비교
- **문학-보기**: 보기가 있는 모든 문제 (보기감상, 보기적용, 외적준거)

### 화법과 작문
- **화작**: 화법, 작문, 화법작문통합

### 언어와 매체
- **언매**: 언어, 매체, 언어매체통합

## 분류 기준
1. 문제에 <보기>가 있으면 해당 영역의 "보기" 유형으로 분류
2. 독서 지문(설명문, 논설문 등) 문제는 "독서-" 유형으로 분류
3. 문학 작품(시, 소설, 수필, 고전 등) 문제는 "문학-" 유형으로 분류
4. 화법, 작문 관련 문제는 "화작"으로 분류
5. 문법, 매체 관련 문제는 "언매"로 분류

## 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 포함하지 마세요.

{
  "1": { "type": "유형", "subType": "세부유형" },
  "2": { "type": "유형", "subType": "세부유형" },
  ...
}

예시:
{
  "1": { "type": "독서-정보", "subType": "일치불일치" },
  "2": { "type": "독서-보기", "subType": "보기적용" },
  "3": { "type": "문학-의미", "subType": "시어의미" }
}

총 ${totalQuestions || 45}개 문제를 분석해주세요.`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API Error:', errorData);
      return res.status(500).json({ error: 'AI 분석 요청 실패', details: errorData });
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // JSON 파싱 시도
    let questions = {};
    try {
      // JSON 블록 추출 (마크다운 코드 블록 처리)
      let jsonStr = content;
      if (content.includes('```json')) {
        jsonStr = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonStr = content.split('```')[1].split('```')[0].trim();
      }
      
      questions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError);
      console.log('원본 응답:', content);
      
      // 파싱 실패 시 빈 객체 반환 (수동 입력 유도)
      for (let i = 1; i <= (totalQuestions || 45); i++) {
        questions[i] = { type: '', subType: '' };
      }
    }

    return res.status(200).json({ 
      success: true, 
      questions,
      rawResponse: content // 디버깅용
    });

  } catch (error) {
    console.error('API 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error.message });
  }
}
