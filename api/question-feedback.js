import Anthropic from '@anthropic-ai/sdk';

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
    const { question, material, imageBase64, mediaType } = req.body;

    if (!question && !imageBase64) {
      return res.status(400).json({ error: 'question or imageBase64 is required' });
    }

    const client = new Anthropic({
      apiKey: process.env.VITE_ANTHROPIC_API_KEY,
    });

    let finalQuestion = question;

    // 이미지 질문인 경우 먼저 질문 내용 추출
    if (imageBase64) {
      const extractResponse = await client.messages.create({
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
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: '이 이미지에서 학생이 질문하는 내용을 추출해주세요. 손글씨로 쓴 질문이 있다면 그 내용을 읽어주세요. 문제나 지문이 있다면 어떤 문제에 대한 질문인지도 파악해주세요.',
              },
            ],
          },
        ],
      });

      finalQuestion = extractResponse.content[0].text;
    }

    // 학습 자료 기반 답변 생성
    const systemPrompt = `당신은 국어 과목 전문 학습 도우미입니다. 
학생이 질문하면 제공된 학습 자료를 바탕으로 친절하고 이해하기 쉽게 설명해주세요.

[학습 자료 정보]
- 교재: ${material?.bookName || '미지정'}
- 단원: ${material?.chapter || '전체'}
- 학년: ${material?.grade || '미지정'}
- 과정: ${material?.course || '미지정'}

[학습 자료 내용]
${material?.extractedText || '자료 없음'}

---

답변 원칙:
1. 먼저 학습 자료에 있는 내용을 바탕으로 설명하세요.
2. 자료에 직접적인 답이 없다면, 관련 개념을 활용해 설명하세요.
3. 필요한 경우 추가적인 국어 개념을 덧붙여 설명할 수 있습니다.
4. 학생 수준에 맞게 쉽게 설명하세요.
5. 예시를 들어 설명하면 더 좋습니다.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: finalQuestion,
        },
      ],
    });

    const answer = response.content[0].text;

    return res.status(200).json({ answer, extractedQuestion: finalQuestion });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
