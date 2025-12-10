// 이미지 URL을 Base64로 변환하는 API
// CORS 문제를 우회하기 위해 서버에서 이미지를 가져옴

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    // 서버에서 이미지 fetch
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch image' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Content-Type 확인
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Base64로 변환
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return res.status(200).json({ 
      success: true, 
      base64: dataUrl 
    });

  } catch (error) {
    console.error('이미지 변환 실패:', error);
    return res.status(500).json({ error: 'Failed to convert image' });
  }
}
