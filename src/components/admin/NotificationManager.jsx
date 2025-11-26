import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Bell, Send, Eye, Clock, CheckCircle, Users, Calendar, Zap, List, Settings, Trash2, Edit, FileText, X } from 'lucide-react';
import { getMonthWeek, getTodayMonthWeek, formatMonthWeek } from '../../utils/dateUtils';

export default function NotificationManager() {
  // 탭 상태: 'manual' (일반 발송) | 'batch' (일괄 발송) | 'scheduled' (예약 설정)
  const [activeSubTab, setActiveSubTab] = useState('manual');
  
  const [students, setStudents] = useState([]);
  const [homeworkList, setHomeworkList] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('all');
  
  // 월/주차 선택 (기본값: 현재 월/주차)
  const todayMonthWeek = getTodayMonthWeek();
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  
  const [includeAttendance, setIncludeAttendance] = useState(false);
  const [includeExam, setIncludeExam] = useState(false);
  const [includeHomework, setIncludeHomework] = useState(false);
  const [includeCurriculum, setIncludeCurriculum] = useState(false);
  const [includeMemo, setIncludeMemo] = useState(false);
  
  // 문자 발송 대상 선택 (학생/학부모/둘다)
  const [smsTarget, setSmsTarget] = useState('both');
  
  // 발신번호 선택
  const [senderType, setSenderType] = useState('personal');
   
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [curriculumList, setCurriculumList] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [studentMemos, setStudentMemos] = useState({});

  // === 일괄 발송 관련 상태 ===
  const [batchPrepared, setBatchPrepared] = useState(false);
  const [preparedMessages, setPreparedMessages] = useState([]);
  const [batchSending, setBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  
  // === 일괄 발송 학생 제외 ===
  const [excludedStudents, setExcludedStudents] = useState([]);

  // === 예약 설정 관련 상태 ===
  const [schedules, setSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    dayOfWeek: 5, // 금요일
    targetGrade: 'all',
    excludedStudents: [], // 제외할 학생 ID 배열
    includeAttendance: true,
    includeExam: true, // ⭐ 기본값 true로 변경
    includeHomework: true,
    includeCurriculum: true,
    includeMemo: true,
    smsTarget: 'both',
    senderType: 'personal',
    additionalMessage: '',
    isActive: true
  });

  // 학년 목록
  const grades = ['중1', '중2', '중3', '고1', '고2', '고3'];
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

  // 데이터 로드
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

      // 수업 메모 로드
      const memosRef = collection(db, 'studentMemos');
      const memosSnapshot = await getDocs(memosRef);
      const memosData = memosSnapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
      
      // 학생별로 그룹화
      const groupedMemos = {};
      memosData.forEach(memo => {
        if (!groupedMemos[memo.studentId]) {
          groupedMemos[memo.studentId] = [];
        }
        groupedMemos[memo.studentId].push(memo);
      });
      setStudentMemos(groupedMemos);

      // 예약 설정 로드
      const schedulesRef = collection(db, 'notificationSchedules');
      const schedulesSnapshot = await getDocs(schedulesRef);
      const schedulesData = schedulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedules(schedulesData);
    };
    loadData();
  }, []);

  // 학년별 필터링된 학생 목록
  const filteredStudents = selectedGrade === 'all' 
    ? students 
    : students.filter(s => s.grade === selectedGrade);

  // 예약 설정 폼에서 학년별 필터링된 학생 목록
  const scheduleFilteredStudents = scheduleForm.targetGrade === 'all'
    ? students
    : students.filter(s => s.grade === scheduleForm.targetGrade);

  // 미리보기 업데이트
  useEffect(() => {
    if (selectedStudents.length === 0) {
      setPreviewMessage('');
      return;
    }

    const firstStudent = students.find(s => s.id === selectedStudents[0]);
    if (!firstStudent) return;

    generatePreview(firstStudent);
  }, [includeAttendance, includeExam, includeHomework, includeCurriculum, includeMemo, message, selectedStudents, selectedMonth, selectedWeek, students, homeworkList, curriculumList, attendanceList, studentMemos]);

  // 학생별 메시지 생성 함수 (공통)
  const generateMessageForStudent = (student, options = {}) => {
    const {
      month = selectedMonth,
      week = selectedWeek,
      includeAtt = includeAttendance,
      includeEx = includeExam,
      includeHw = includeHomework,
      includeCurr = includeCurriculum,
      includeMm = includeMemo,
      additionalMsg = message
    } = options;

    let content = `★ ${student.name} 학생 알림장\n\n`;

    // 커리큘럼
    if (includeCurr && curriculumList.length > 0) {
      const selectedCurriculum = curriculumList.find(c => 
        c.month === month && 
        c.weekNumber === week &&
        c.students?.includes(student.id)
      );
      if (selectedCurriculum) {
        content += `★ ${month}월 ${week}주차 진도\n`;
        content += `- ${selectedCurriculum.weekNumber}주차: ${selectedCurriculum.title}\n`;
        if (selectedCurriculum.topics && selectedCurriculum.topics.length > 0) {
          content += `- 학습 주제: ${selectedCurriculum.topics.join(', ')}\n`;
        }
        content += '\n';
      }
    }

    // 출결 현황 (지각도 출석으로 계산)
    if (includeAtt) {
      const selectedWeekAttendance = attendanceList.filter(a => {
        if (a.studentId !== student.id) return false;
        return a.month === month && a.week === week;
      });

      if (selectedWeekAttendance.length > 0) {
        const presentCount = selectedWeekAttendance.filter(a => 
          a.status === '출석' || a.status === '지각'
        ).length;
        const totalCount = selectedWeekAttendance.length;
        const rate = Math.round((presentCount / totalCount) * 100);
        
        content += `★ ${month}월 ${week}주차 출결 현황\n`;
        content += `- 출석: ${presentCount}/${totalCount}회 (${rate}%)\n\n`;
      } else {
        content += `★ ${month}월 ${week}주차 출결 현황\n`;
        content += '- 해당 기간 출석 기록이 없습니다.\n\n';
      }
    }

    // 최근 시험 결과
    if (includeEx) {
      const recentExam = student.exams && student.exams.length > 0 
        ? student.exams[student.exams.length - 1] 
        : null;
      
      content += '★ 최근 시험 결과\n';
      if (recentExam) {
        content += `- 시험명: ${recentExam.examTitle}\n`;
        content += `- 점수: ${recentExam.totalScore}점 / ${recentExam.maxScore}점 (${recentExam.percentage}%)\n`;
        content += `- 날짜: ${recentExam.date}\n\n`;
      } else {
        content += '- 등록된 시험 결과가 없습니다.\n\n';
      }
    }

    // 과제
    if (includeHw) {
      const selectedWeekHomework = homeworkList.filter(hw => 
        hw.month === month && hw.week === week
      );
      
      content += `★ ${month}월 ${week}주차 과제\n`;
      if (selectedWeekHomework.length > 0) {
        selectedWeekHomework.forEach(hw => {
          content += `- ${hw.title} (마감: ${hw.dueDate})\n`;
          const submission = hw.submissions?.find(sub => sub.studentId === student.id);
          content += `  제출 상태: ${submission ? '제출 완료' : '미제출'}\n`;
        });
        content += '\n';
      } else {
        content += '- 등록된 과제가 없습니다.\n\n';
      }
    }

    // 수업 메모
    if (includeMm) {
      const memos = studentMemos[student.id] || [];
      const weekMemo = memos.find(m => m.month === month && m.week === week);
      
      if (weekMemo) {
        content += `★ ${month}월 ${week}주차 수업 메모\n`;
        content += `${weekMemo.content}\n\n`;
      }
    }

    // 추가 메시지
    if (additionalMsg && additionalMsg.trim()) {
      content += '● 선생님 메시지\n';
      content += additionalMsg + '\n';
    }

    return content;
  };

  // 메시지 미리보기 생성
  const generatePreview = (student) => {
    const preview = generateMessageForStudent(student);
    setPreviewMessage(preview);
  };

  // 학년별 선택
  const handleGradeSelect = (grade) => {
    setSelectedGrade(grade);
    setSelectedStudents([]);
    setSelectAll(false);
  };

  // 전체 선택 토글
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

  // SMS 발송 함수
  const sendSMS = async (phoneNumber, smsMessage, currentSenderType) => {
    try {
      const apiKey = import.meta.env.VITE_ALIGO_API_KEY;
      const userId = import.meta.env.VITE_ALIGO_USER_ID;
      
      let sender;
      if (currentSenderType === 'main') {
        sender = import.meta.env.VITE_ALIGO_SENDER_MAIN || '025695559';
      } else if (currentSenderType === 'sub') {
        sender = import.meta.env.VITE_ALIGO_SENDER_SUB || '01084661129';
      } else {
        sender = import.meta.env.VITE_ALIGO_SENDER || '01054535388';
      }

      if (!apiKey || !userId || !sender) {
        console.error('❌ Aligo API 설정이 없습니다.');
        return false;
      }

      const cleanPhone = phoneNumber.replace(/-/g, '');

      const formData = new URLSearchParams();
      formData.append('key', apiKey);
      formData.append('user_id', userId);
      formData.append('sender', sender);
      formData.append('receiver', cleanPhone);
      formData.append('msg', smsMessage);
      formData.append('testmode_yn', 'N');

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
        return true;
      } else {
        console.error('❌ SMS 발송 실패:', result.message);
        return false;
      }
    } catch (error) {
      console.error('SMS 발송 중 오류:', error);
      return false;
    }
  };

  // === 일반 발송 ===
  const handleSendNotification = async () => {
    if (selectedStudents.length === 0) {
      alert('발송할 학생을 선택해주세요.');
      return;
    }

    if (!includeAttendance && !includeExam && !includeHomework && !includeCurriculum && !includeMemo && !message.trim()) {
      alert('발송할 내용을 선택하거나 메시지를 작성해주세요.');
      return;
    }

    setSending(true);

    try {
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;

        const notificationContent = generateMessageForStudent(student);

        // Firebase에 알림 저장
        await addDoc(collection(db, 'notifications'), {
          studentId: student.id || '',
          studentName: student.name || '',
          content: notificationContent || '',
          includeAttendance: includeAttendance || false,
          includeExam: includeExam || false,
          includeHomework: includeHomework || false,
          includeCurriculum: includeCurriculum || false,
          includeMemo: includeMemo || false,
          selectedMonth: selectedMonth,
          selectedWeek: selectedWeek,
          timestamp: new Date(),
          isRead: false,
          createdAt: new Date().toISOString()
        });

        // SMS 발송
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

        for (const phone of phoneNumbers) {
          await sendSMS(phone, notificationContent, senderType);
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
      setIncludeMemo(false);
      setMessage('');
      setPreviewMessage('');
      
    } catch (error) {
      console.error('알림 발송 실패:', error);
      alert('알림 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  // === 일괄 발송 준비 ===
  const handlePrepareBatch = () => {
    if (!includeAttendance && !includeExam && !includeHomework && !includeCurriculum && !includeMemo) {
      alert('포함할 내용을 최소 1개 이상 선택해주세요.');
      return;
    }

    // 학년 필터링 후 제외 학생 제외
    let targetStudents = selectedGrade === 'all' 
      ? students 
      : students.filter(s => s.grade === selectedGrade);
    
    // 제외된 학생 필터링
    targetStudents = targetStudents.filter(s => !excludedStudents.includes(s.id));

    if (targetStudents.length === 0) {
      alert('발송 대상 학생이 없습니다.');
      return;
    }

    // 각 학생별로 메시지 생성
    const prepared = targetStudents.map(student => {
      const content = generateMessageForStudent(student);
      
      // 전화번호 수집
      const phoneNumbers = [];
      if (smsTarget === 'student' || smsTarget === 'both') {
        if (student.phone) phoneNumbers.push({ type: '학생', number: student.phone });
      }
      if (smsTarget === 'parent' || smsTarget === 'both') {
        if (student.parentPhone) phoneNumbers.push({ type: '학부모', number: student.parentPhone });
      }

      return {
        studentId: student.id,
        studentName: student.name,
        grade: student.grade,
        content,
        phoneNumbers,
        status: 'pending'
      };
    });

    setPreparedMessages(prepared);
    setBatchPrepared(true);
  };

  // === 일괄 발송 실행 ===
  const handleBatchSend = async () => {
    if (preparedMessages.length === 0) {
      alert('준비된 발송 내용이 없습니다.');
      return;
    }

    const confirmSend = window.confirm(
      `총 ${preparedMessages.length}명에게 문자를 발송합니다.\n계속하시겠습니까?`
    );

    if (!confirmSend) return;

    setBatchSending(true);
    setBatchProgress({ current: 0, total: preparedMessages.length });

    const updatedMessages = [...preparedMessages];

    for (let i = 0; i < preparedMessages.length; i++) {
      const msg = preparedMessages[i];
      
      try {
        // Firebase에 알림 저장
        await addDoc(collection(db, 'notifications'), {
          studentId: msg.studentId,
          studentName: msg.studentName,
          content: msg.content,
          includeAttendance,
          includeExam,
          includeHomework,
          includeCurriculum,
          includeMemo,
          selectedMonth,
          selectedWeek,
          timestamp: new Date(),
          isRead: false,
          createdAt: new Date().toISOString(),
          batchSent: true
        });

        // SMS 발송
        let allSuccess = true;
        for (const phone of msg.phoneNumbers) {
          const success = await sendSMS(phone.number, msg.content, senderType);
          if (!success) allSuccess = false;
        }

        updatedMessages[i] = {
          ...updatedMessages[i],
          status: allSuccess ? 'sent' : 'failed'
        };

      } catch (error) {
        console.error(`발송 실패 (${msg.studentName}):`, error);
        updatedMessages[i] = {
          ...updatedMessages[i],
          status: 'failed'
        };
      }

      setBatchProgress({ current: i + 1, total: preparedMessages.length });
      setPreparedMessages([...updatedMessages]);

      // 발송 간격 (API 과부하 방지)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setBatchSending(false);

    const successCount = updatedMessages.filter(m => m.status === 'sent').length;
    const failCount = updatedMessages.filter(m => m.status === 'failed').length;

    alert(`발송 완료!\n성공: ${successCount}명\n실패: ${failCount}명`);
  };

  // === 일괄 발송 초기화 ===
  const handleResetBatch = () => {
    setBatchPrepared(false);
    setPreparedMessages([]);
    setBatchProgress({ current: 0, total: 0 });
  };

  // === 학생 제외 토글 ===
  const toggleExcludeStudent = (studentId) => {
    if (excludedStudents.includes(studentId)) {
      setExcludedStudents(excludedStudents.filter(id => id !== studentId));
    } else {
      setExcludedStudents([...excludedStudents, studentId]);
    }
  };

  // === 예약 설정에서 학생 제외 토글 ===
  const toggleScheduleExcludeStudent = (studentId) => {
    const currentExcluded = scheduleForm.excludedStudents || [];
    if (currentExcluded.includes(studentId)) {
      setScheduleForm({
        ...scheduleForm,
        excludedStudents: currentExcluded.filter(id => id !== studentId)
      });
    } else {
      setScheduleForm({
        ...scheduleForm,
        excludedStudents: [...currentExcluded, studentId]
      });
    }
  };

  // === 예약 설정 저장 ===
  const handleSaveSchedule = async () => {
    if (!scheduleForm.name.trim()) {
      alert('예약 이름을 입력해주세요.');
      return;
    }

    try {
      if (editingSchedule) {
        await updateDoc(doc(db, 'notificationSchedules', editingSchedule.id), {
          ...scheduleForm,
          updatedAt: new Date()
        });
        alert('예약 설정이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'notificationSchedules'), {
          ...scheduleForm,
          createdAt: new Date()
        });
        alert('예약 설정이 저장되었습니다.');
      }

      // 목록 새로고침
      const schedulesRef = collection(db, 'notificationSchedules');
      const schedulesSnapshot = await getDocs(schedulesRef);
      const schedulesData = schedulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedules(schedulesData);

      // 폼 초기화
      setShowScheduleForm(false);
      setEditingSchedule(null);
      setScheduleForm({
        name: '',
        dayOfWeek: 5,
        targetGrade: 'all',
        excludedStudents: [],
        includeAttendance: true,
        includeExam: true,
        includeHomework: true,
        includeCurriculum: true,
        includeMemo: true,
        smsTarget: 'both',
        senderType: 'personal',
        additionalMessage: '',
        isActive: true
      });

    } catch (error) {
      console.error('예약 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // === 예약 설정 불러오기 (일괄 발송에 적용) ===
  const handleApplySchedule = (schedule) => {
    setSelectedGrade(schedule.targetGrade || 'all');
    setExcludedStudents(schedule.excludedStudents || []);
    setIncludeAttendance(schedule.includeAttendance || false);
    setIncludeExam(schedule.includeExam || false);
    setIncludeHomework(schedule.includeHomework || false);
    setIncludeCurriculum(schedule.includeCurriculum || false);
    setIncludeMemo(schedule.includeMemo || false);
    setSmsTarget(schedule.smsTarget || 'both');
    setSenderType(schedule.senderType || 'personal');
    setMessage(schedule.additionalMessage || '');
    
    // 일괄 발송 탭으로 이동
    setActiveSubTab('batch');
    alert(`"${schedule.name}" 설정이 적용되었습니다.\n발송 준비 버튼을 클릭해주세요.`);
  };

  // === 예약 설정 삭제 ===
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('이 예약 설정을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'notificationSchedules', scheduleId));
      setSchedules(schedules.filter(s => s.id !== scheduleId));
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // === 예약 설정 수정 ===
  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      name: schedule.name || '',
      dayOfWeek: schedule.dayOfWeek || 5,
      targetGrade: schedule.targetGrade || 'all',
      excludedStudents: schedule.excludedStudents || [],
      includeAttendance: schedule.includeAttendance || false,
      includeExam: schedule.includeExam || false,
      includeHomework: schedule.includeHomework || false,
      includeCurriculum: schedule.includeCurriculum || false,
      includeMemo: schedule.includeMemo || false,
      smsTarget: schedule.smsTarget || 'both',
      senderType: schedule.senderType || 'personal',
      additionalMessage: schedule.additionalMessage || '',
      isActive: schedule.isActive !== false
    });
    setShowScheduleForm(true);
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

        {/* 서브 탭 메뉴 */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setActiveSubTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition ${
              activeSubTab === 'manual'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Send size={18} />
            일반 발송
          </button>
          <button
            onClick={() => setActiveSubTab('batch')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition ${
              activeSubTab === 'batch'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Zap size={18} />
            일괄 발송
            {batchPrepared && (
              <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                준비됨
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('scheduled')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition ${
              activeSubTab === 'scheduled'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Settings size={18} />
            예약 설정
            {schedules.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {schedules.length}
              </span>
            )}
          </button>
        </div>

        {/* ============================================ */}
        {/* 일반 발송 탭 */}
        {/* ============================================ */}
        {activeSubTab === 'manual' && (
          <>
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
              <div className="flex flex-wrap gap-3 p-2 max-h-60 overflow-y-auto">
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

            {/* 1-1-1. 발신번호 선택 */}
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
              <h3 className="font-bold text-lg mb-4 text-gray-800">1-1-1. 발신번호 선택</h3>
              
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="senderType"
                    value="personal"
                    checked={senderType === 'personal'}
                    onChange={(e) => setSenderType(e.target.value)}
                    className="hidden"
                  />
                  <div className={`p-4 rounded-lg border-2 text-center transition ${
                    senderType === 'personal'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}>
                    <p className="font-semibold text-gray-700">개인번호</p>
                    <p className="text-sm text-gray-500 mt-1">010-5453-5388</p>
                  </div>
                </label>

                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="senderType"
                    value="sub"
                    checked={senderType === 'sub'}
                    onChange={(e) => setSenderType(e.target.value)}
                    className="hidden"
                  />
                  <div className={`p-4 rounded-lg border-2 text-center transition ${
                    senderType === 'sub'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}>
                    <p className="font-semibold text-gray-700">추가번호</p>
                    <p className="text-sm text-gray-500 mt-1">010-8466-1129</p>
                  </div>
                </label>

                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="senderType"
                    value="main"
                    checked={senderType === 'main'}
                    onChange={(e) => setSenderType(e.target.value)}
                    className="hidden"
                  />
                  <div className={`p-4 rounded-lg border-2 text-center transition ${
                    senderType === 'main'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}>
                    <p className="font-semibold text-gray-700">대표번호</p>
                    <p className="text-sm text-gray-500 mt-1">02-562-5559</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 1-2. 월/주차 선택 */}
            <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
              <h3 className="font-bold text-lg mb-4 text-gray-800">1-2. 조회 기간 선택</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">월 선택</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                      <option key={month} value={month}>{month}월</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">주차 선택</label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition">
                  <input
                    type="checkbox"
                    checked={includeCurriculum}
                    onChange={(e) => setIncludeCurriculum(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-gray-700 font-medium">★ 커리큘럼</span>
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
                    <p className="text-xs text-gray-500 mt-1">이번 주 출석 현황 (지각 포함)</p>
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
                    <span className="text-gray-700 font-medium">★ 시험 성적</span>
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
                    <span className="text-gray-700 font-medium">★ 과제 안내</span>
                    <p className="text-xs text-gray-500 mt-1">최근 과제 정보 자동 포함</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-lg hover:bg-gray-50 transition border-2 border-green-200">
                  <input
                    type="checkbox"
                    checked={includeMemo}
                    onChange={(e) => setIncludeMemo(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-gray-700 font-medium">📝 수업 메모</span>
                    <p className="text-xs text-gray-500 mt-1">학생별 수업 메모 자동 포함</p>
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows="4"
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
          </>
        )}

        {/* ============================================ */}
        {/* 일괄 발송 탭 */}
        {/* ============================================ */}
        {activeSubTab === 'batch' && (
          <>
            {!batchPrepared ? (
              <>
                {/* 발송 설정 */}
                <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                    <Users size={20} />
                    1. 발송 대상 선택
                  </h3>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => {
                        setSelectedGrade('all');
                        setExcludedStudents([]);
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        selectedGrade === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      전체 ({students.length}명)
                    </button>
                    {grades.map(grade => {
                      const count = students.filter(s => s.grade === grade).length;
                      return (
                        <button
                          key={grade}
                          onClick={() => {
                            setSelectedGrade(grade);
                            setExcludedStudents([]);
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            selectedGrade === grade
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {grade} ({count}명)
                        </button>
                      );
                    })}
                  </div>

                  {/* 학생 제외 선택 */}
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      🚫 제외할 학생 선택 (클릭하면 제외)
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {filteredStudents.map(student => (
                        <button
                          key={student.id}
                          onClick={() => toggleExcludeStudent(student.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                            excludedStudents.includes(student.id)
                              ? 'bg-red-100 text-red-700 line-through'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {student.name}
                          {excludedStudents.includes(student.id) && (
                            <X size={14} className="inline ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                    {excludedStudents.length > 0 && (
                      <p className="text-xs text-red-600 mt-2">
                        {excludedStudents.length}명 제외됨
                      </p>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-indigo-800">
                      선택된 대상: <span className="font-semibold">
                        {selectedGrade === 'all' ? '전체' : selectedGrade} 
                        ({filteredStudents.length - excludedStudents.length}명)
                      </span>
                      {excludedStudents.length > 0 && (
                        <span className="text-red-600"> (제외 {excludedStudents.length}명)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* 문자 발송 대상 */}
                <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">2. 문자 수신 대상</h3>
                  
                  <div className="flex gap-3">
                    {['student', 'parent', 'both'].map(target => (
                      <label key={target} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="batchSmsTarget"
                          value={target}
                          checked={smsTarget === target}
                          onChange={(e) => setSmsTarget(e.target.value)}
                          className="hidden"
                        />
                        <div className={`p-4 rounded-lg border-2 text-center transition ${
                          smsTarget === target
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-indigo-300'
                        }`}>
                          <p className="font-semibold text-gray-700">
                            {target === 'student' ? '학생만' : target === 'parent' ? '학부모만' : '학생 + 학부모'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 발신번호 선택 */}
                <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">3. 발신번호 선택</h3>
                  
                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="batchSenderType"
                        value="personal"
                        checked={senderType === 'personal'}
                        onChange={(e) => setSenderType(e.target.value)}
                        className="hidden"
                      />
                      <div className={`p-4 rounded-lg border-2 text-center transition ${
                        senderType === 'personal'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}>
                        <p className="font-semibold text-gray-700">개인번호</p>
                        <p className="text-sm text-gray-500 mt-1">010-5453-5388</p>
                      </div>
                    </label>

                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="batchSenderType"
                        value="sub"
                        checked={senderType === 'sub'}
                        onChange={(e) => setSenderType(e.target.value)}
                        className="hidden"
                      />
                      <div className={`p-4 rounded-lg border-2 text-center transition ${
                        senderType === 'sub'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}>
                        <p className="font-semibold text-gray-700">추가번호</p>
                        <p className="text-sm text-gray-500 mt-1">010-8466-1129</p>
                      </div>
                    </label>

                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="batchSenderType"
                        value="main"
                        checked={senderType === 'main'}
                        onChange={(e) => setSenderType(e.target.value)}
                        className="hidden"
                      />
                      <div className={`p-4 rounded-lg border-2 text-center transition ${
                        senderType === 'main'
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}>
                        <p className="font-semibold text-gray-700">대표번호</p>
                        <p className="text-sm text-gray-500 mt-1">02-562-5559</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 기간 선택 */}
                <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
                  <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                    <Calendar size={20} />
                    4. 조회 기간
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">월 선택</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                          <option key={month} value={month}>{month}월</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">주차 선택</label>
                      <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                      >
                        {[1, 2, 3, 4, 5].map(week => (
                          <option key={week} value={week}>{week}주차</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 포함 내용 */}
                <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                    <List size={20} />
                    5. 포함 내용 선택
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-lg hover:bg-gray-50 transition">
                      <input
                        type="checkbox"
                        checked={includeCurriculum}
                        onChange={(e) => setIncludeCurriculum(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="font-medium">커리큘럼</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-lg hover:bg-gray-50 transition">
                      <input
                        type="checkbox"
                        checked={includeAttendance}
                        onChange={(e) => setIncludeAttendance(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="font-medium">출결 현황</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-lg hover:bg-gray-50 transition">
                      <input
                        type="checkbox"
                        checked={includeExam}
                        onChange={(e) => setIncludeExam(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="font-medium">시험 성적</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-lg hover:bg-gray-50 transition">
                      <input
                        type="checkbox"
                        checked={includeHomework}
                        onChange={(e) => setIncludeHomework(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <span className="font-medium">과제 안내</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-white rounded-lg hover:bg-gray-50 transition border-2 border-green-200 col-span-2">
                      <input
                        type="checkbox"
                        checked={includeMemo}
                        onChange={(e) => setIncludeMemo(e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                      <div>
                        <span className="font-medium">📝 수업 메모</span>
                        <span className="text-xs text-gray-500 ml-2">학생별 개인 메모 포함</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 추가 메시지 */}
                <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                  <h3 className="font-bold text-lg mb-4 text-gray-800">6. 추가 메시지 (선택)</h3>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="모든 학생에게 전달할 공통 메시지..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows="3"
                  />
                </div>

                {/* 발송 준비 버튼 */}
                <button
                  onClick={handlePrepareBatch}
                  className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center justify-center gap-2"
                >
                  <Zap size={20} />
                  발송 준비하기 ({filteredStudents.length - excludedStudents.length}명)
                </button>
              </>
            ) : (
              <>
                {/* 준비된 발송 목록 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                      <CheckCircle className="text-green-600" size={20} />
                      발송 준비 완료 ({preparedMessages.length}명)
                    </h3>
                    <button
                      onClick={handleResetBatch}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                    >
                      다시 설정
                    </button>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-xl mb-4">
                    <p className="text-sm text-blue-800">
                      📋 <strong>{selectedMonth}월 {selectedWeek}주차</strong> 알림장 | 
                      대상: <strong>{selectedGrade === 'all' ? '전체' : selectedGrade}</strong> | 
                      포함: {includeCurriculum && '커리큘럼 '}{includeAttendance && '출결 '}{includeExam && '성적 '}{includeHomework && '과제 '}{includeMemo && '메모'}
                    </p>
                  </div>

                  {/* 진행률 표시 */}
                  {batchSending && (
                    <div className="mb-4 p-4 bg-yellow-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-yellow-800">발송 중...</span>
                        <span className="text-sm text-yellow-600">
                          {batchProgress.current} / {batchProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-yellow-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-600 h-2 rounded-full transition-all"
                          style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 학생별 메시지 목록 */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {preparedMessages.map((msg, idx) => (
                      <div 
                        key={msg.studentId}
                        className={`border rounded-lg overflow-hidden ${
                          msg.status === 'sent' ? 'border-green-300 bg-green-50' :
                          msg.status === 'failed' ? 'border-red-300 bg-red-50' :
                          'border-gray-200 bg-white'
                        }`}
                      >
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedStudentId(
                            expandedStudentId === msg.studentId ? null : msg.studentId
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">{idx + 1}</span>
                            <span className="font-medium">{msg.studentName}</span>
                            <span className="text-xs text-gray-500">({msg.grade})</span>
                            {msg.phoneNumbers.length > 0 && (
                              <span className="text-xs text-gray-400">
                                📱 {msg.phoneNumbers.length}개
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.status === 'sent' && (
                              <span className="text-xs text-green-600 font-medium">✓ 발송완료</span>
                            )}
                            {msg.status === 'failed' && (
                              <span className="text-xs text-red-600 font-medium">✗ 실패</span>
                            )}
                            <span className="text-gray-400">
                              {expandedStudentId === msg.studentId ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>
                        
                        {expandedStudentId === msg.studentId && (
                          <div className="p-3 border-t bg-gray-50">
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                              {msg.content}
                            </pre>
                            <div className="mt-2 text-xs text-gray-500">
                              발송 대상: {msg.phoneNumbers.map(p => `${p.type}(${p.number})`).join(', ') || '없음'}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 전체 발송 버튼 */}
                <button
                  onClick={handleBatchSend}
                  disabled={batchSending}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg disabled:from-gray-300 disabled:to-gray-400 flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  {batchSending ? '발송 중...' : `전체 발송하기 (${preparedMessages.length}명)`}
                </button>
              </>
            )}
          </>
        )}

        {/* ============================================ */}
        {/* 예약 설정 탭 */}
        {/* ============================================ */}
        {activeSubTab === 'scheduled' && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-800">저장된 발송 설정</h3>
                <button
                  onClick={() => {
                    setShowScheduleForm(!showScheduleForm);
                    setEditingSchedule(null);
                    setScheduleForm({
                      name: '',
                      dayOfWeek: 5,
                      targetGrade: 'all',
                      excludedStudents: [],
                      includeAttendance: true,
                      includeExam: true,
                      includeHomework: true,
                      includeCurriculum: true,
                      includeMemo: true,
                      smsTarget: 'both',
                      senderType: 'personal',
                      additionalMessage: '',
                      isActive: true
                    });
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    showScheduleForm 
                      ? 'bg-gray-200 text-gray-700' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {showScheduleForm ? '취소' : '+ 새 설정 추가'}
                </button>
              </div>

              {/* 새 설정 추가 폼 */}
              {showScheduleForm && (
                <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <h4 className="font-bold text-lg mb-4">
                    {editingSchedule ? '설정 수정' : '새 발송 설정'}
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">설정 이름 *</label>
                      <input
                        type="text"
                        value={scheduleForm.name}
                        onChange={(e) => setScheduleForm({...scheduleForm, name: e.target.value})}
                        placeholder="예: 매주 금요일 알림장"
                        className="w-full p-3 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">발송 요일</label>
                        <select
                          value={scheduleForm.dayOfWeek}
                          onChange={(e) => setScheduleForm({...scheduleForm, dayOfWeek: parseInt(e.target.value)})}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                          {dayNames.map((day, idx) => (
                            <option key={idx} value={idx}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">대상 학년</label>
                        <select
                          value={scheduleForm.targetGrade}
                          onChange={(e) => setScheduleForm({
                            ...scheduleForm, 
                            targetGrade: e.target.value,
                            excludedStudents: [] // 학년 변경 시 제외 학생 초기화
                          })}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                          <option value="all">전체</option>
                          {grades.map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 학생 제외 선택 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🚫 제외할 학생 선택 (클릭하면 제외)
                      </label>
                      <div className="p-3 bg-white border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                          {scheduleFilteredStudents.map(student => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => toggleScheduleExcludeStudent(student.id)}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                                (scheduleForm.excludedStudents || []).includes(student.id)
                                  ? 'bg-red-100 text-red-700 line-through'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {student.name}
                              {(scheduleForm.excludedStudents || []).includes(student.id) && (
                                <X size={12} className="inline ml-1" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(scheduleForm.excludedStudents || []).length > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          {scheduleForm.excludedStudents.length}명 제외됨
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">포함 내용</label>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { key: 'includeCurriculum', label: '커리큘럼' },
                          { key: 'includeAttendance', label: '출결' },
                          { key: 'includeExam', label: '성적' },
                          { key: 'includeHomework', label: '과제' },
                          { key: 'includeMemo', label: '📝 메모' }
                        ].map(item => (
                          <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={scheduleForm[item.key]}
                              onChange={(e) => setScheduleForm({...scheduleForm, [item.key]: e.target.checked})}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">수신 대상</label>
                        <select
                          value={scheduleForm.smsTarget}
                          onChange={(e) => setScheduleForm({...scheduleForm, smsTarget: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                          <option value="both">학생 + 학부모</option>
                          <option value="student">학생만</option>
                          <option value="parent">학부모만</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">발신번호</label>
                        <select
                          value={scheduleForm.senderType}
                          onChange={(e) => setScheduleForm({...scheduleForm, senderType: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        >
                          <option value="personal">개인번호</option>
                          <option value="sub">추가번호</option>
                          <option value="main">대표번호</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">추가 메시지 (선택)</label>
                      <textarea
                        value={scheduleForm.additionalMessage}
                        onChange={(e) => setScheduleForm({...scheduleForm, additionalMessage: e.target.value})}
                        placeholder="모든 알림장에 포함될 공통 메시지..."
                        className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                        rows="2"
                      />
                    </div>

                    <button
                      onClick={handleSaveSchedule}
                      className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
                    >
                      {editingSchedule ? '수정 완료' : '설정 저장'}
                    </button>
                  </div>
                </div>
              )}

              {/* 저장된 설정 목록 */}
              {schedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock size={48} className="mx-auto mb-4 opacity-50" />
                  <p>저장된 발송 설정이 없습니다.</p>
                  <p className="text-sm mt-1">새 설정을 추가해보세요!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.map(schedule => (
                    <div key={schedule.id} className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-800">{schedule.name}</h4>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              schedule.isActive !== false 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {schedule.isActive !== false ? '활성' : '비활성'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>
                              📅 {dayNames[schedule.dayOfWeek || 5]} | 
                              👥 {schedule.targetGrade === 'all' ? '전체' : schedule.targetGrade}
                              {schedule.excludedStudents && schedule.excludedStudents.length > 0 && (
                                <span className="text-red-600"> (제외 {schedule.excludedStudents.length}명)</span>
                              )}
                            </p>
                            <p>
                              포함: 
                              {schedule.includeCurriculum && ' 커리큘럼'}
                              {schedule.includeAttendance && ' 출결'}
                              {schedule.includeExam && ' 성적'}
                              {schedule.includeHomework && ' 과제'}
                              {schedule.includeMemo && ' 📝메모'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApplySchedule(schedule)}
                            className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition"
                          >
                            적용하기
                          </button>
                          <button
                            onClick={() => handleEditSchedule(schedule)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 사용 안내 */}
              <div className="mt-6 p-4 bg-amber-50 rounded-xl">
                <h4 className="font-bold text-amber-800 mb-2">💡 사용 방법</h4>
                <ol className="text-sm text-amber-700 space-y-1">
                  <li>1. 자주 사용하는 발송 설정을 저장해두세요.</li>
                  <li>2. 발송할 때 "적용하기" 버튼을 클릭하면 설정이 자동으로 적용됩니다.</li>
                  <li>3. 일괄 발송 탭에서 "발송 준비" → "전체 발송" 순서로 진행하세요.</li>
                </ol>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
