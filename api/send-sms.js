// Vercel Serverless Function
// 파일 위치: /api/send-sms.js

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: '전화번호와 메시지는 필수입니다.' 
      });
    }

    // 환경변수에서 Aligo API 정보 가져오기
    const apiKey = process.env.VITE_ALIGO_API_KEY;
    const userId = process.env.VITE_ALIGO_USER_ID;
    const sender = process.env.VITE_ALIGO_SENDER;

    if (!apiKey || !userId || !sender) {
      console.error('Aligo API 설정이 없습니다.');
      return res.status(500).json({ 
        success: false, 
        message: 'SMS 발송 설정이 올바르지 않습니다.' 
      });
    }

    // 전화번호 형식 정리
    const cleanPhone = phoneNumber.replace(/-/g, '');

    // Aligo API 호출
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('user_id', userId);
    formData.append('sender', sender);
    formData.append('receiver', cleanPhone);
    formData.append('msg', message);
    formData.append('testmode_yn', 'N'); // 실제 발송

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const result = await response.json();

    if (result.result_code === '1') {
      console.log('✅ SMS 발송 성공:', cleanPhone);
      return res.status(200).json({ 
        success: true, 
        message: 'SMS 발송 성공',
        data: result
      });
    } else {
      console.error('❌ SMS 발송 실패:', result.message);
      return res.status(400).json({ 
        success: false, 
        message: result.message || 'SMS 발송 실패'
      });
    }

  } catch (error) {
    console.error('SMS 발송 중 오류:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'SMS 발송 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
}
