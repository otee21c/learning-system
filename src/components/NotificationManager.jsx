import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Bell, Send, Eye } from 'lucide-react';

export default function NotificationManager() {
  const [students, setStudents] = useState([]);
  const [homeworkList, setHomeworkList] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  const [includeAttendance, setIncludeAttendance] = useState(false);
  const [includeExam, setIncludeExam] = useState(false);
  const [includeHomework, setIncludeHomework] = useState(false);
  const [includeCurriculum, setIncludeCurriculum] = useState(false);
  const [includeAttachmentLink, setIncludeAttachmentLink] = useState(false);
   
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [curriculumList, setCurriculumList] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);

  // 학생 목록 & 과제 목록 로드
  useEffect(() => {
    const loadData = async () => {
      // 학생 목록
      const studentsRef = collection(db, 'students');
      const studentsSnapshot = await getDocs(studentsRef);
      const studentsData = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsData);

      // 과제 목록
      const homeworkRef = collection(db, 'assignments');
      const homeworkSnapshot = await getDocs(homeworkRef);
      const homeworkData = homeworkSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('📚 과제 데이터:', homeworkData);
      console.log('🎯 과제 개수:', homeworkData.length);
      console.log('🎯 첫 번째 과제:', homeworkData[0]);

      // 제출 목록 로드 (추가!)
      const submissionsRef = collection(db, 'submissions');
      const submissionsSnapshot = await getDocs(submissionsRef);
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
}));

console.log('📤 제출 데이터:', submissionsData);

// 과제에 제출 정보 연결 (추가!)
const homeworkWithSubmissions = homeworkData.map(hw => ({
  ...hw,
  submissions: submissionsData.filter(sub => sub.assignmentId === hw.id)
}));

setHomeworkList(homeworkWithSubmissions);

// 커리큘럼 목록
    const curriculumRef = collection(db, 'curriculums');
    const curriculumSnapshot = await getDocs(curriculumRef);
    const curriculumData = curriculumSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setCurriculumList(curriculumData);

    // 출결 기록
    const attendanceRef = collection(db, 'attendance');
    const attendanceSnapshot = await getDocs(attendanceRef);
    const attendanceData = attendanceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setAttendanceList(attendanceData);
    };
    loadData();
  }, []);

  // 미리보기 업데이트
  useEffect(() => {
    if (selectedStudents.length === 0) {
      setPreviewMessage('');
      return;
    }

    // 첫 번째 선택된 학생으로 미리보기 생성
    const firstStudent = students.find(s => s.id === selectedStudents[0]);
    if (!firstStudent) return;

    generatePreview(firstStudent);
  }, [includeAttendance, includeExam, includeHomework, message, selectedStudents]);

  // 메시지 미리보기 생성
  const generatePreview = (student) => {
    let preview = `📢 ${student.name} 학생 알림장\n\n`;

    // 출결 현황
    if (includeAttendance) {
    const studentAttendance = attendanceList.filter(a => a.studentId === student.id);
    if (studentAttendance.length > 0) {
      const presentCount = studentAttendance.filter(a => a.status === '출석').length;
      const totalCount = studentAttendance.length;
      const rate = Math.round((presentCount / totalCount) * 100);
      
      preview += '📊 출결 현황\n';
      preview += `- 출석: ${presentCount}/${totalCount}회 (${rate}%)\n\n`;
    } else {
      preview += '📊 출결 현황\n';
      preview += '- 출석 기록이 없습니다.\n\n';
    }
  }

  // 이번 주 커리큘럼
  if (includeCurriculum && curriculumList.length > 0) {
    // 가장 최근 커리큘럼 (weekNumber가 가장 큰 것)
    const currentCurriculum = curriculumList.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    if (currentCurriculum) {
      preview += '📅 이번 주 진도\n';
      preview += `- ${currentCurriculum.weekNumber}주차: ${currentCurriculum.title}\n`;
      if (currentCurriculum.topics && currentCurriculum.topics.length > 0) {
        preview += `- 학습 주제: ${currentCurriculum.topics.join(', ')}\n`;
      }
      preview += '\n';
    }
  }

    // 시험 성적
    if (includeExam) {
      const recentExam = student.exams && student.exams.length > 0 
        ? student.exams[student.exams.length - 1] 
        : null;
      
      preview += '📝 최근 시험 결과\n';
      if (recentExam) {
        preview += `- 시험명: ${recentExam.examTitle}\n`;
        preview += `- 점수: ${recentExam.totalScore}점 / ${recentExam.maxScore}점 (${recentExam.percentage}%)\n`;
        preview += `- 날짜: ${recentExam.date}\n\n`;
      } else {
        preview += '등록된 시험 결과가 없습니다.\n\n';
      }
    }

    // 과제 안내
    if (includeHomework) {
      const recentHomework = homeworkList
        .filter(hw => hw.dueDate)
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA; // 최신 순
        })[0];
      
      preview += '📚 최근 과제\n';
      if (recentHomework) {
        preview += `- 과제명: ${recentHomework.title}\n`;
        preview += `- 마감일: ${recentHomework.dueDate}\n`;
        
        // 해당 학생의 제출 상태 확인
        const submission = recentHomework.submissions?.find(sub => sub.studentId === student.id);
        preview += `- 제출 상태: ${submission ? '제출 완료' : '미제출'}\n\n`;
      } else {
        preview += '등록된 과제가 없습니다.\n\n';
      }
    }

    // 작성한 메시지
    if (message.trim()) {
      preview += '💬 선생님 메시지\n';
      preview += message + '\n';
    }

    setPreviewMessage(preview);
  };

  // 전체 선택 토글
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };

  // 개별 학생 선택
  const handleStudentToggle = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

// SMS 발송 함수
// SMS 발송 함수
const sendSMS = async (phoneNumber, message) => {
  try {
    const response = await fetch('http://localhost:3001/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber,
        message
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ SMS 발송 성공:', phoneNumber);
      return true;
    } else {
      console.error('❌ SMS 발송 실패:', result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ SMS 발송 오류:', error);
    return false;
  }
};

  // 알림장 발송
  const handleSendNotification = async () => {
    if (selectedStudents.length === 0) {
      alert('학생을 선택해주세요.');
      return;
    }

    if (!message.trim() && !includeAttendance && !includeExam && !includeHomework) {
      alert('내용을 입력하거나 항목을 선택해주세요.');
      return;
    }

    setSending(true);

    try {
      // 선택된 학생들에게 알림 발송
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;
        
        let notificationContent = `📢 ${student.name} 학생 알림장\n\n`;
        
        // 출결 현황
        if (includeAttendance) {
        const studentAttendance = attendanceList.filter(a => a.studentId === student.id);
        if (studentAttendance.length > 0) {
          const presentCount = studentAttendance.filter(a => a.status === '출석').length;
          const totalCount = studentAttendance.length;
          const rate = Math.round((presentCount / totalCount) * 100);
          
          notificationContent += '📊 출결 현황\n';
          notificationContent += `- 출석: ${presentCount}/${totalCount}회 (${rate}%)\n\n`;
        } else {
          notificationContent += '📊 출결 현황\n';
          notificationContent += '- 출석 기록이 없습니다.\n\n';
        }
      }

      // 이번 주 커리큘럼
      if (includeCurriculum && curriculumList.length > 0) {
        const currentCurriculum = curriculumList.sort((a, b) => b.weekNumber - a.weekNumber)[0];
        if (currentCurriculum) {
          notificationContent += '📅 이번 주 진도\n';
          notificationContent += `- ${currentCurriculum.weekNumber}주차: ${currentCurriculum.title}\n`;
          if (currentCurriculum.topics && currentCurriculum.topics.length > 0) {
            notificationContent += `- 학습 주제: ${currentCurriculum.topics.join(', ')}\n`;
          }
          notificationContent += '\n';
        }
      }
        
        // 시험 성적
        if (includeExam) {
          const recentExam = student.exams && student.exams.length > 0 
            ? student.exams[student.exams.length - 1] 
            : null;
          
          notificationContent += '📝 최근 시험 결과\n';
          if (recentExam) {
            notificationContent += `- 시험명: ${recentExam.examTitle}\n`;
            notificationContent += `- 점수: ${recentExam.totalScore}점 / ${recentExam.maxScore}점 (${recentExam.percentage}%)\n`;
            notificationContent += `- 날짜: ${recentExam.date}\n\n`;
          } else {
            notificationContent += '등록된 시험 결과가 없습니다.\n\n';
          }
        }
        
        // 과제 안내
        if (includeHomework) {
          const recentHomework = homeworkList
            .filter(hw => hw.dueDate)
            .sort((a, b) => {
              const timeA = a.createdAt?.seconds || 0;
              const timeB = b.createdAt?.seconds || 0;
              return timeB - timeA; // 최신 순
              })[0];
          
          notificationContent += '📚 최근 과제\n';
          if (recentHomework) {
            notificationContent += `- 과제명: ${recentHomework.title}\n`;
            notificationContent += `- 마감일: ${recentHomework.dueDate}\n`;
            
            const submission = recentHomework.submissions?.find(sub => sub.studentId === student.id);
            notificationContent += `- 제출 상태: ${submission ? '제출 완료' : '미제출'}\n\n`;
          } else {
            notificationContent += '등록된 과제가 없습니다.\n\n';
          }
        }
        
        // 작성한 메시지 추가
        if (message.trim()) {
          notificationContent += '💬 선생님 메시지\n';
          notificationContent += message + '\n';
        }

        // Firebase에 알림 저장
        await addDoc(collection(db, 'notifications'), {
          studentId: student.id,
          studentName: student.name,
          content: notificationContent,
          includeAttendance,
          includeExam,
          includeHomework,
          timestamp: new Date(),
          isRead: false,
          createdAt: new Date().toISOString()
        });

        // SMS 발송
        if (student.phone) {
          const cleanPhone = student.phone.replace(/-/g, '');
          await sendSMS(cleanPhone, notificationContent);
        }
      }

      alert(`${selectedStudents.length}명에게 알림장을 발송했습니다!`);
      
      // 초기화
      setSelectedStudents([]);
      setSelectAll(false);
      setIncludeAttendance(false);
      setIncludeExam(false);
      setIncludeHomework(false);
      setMessage('');
      setPreviewMessage('');
      
    } catch (error) {
      console.error('알림 발송 실패:', error);
      alert('알림 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
            <Bell className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            알림장 발송
          </h2>
        </div>

        {/* 1. 학생 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800">1. 학생 선택</h3>
          
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="font-medium text-gray-700">전체 선택</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3 p-2">
            {students.map(student => (
              <label key={student.id} className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg hover:bg-gray-50 transition">
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => handleStudentToggle(student.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{student.name}</span>
              </label>
            ))}
          </div>

          {selectedStudents.length > 0 && (
            <div className="mt-4 text-sm text-indigo-600 font-medium">
              {selectedStudents.length}명 선택됨
            </div>
          )}
        </div>

        {/* 2. 내용 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800">2. 내용 선택 (자동 연동)</h3>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={includeCurriculum}
                onChange={(e) => setIncludeCurriculum(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <span className="text-gray-700 font-medium">📚 커리큘럼</span>
                <p className="text-xs text-gray-500 mt-1">이번 주 진도 자동 포함</p>
              </div>
            
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={includeAttendance}
                onChange={(e) => setIncludeAttendance(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <span className="text-gray-700 font-medium">📋 출결 현황</span>
                <p className="text-xs text-gray-500 mt-1">출결 시스템 준비 중</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={includeExam}
                onChange={(e) => setIncludeExam(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <span className="text-gray-700 font-medium">📝 시험 성적</span>
                <p className="text-xs text-gray-500 mt-1">학생별 최근 시험 결과 자동 포함</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={includeHomework}
                onChange={(e) => setIncludeHomework(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />

            </label>
              <div>
                <span className="text-gray-700 font-medium">📚 과제 안내</span>
                <p className="text-xs text-gray-500 mt-1">최근 등록된 과제 정보 자동 포함</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors">
              <input 
              type="checkbox"
              checked={includeAttachmentLink}
              onChange={(e) => setIncludeAttachmentLink(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300"
              />
            <div>
    <span className="text-gray-700 font-medium">📎 첨부자료 링크</span>
    <p className="text-xs text-gray-500 mt-1">과제/성적표 등 자료 보기</p>
  </div>
</label>
          </div>
        </div>

        {/* 3. 메시지 작성 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800">3. 추가 메시지 작성</h3>
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="학생들에게 전달할 추가 메시지를 입력하세요..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            rows="6"
            maxLength="500"
          />
          
          <div className="mt-2 text-sm text-gray-500">
            {message.length} / 500자
          </div>
        </div>

        {/* 미리보기 */}
        {previewMessage && (
          <div className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="text-yellow-600" size={20} />
              <h3 className="font-bold text-lg text-gray-800">메시지 미리보기</h3>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
                {previewMessage}
              </pre>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 첫 번째 선택된 학생 기준 미리보기입니다.
            </p>
          </div>
        )}

        {/* 4. 발송 버튼 */}
        <button
          onClick={handleSendNotification}
          disabled={sending || selectedStudents.length === 0}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg disabled:from-gray-300 disabled:to-gray-400 flex items-center justify-center gap-2"
        >
          <Send size={20} />
          {sending ? '발송 중...' : `알림장 발송 (${selectedStudents.length}명)`}
        </button>
      </div>
    </div>
  );
}