import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Bell, Send, Eye } from 'lucide-react';
import { getMonthWeek, getTodayMonthWeek, formatMonthWeek } from '../../utils/dateUtils';

export default function NotificationManager() {
  const [students, setStudents] = useState([]);
  const [homeworkList, setHomeworkList] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('all'); // 학년별 필터
  
  // 월/주차 선택 (기본값: 현재 월/주차)
  const todayMonthWeek = getTodayMonthWeek();
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  
  const [includeAttendance, setIncludeAttendance] = useState(false);
  const [includeExam, setIncludeExam] = useState(false);
  const [includeHomework, setIncludeHomework] = useState(false);
  const [includeCurriculum, setIncludeCurriculum] = useState(false);
  const [includeAttachmentLink, setIncludeAttachmentLink] = useState(false);
  
  // 문자 발송 대상 선택 (학생/학부모/둘다)
  const [smsTarget, setSmsTarget] = useState('both'); // 'student', 'parent', 'both'
   
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [curriculumList, setCurriculumList] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);

  // 학년 목록
  const grades = ['중1', '중2', '중3', '고1', '고2', '고3'];

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

      // 제출 목록 로드
      const submissionsRef = collection(db, 'submissions');
      const submissionsSnapshot = await getDocs(submissionsRef);
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 과제에 제출 정보 연결
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

  // 학년별 필터링된 학생 목록
  const filteredStudents = selectedGrade === 'all' 
    ? students 
    : students.filter(s => s.grade === selectedGrade);

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
  }, [includeAttendance, includeExam, includeHomework, includeCurriculum, message, selectedStudents, selectedMonth, selectedWeek, students, homeworkList, curriculumList, attendanceList]);

  // 메시지 미리보기 생성
  const generatePreview = (student) => {
    let preview = `📢 ${student.name} 학생 알림장\n\n`;

    // 선택된 월/주차의 커리큘럼
    if (includeCurriculum && curriculumList.length > 0) {
      // 선택된 월/주차에 해당하는 커리큘럼 찾기
      const selectedCurriculum = curriculumList.find(c => 
        c.month === selectedMonth && c.weekNumber === selectedWeek
      );
      if (selectedCurriculum) {
        preview += `📅 ${selectedMonth}월 ${selectedWeek}주차 진도\n`;
        preview += `- ${selectedCurriculum.weekNumber}주차: ${selectedCurriculum.title}\n`;
        if (selectedCurriculum.topics && selectedCurriculum.topics.length > 0) {
          preview += `- 학습 주제: ${selectedCurriculum.topics.join(', ')}\n`;
        }
        preview += '\n';
      }
    }

    // 선택된 월/주차 출결 현황
    if (includeAttendance) {
      // 선택된 월/주차의 출석 기록만 필터링
      const selectedWeekAttendance = attendanceList.filter(a => {
        if (a.studentId !== student.id) return false;
        return a.month === selectedMonth && a.week === selectedWeek;
      });

      if (selectedWeekAttendance.length > 0) {
        const presentCount = selectedWeekAttendance.filter(a => a.status === '출석').length;
        const totalCount = selectedWeekAttendance.length;
        const rate = Math.round((presentCount / totalCount) * 100);
        
        preview += `📊 ${selectedMonth}월 ${selectedWeek}주차 출결 현황\n`;
        preview += `- 출석: ${presentCount}/${totalCount}회 (${rate}%)\n\n`;
      } else {
        preview += `📊 ${selectedMonth}월 ${selectedWeek}주차 출결 현황\n`;
        preview += '- 해당 기간 출석 기록이 없습니다.\n\n';
      }
    }

    // 최근 시험 결과
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
        preview += '- 등록된 시험 결과가 없습니다.\n\n';
      }
    }

    // 선택된 월/주차의 과제
    if (includeHomework) {
      const selectedWeekHomework = homeworkList.filter(hw => 
        hw.month === selectedMonth && hw.week === selectedWeek
      );
      
      preview += `📚 ${selectedMonth}월 ${selectedWeek}주차 과제\n`;
      if (selectedWeekHomework.length > 0) {
        selectedWeekHomework.forEach(hw => {
          preview += `- ${hw.title} (마감: ${hw.dueDate})\n`;
          const submission = hw.submissions?.find(sub => sub.studentId === student.id);
          preview += `  제출 상태: ${submission ? '제출 완료' : '미제출'}\n`;
        });
        preview += '\n';
      } else {
        preview += '- 등록된 과제가 없습니다.\n\n';
      }
    }

    // 작성한 메시지
    if (message.trim()) {
      preview += '💬 선생님 메시지\n';
      preview += message + '\n';
    }

    setPreviewMessage(preview);
  };

  // 학년별 선택
  const handleGradeSelect = (grade) => {
    setSelectedGrade(grade);
    setSelectedStudents([]); // 선택 초기화
    setSelectAll(false);
  };

  // 전체 선택 토글 (현재 필터링된 학생들 기준)
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
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

  // SMS 발송 함수 (Vercel Serverless Function 호출)
  const sendSMS = async (phoneNumber, message) => {
    try {
      // Vercel Serverless Function 호출
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message
        })
      });

      const result = await response.json();
      
      // 🔍 Vercel Function IP 출력
      if (result.vercelIP) {
        console.log('📍 Vercel Function IP:', result.vercelIP);
      }
      
      if (result.success) {
        console.log('✅ SMS 발송 성공:', phoneNumber);
        return true;
      } else {
        console.error('❌ SMS 발송 실패:', result.message);
        if (result.vercelIP) {
          console.error('📍 요청한 IP:', result.vercelIP);
        }
        if (result.aligoError) {
          console.error('📋 Aligo 에러 상세:', result.aligoError);
        }
        return false;
      }
    } catch (error) {
      console.error('SMS 발송 중 오류:', error);
      return false;
    }
  };

  // 알림 발송
  const handleSendNotification = async () => {
    if (selectedStudents.length === 0) {
      alert('발송할 학생을 선택해주세요.');
      return;
    }

    if (!includeAttendance && !includeExam && !includeHomework && !includeCurriculum && !message.trim()) {
      alert('발송할 내용을 선택하거나 메시지를 작성해주세요.');
      return;
    }

    setSending(true);

    try {
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        let notificationContent = `📢 ${student.name} 학생 알림장\n\n`;

        // 선택된 월/주차의 커리큘럼
        if (includeCurriculum && curriculumList.length > 0) {
          const selectedCurriculum = curriculumList.find(c => 
            c.month === selectedMonth && c.weekNumber === selectedWeek
          );
          if (selectedCurriculum) {
            notificationContent += `📅 ${selectedMonth}월 ${selectedWeek}주차 진도\n`;
            notificationContent += `- ${selectedCurriculum.weekNumber}주차: ${selectedCurriculum.title}\n`;
            if (selectedCurriculum.topics && selectedCurriculum.topics.length > 0) {
              notificationContent += `- 학습 주제: ${selectedCurriculum.topics.join(', ')}\n`;
            }
            notificationContent += '\n';
          }
        }

        // 선택된 월/주차 출결 현황
        if (includeAttendance) {
          const selectedWeekAttendance = attendanceList.filter(a => {
            if (a.studentId !== student.id) return false;
            return a.month === selectedMonth && a.week === selectedWeek;
          });

          if (selectedWeekAttendance.length > 0) {
            const presentCount = selectedWeekAttendance.filter(a => a.status === '출석').length;
            const totalCount = selectedWeekAttendance.length;
            const rate = Math.round((presentCount / totalCount) * 100);
            
            notificationContent += `📊 ${selectedMonth}월 ${selectedWeek}주차 출결 현황\n`;
            notificationContent += `- 출석: ${presentCount}/${totalCount}회 (${rate}%)\n\n`;
          } else {
            notificationContent += `📊 ${selectedMonth}월 ${selectedWeek}주차 출결 현황\n`;
            notificationContent += '- 해당 기간 출석 기록이 없습니다.\n\n';
          }
        }

        // 최근 시험 결과
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
            notificationContent += '- 등록된 시험 결과가 없습니다.\n\n';
          }
        }

        // 선택된 월/주차의 과제
        if (includeHomework) {
          const selectedWeekHomework = homeworkList.filter(hw => 
            hw.month === selectedMonth && hw.week === selectedWeek
          );
          
          notificationContent += `📚 ${selectedMonth}월 ${selectedWeek}주차 과제\n`;
          if (selectedWeekHomework.length > 0) {
            selectedWeekHomework.forEach(hw => {
              notificationContent += `- ${hw.title} (마감: ${hw.dueDate})\n`;
              const submission = hw.submissions?.find(sub => sub.studentId === student.id);
              notificationContent += `  제출 상태: ${submission ? '제출 완료' : '미제출'}\n`;
            });
            notificationContent += '\n';
          } else {
            notificationContent += '- 등록된 과제가 없습니다.\n\n';
          }
        }
        
        // 작성한 메시지 추가
        if (message.trim()) {
          notificationContent += '💬 선생님 메시지\n';
          notificationContent += message + '\n';
        }

        // Firebase에 알림 저장 (undefined 방지)
        await addDoc(collection(db, 'notifications'), {
          studentId: student.id || '',
          studentName: student.name || '',
          content: notificationContent || '',
          includeAttendance: includeAttendance || false,
          includeExam: includeExam || false,
          includeHomework: includeHomework || false,
          includeCurriculum: includeCurriculum || false,
          selectedMonth: selectedMonth,
          selectedWeek: selectedWeek,
          timestamp: new Date(),
          isRead: false,
          createdAt: new Date().toISOString()
        });

        // SMS 발송 (학생/학부모 선택에 따라)
        const phoneNumbers = [];
        
        if (smsTarget === 'student' || smsTarget === 'both') {
          if (student.phone) {
            phoneNumbers.push(student.phone.replace(/-/g, ''));
          }
        }
        
        if (smsTarget === 'parent' || smsTarget === 'both') {
          if (student.parentPhone) {
            phoneNumbers.push(student.parentPhone.replace(/-/g, ''));
          }
        }

        // 각 전화번호로 SMS 발송
        for (const phone of phoneNumbers) {
          await sendSMS(phone, notificationContent);
        }
      }

      alert(`${selectedStudents.length}명에게 알림장을 발송했습니다!`);
      
      // 초기화
      setSelectedStudents([]);
      setSelectAll(false);
      setIncludeAttendance(false);
      setIncludeExam(false);
      setIncludeHomework(false);
      setIncludeCurriculum(false);
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
          
          {/* 학년별 필터 */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">학년별 선택:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleGradeSelect('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedGrade === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체
              </button>
              {grades.map(grade => (
                <button
                  key={grade}
                  onClick={() => handleGradeSelect(grade)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedGrade === grade
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* 전체 선택 */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span className="font-medium text-gray-700">
                {selectedGrade === 'all' ? '전체' : selectedGrade} 선택 
                ({filteredStudents.length}명)
              </span>
            </label>
          </div>

          {/* 학생 목록 */}
          <div className="flex flex-wrap gap-3 p-2">
            {filteredStudents.map(student => (
              <label key={student.id} className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg hover:bg-gray-50 transition">
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(student.id)}
                  onChange={() => handleStudentToggle(student.id)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  {student.name} <span className="text-xs text-gray-500">({student.grade})</span>
                </span>
              </label>
            ))}
          </div>

          {filteredStudents.length === 0 && (
            <p className="text-center text-gray-500 py-4">
              선택한 학년의 학생이 없습니다.
            </p>
          )}

          {selectedStudents.length > 0 && (
            <div className="mt-4 text-sm text-indigo-600 font-medium">
              {selectedStudents.length}명 선택됨
            </div>
          )}
        </div>

        {/* 1-1. 문자 발송 대상 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800">1-1. 문자 발송 대상</h3>
          
          <div className="flex gap-3">
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="smsTarget"
                value="student"
                checked={smsTarget === 'student'}
                onChange={(e) => setSmsTarget(e.target.value)}
                className="hidden"
              />
              <div className={`p-4 rounded-lg border-2 text-center transition ${
                smsTarget === 'student'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}>
                <p className="font-semibold text-gray-700">학생만</p>
              </div>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="smsTarget"
                value="parent"
                checked={smsTarget === 'parent'}
                onChange={(e) => setSmsTarget(e.target.value)}
                className="hidden"
              />
              <div className={`p-4 rounded-lg border-2 text-center transition ${
                smsTarget === 'parent'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}>
                <p className="font-semibold text-gray-700">학부모만</p>
              </div>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="smsTarget"
                value="both"
                checked={smsTarget === 'both'}
                onChange={(e) => setSmsTarget(e.target.value)}
                className="hidden"
              />
              <div className={`p-4 rounded-lg border-2 text-center transition ${
                smsTarget === 'both'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}>
                <p className="font-semibold text-gray-700">학생 + 학부모</p>
              </div>
            </label>
          </div>
        </div>

        {/* 1-2. 월/주차 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800">1-2. 조회 기간 선택</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 월 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                월 선택
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>

            {/* 주차 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주차 선택
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {[1, 2, 3, 4, 5].map(week => (
                  <option key={week} value={week}>{week}주차</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-600 bg-white p-3 rounded-lg">
            💡 선택된 기간: <span className="font-semibold text-indigo-600">{selectedMonth}월 {selectedWeek}주차</span>
          </div>
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
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={includeAttendance}
                onChange={(e) => setIncludeAttendance(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <span className="text-gray-700 font-medium">📋 출결 현황</span>
                <p className="text-xs text-gray-500 mt-1">이번 주 출석 현황</p>
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
                <p className="text-xs text-gray-500 mt-1">최근 시험 결과 자동 포함</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={includeHomework}
                onChange={(e) => setIncludeHomework(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div>
                <span className="text-gray-700 font-medium">📚 과제 안내</span>
                <p className="text-xs text-gray-500 mt-1">최근 과제 정보 자동 포함</p>
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
