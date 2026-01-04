// 매일 오후 1시 자동 실행 - 미제출자 문자 알림
// Vercel Cron Jobs용 API

export const config = {
  // 매일 오후 1시 (한국시간 = UTC+9, UTC 기준 04:00)
  schedule: '0 4 * * *'
};

export default async function handler(req, res) {
  // Cron 요청 검증
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // 개발 환경에서는 허용
    if (process.env.NODE_ENV === 'production' && !req.headers['x-vercel-cron']) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // Firebase Admin 초기화
    const admin = await import('firebase-admin');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
    }
    
    const db = admin.firestore();
    
    // 1. 오늘 날짜 기준으로 어제 마감된 과제 찾기
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // 2. 마감된 과제 조회
    const assignmentsSnapshot = await db.collection('assignments')
      .where('dueDate', '==', yesterdayStr)
      .where('status', '==', 'active')
      .get();
    
    if (assignmentsSnapshot.empty) {
      return res.status(200).json({ 
        message: '어제 마감된 과제가 없습니다.',
        processed: 0 
      });
    }
    
    // 3. 지점별 설정 조회
    const settingsSnapshot = await db.collection('branchSettings').get();
    const branchSettings = {};
    settingsSnapshot.forEach(doc => {
      branchSettings[doc.id] = doc.data();
    });
    
    // 4. 학생 목록 조회
    const studentsSnapshot = await db.collection('students').get();
    const students = {};
    studentsSnapshot.forEach(doc => {
      const data = doc.data();
      students[doc.id] = { id: doc.id, ...data };
    });
    
    // 5. 제출 기록 조회
    const submissionsSnapshot = await db.collection('homeworkSubmissions').get();
    const submissions = [];
    submissionsSnapshot.forEach(doc => {
      submissions.push({ id: doc.id, ...doc.data() });
    });
    
    let totalSent = 0;
    const results = [];
    
    // 6. 각 과제별로 미제출자 확인 및 문자 발송
    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
      
      // 해당 과제 제출자 목록
      const submittedStudentIds = submissions
        .filter(s => s.homeworkId === assignment.id || s.taskCode === assignment.taskCode)
        .map(s => s.studentId);
      
      // 미제출 학생 찾기
      const notSubmittedStudents = Object.values(students).filter(student => {
        // 지점 필터링 (과제에 branch가 있으면)
        if (assignment.branch && student.branch !== assignment.branch) {
          return false;
        }
        return !submittedStudentIds.includes(student.id);
      });
      
      // 발송 대상 설정 확인
      const sendToStudent = assignment.sendToStudent ?? true;
      const sendToParent = assignment.sendToParent ?? true;
      
      // 각 미제출 학생에게 문자 발송
      for (const student of notSubmittedStudents) {
        const message = `안녕하세요. 오늘의 국어입니다.\n${student.name} 학생의 '${assignment.title}' 과제가 아직 제출되지 않았습니다.\n확인 부탁드립니다.\n(학원 연락은 010-6600-5979로 편하게 해주세요.)`;
        
        // 학생에게 발송
        if (sendToStudent && student.phone) {
          const sent = await sendSMS(student.phone, message);
          if (sent) totalSent++;
        }
        
        // 학부모에게 발송
        if (sendToParent && student.parentPhone) {
          const sent = await sendSMS(student.parentPhone, message);
          if (sent) totalSent++;
        }
      }
      
      results.push({
        assignment: assignment.title,
        notSubmitted: notSubmittedStudents.length,
        taskCode: assignment.taskCode
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `미제출 알림 발송 완료`,
      totalSent,
      results
    });
    
  } catch (error) {
    console.error('Cron 실행 오류:', error);
    return res.status(500).json({ error: error.message });
  }
}

// SMS 발송 함수
async function sendSMS(phoneNumber, message) {
  try {
    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        key: process.env.VITE_ALIGO_API_KEY,
        user_id: process.env.VITE_ALIGO_USER_ID,
        sender: process.env.VITE_ALIGO_SENDER,
        receiver: phoneNumber,
        msg: message,
        testmode_yn: 'N'
      })
    });

    const data = await response.json();
    return data.result_code === '1';
  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return false;
  }
}
