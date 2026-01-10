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

    console.log('요청 받음:', { workbookName, totalQuestions, pdfLength: pdfBase64?.length });

    if (!pdfBase64) {
      return res.status(400).json({ error: 'PDF 데이터가 없습니다.' });
    }
    
    if (!workbookName) {
      return res.status(400).json({ error: '교재명이 없습니다.' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      console.error('API 키 없음');
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' });
    }

    console.log('Claude API 호출 시작...');

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
        max_tokens: 8192,
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
                text: `당신은 한국어 국어 교육 전문가입니다. 이 교재(${workbookName})의 문제들을 분석하여 각 문제의 유형과 정답을 분류해주세요.

## 중요: 정답 찾기
- PDF 뒷부분에 정답표가 있습니다
- 문제 번호와 정답(1~5)을 매칭해주세요
- 정답을 찾을 수 없으면 answer는 빈 값("")으로 두세요

## 유형 분류 체계

### 독서 영역 (설명문, 논설문, 과학/기술/예술/인문 지문)
- **독서-정보**: 일치불일치, 내용전개, 서술상특징, 어휘
- **독서-의미**: 추론, 이해, 반응, 평가, 구절의미, 대상비교
- **독서-보기**: <보기>가 있는 모든 독서 문제

### 문학 영역 (시, 소설, 수필, 희곡, 시나리오, 고전시가, 고전산문)
- **문학-정보**: 일치불일치, 서술상특징, 표현상특징, 어휘
- **문학-의미**: 추론, 이해, 반응, 시어의미, 소재의미, 구절의미, 대상비교
- **문학-보기**: <보기>가 있는 모든 문학 문제

### 화법과 작문 (강연, 토론, 발표, 대화, 작문)
- **화작**: 화법, 작문, 화법작문통합

### 언어와 매체 (문법, 국어사, 매체)
- **언매**: 언어, 매체, 언어매체통합

## 분류 기준
1. 문제에 <보기>가 있으면 → 해당 영역의 "보기" 유형
2. 독서 지문 문제 → "독서-" 유형
3. 문학 작품 문제 → "문학-" 유형
4. 화법/작문 문제 → "화작"
5. 문법/매체 문제 → "언매"

## 중요: 반드시 순수 JSON만 출력하세요!
- 마크다운 코드블록(\`\`\`) 사용 금지
- 설명이나 부연 텍스트 금지
- 오직 JSON 객체만 출력

총 ${totalQuestions || 45}개 문제를 분석하고, 아래 형식으로 출력하세요:

{"1":{"type":"독서-정보","subType":"일치불일치","answer":3},"2":{"type":"독서-보기","subType":"보기적용","answer":5},"3":{"type":"문학-의미","subType":"시어의미","answer":2}}`
              }
            ]
          }
        ]
      })
    });

    console.log('Claude API 응답 상태:', response.status);

    const responseText = await response.text();
    console.log('응답 텍스트 길이:', responseText.length);

    if (!response.ok) {
      console.error('Claude API Error:', responseText);
      return res.status(500).json({ 
        error: 'Claude API 오류', 
        status: response.status,
        details: responseText.substring(0, 500)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('응답 JSON 파싱 실패:', e);
      return res.status(500).json({ 
        error: 'API 응답 파싱 실패', 
        details: responseText.substring(0, 500)
      });
    }

    const content = data.content?.[0]?.text || '';
    
    console.log('Claude 응답 내용 (앞 300자):', content.substring(0, 300));

    // JSON 파싱 시도
    let questions = {};
    try {
      // 다양한 형태의 JSON 추출 시도
      let jsonStr = content.trim();
      
      // 마크다운 코드 블록 제거
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      
      // JSON 객체 시작/끝 찾기
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
      }
      
      questions = JSON.parse(jsonStr);
      console.log('파싱 성공, 문제 수:', Object.keys(questions).length);
      
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError.message);
      
      // 파싱 실패 시 빈 객체 반환
      for (let i = 1; i <= (totalQuestions || 45); i++) {
        questions[i] = { type: '', subType: '' };
      }
      
      return res.status(200).json({ 
        success: false, 
        questions,
        error: 'JSON 파싱 실패 - 수동 입력 필요',
        rawResponse: content.substring(0, 1000)
      });
    }

    return res.status(200).json({ 
      success: true, 
      questions
    });

  } catch (error) {
    console.error('서버 오류:', error.message, error.stack);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.', 
      details: error.message 
    });
  }
}
