// Vercel Serverless Function - SMS 발송
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
    const { receiver, msg } = req.body;

    if (!receiver || !msg) {
      return res.status(400).json({ error: 'receiver와 msg가 필요합니다.' });
    }

    // 기본 발신번호 (변경 시 여기만 수정)
    const DEFAULT_SENDER = '025625559';

    // Aligo SMS API 호출
    const formData = new URLSearchParams({
      key: process.env.VITE_ALIGO_API_KEY,
      user_id: process.env.VITE_ALIGO_USER_ID,
      sender: process.env.VITE_ALIGO_SENDER || DEFAULT_SENDER,
      receiver: receiver.replace(/-/g, ''),
      msg: msg,
      testmode_yn: 'N' // 실제 발송: N, 테스트: Y
    });

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (data.result_code === '1') {
      return res.status(200).json({ success: true, message: '문자 발송 성공' });
    } else {
      console.error('Aligo API 오류:', data);
      return res.status(500).json({ success: false, error: data.message || 'SMS 발송 실패' });
    }

  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
