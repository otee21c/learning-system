const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3001;

// CORS 설정
app.use(cors());
app.use(express.json());

// SMS 발송 엔드포인트
app.post('/api/send-sms', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: '전화번호와 메시지는 필수입니다.' 
      });
    }

    // 알리고 API 호출
    const formData = new URLSearchParams();
    formData.append('user_id', process.env.ALIGO_USER_ID);
    formData.append('key', process.env.ALIGO_API_KEY);
    formData.append('sender', process.env.ALIGO_SENDER);
    formData.append('receiver', phoneNumber);
    formData.append('msg', message);
    formData.append('testmode_yn', 'N');

    const response = await axios.post('https://apis.aligo.in/send/', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
});

const result = response.data;

      if (result.result_code === '1') {
      console.log('✅ SMS 발송 성공:', phoneNumber);
      res.json({ 
        success: true, 
        message: 'SMS 발송 성공' 
      });
    } else {
      console.error('❌ SMS 발송 실패:', result.message);
      res.status(500).json({ 
        success: false, 
        message: result.message 
      });
    }
  } catch (error) {
    console.error('❌ 서버 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SMS 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});