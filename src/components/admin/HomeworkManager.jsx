import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { getMonthWeek } from '../../utils/dateUtils';

// SMS 발송 함수
const sendSMS = async (phoneNumber, message) => {
  try {
    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        key: import.meta.env.VITE_ALIGO_API_KEY,
        user_id: import.meta.env.VITE_ALIGO_USER_ID,
        sender: import.meta.env.VITE_ALIGO_SENDER,
        receiver: phoneNumber,
        msg: message,
        testmode_yn: 'N' // 실제 발송: N, 테스트: Y
      })
    });

    const data = await response.json();
    
    if (data.result_code === '1') {
      return true;
    } else {
      console.error('SMS 발송 실패:', data);
      return false;
    }
  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return false;
  }
};
// 과제 관리 컴포넌트

const HomeworkManager = ({ students: propStudents = [], branch }) => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState(propStudents);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    dueDate: '',
    taskCode: '',
    sendToStudent: true,   // ★ 학생에게 알림
    sendToParent: true     // ★ 학부모에게 알림
  });
  
  // ★ 전체 제출 현황 뷰
  const [viewMode, setViewMode] = useState('assignments'); // 'assignments' | 'overview'
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [overviewMonth, setOverviewMonth] = useState(new Date().getMonth() + 1);
  const [overviewWeek, setOverviewWeek] = useState(1);
  
  // ★ 미제출자 필터 및 발송 관련
  const [showNotSubmittedOnly, setShowNotSubmittedOnly] = useState(false);
  const [selectedTaskCode, setSelectedTaskCode] = useState(''); // 미제출 체크할 과제 코드
  const [sendToStudentBulk, setSendToStudentBulk] = useState(true);
  const [sendToParentBulk, setSendToParentBulk] = useState(true);
  const [sendingBulk, setSendingBulk] = useState(false);
  
  // 과제 코드 목록 (복합형 삭제)
  const TASK_CODES = {
    numbers: ['1', '2', '3', '4', '5'],
    letters: ['a', 'b', 'c', 'd', 'e']
  };

  // props로 받은 학생 목록이 변경되면 업데이트
  useEffect(() => {
    setStudents(propStudents);
  }, [propStudents]);

  // 과제 목록 불러오기
  useEffect(() => {
    loadAssignments();
    loadAllSubmissions();
  }, [branch]);

  const loadAssignments = async () => {
    try {
      const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let assignmentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // ★ 지점별 필터링 (branch가 없거나 현재 지점과 일치하는 것만)
      if (branch) {
        assignmentList = assignmentList.filter(a => !a.branch || a.branch === branch);
      }
      
      setAssignments(assignmentList);
    } catch (error) {
      console.error('과제 불러오기 실패:', error);
    }
  };

  // ★ 전체 제출 현황 불러오기
  const loadAllSubmissions = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'homeworkSubmissions'));
      let submissionList = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
      
      // ★ 지점별 필터링
      if (branch) {
        submissionList = submissionList.filter(s => !s.branch || s.branch === branch);
      }
      
      setAllSubmissions(submissionList);
    } catch (error) {
      console.error('전체 제출 현황 불러오기 실패:', error);
    }
  };

  // ★ 학생별 과제 코드 체크 여부 (전체 현황용)
  const hasTaskCodeInOverview = (studentId, taskCode) => {
    return allSubmissions.some(s => 
      s.studentId === studentId && 
      s.month === overviewMonth && 
      s.week === overviewWeek &&
      s.taskCode === taskCode
    );
  };

  // ★ 과제 코드 토글 (전체 현황에서)
  const toggleTaskCodeInOverview = async (studentId, taskCode) => {
    try {
      const existing = allSubmissions.find(s => 
        s.studentId === studentId && 
        s.month === overviewMonth && 
        s.week === overviewWeek &&
        s.taskCode === taskCode
      );
      
      if (existing) {
        // 삭제
        await deleteDoc(doc(db, 'homeworkSubmissions', existing.docId));
        setAllSubmissions(prev => prev.filter(s => s.docId !== existing.docId));
      } else {
        // 추가
        const student = students.find(s => s.id === studentId);
        const newSubmission = {
          studentId,
          studentName: student?.name || '',
          month: overviewMonth,
          week: overviewWeek,
          taskCode,
          submitted: true,
          submittedAt: serverTimestamp(),
          branch: branch || ''
        };
        
        const docRef = await addDoc(collection(db, 'homeworkSubmissions'), newSubmission);
        setAllSubmissions(prev => [...prev, { docId: docRef.id, ...newSubmission }]);
      }
    } catch (error) {
      console.error('과제 코드 토글 실패:', error);
    }
  };

  // ★ 미제출자 목록 가져오기
  const getNotSubmittedStudents = (taskCode) => {
    if (!taskCode) return [];
    return students.filter(student => !hasTaskCodeInOverview(student.id, taskCode));
  };

  // ★ 미제출자 일괄 문자 발송
  const sendBulkNotSubmittedSMS = async () => {
    if (!selectedTaskCode) {
      alert('과제 코드를 선택해주세요.');
      return;
    }

    const notSubmitted = getNotSubmittedStudents(selectedTaskCode);
    if (notSubmitted.length === 0) {
      alert('미제출자가 없습니다.');
      return;
    }

    if (!sendToStudentBulk && !sendToParentBulk) {
      alert('발송 대상을 선택해주세요.');
      return;
    }

    // 해당 과제 코드의 과제명 찾기
    const assignment = assignments.find(a => a.taskCode === selectedTaskCode);
    const taskName = assignment?.title || `${selectedTaskCode}번 과제`;

    const targetCount = notSubmitted.length;
    const targetType = [];
    if (sendToStudentBulk) targetType.push('학생');
    if (sendToParentBulk) targetType.push('학부모');

    if (!window.confirm(
      `[${overviewMonth}월 ${overviewWeek}주차 - ${taskName}]\n` +
      `미제출자 ${targetCount}명에게 ${targetType.join(', ')}에게 문자를 발송하시겠습니까?`
    )) {
      return;
    }

    setSendingBulk(true);
    let successCount = 0;
    let failCount = 0;

    for (const student of notSubmitted) {
      const message = `안녕하세요. 오늘의 국어입니다.\n${student.name} 학생의 '${taskName}' 과제가 아직 제출되지 않았습니다.\n확인 부탁드립니다.\n(학원 연락은 010-6600-5979로 편하게 해주세요.)`;

      // 학생에게 발송
      if (sendToStudentBulk && student.phone) {
        try {
          const response = await fetch('https://apis.aligo.in/send/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              key: import.meta.env.VITE_ALIGO_API_KEY,
              user_id: import.meta.env.VITE_ALIGO_USER_ID,
              sender: import.meta.env.VITE_ALIGO_SENDER,
              receiver: student.phone,
              msg: message,
              testmode_yn: 'N'
            })
          });
          const data = await response.json();
          if (data.result_code === '1') successCount++;
          else failCount++;
        } catch (error) {
          console.error('학생 발송 실패:', student.name, error);
          failCount++;
        }
      }

      // 학부모에게 발송
      if (sendToParentBulk && student.parentPhone) {
        try {
          const response = await fetch('https://apis.aligo.in/send/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              key: import.meta.env.VITE_ALIGO_API_KEY,
              user_id: import.meta.env.VITE_ALIGO_USER_ID,
              sender: import.meta.env.VITE_ALIGO_SENDER,
              receiver: student.parentPhone,
              msg: message,
              testmode_yn: 'N'
            })
          });
          const data = await response.json();
          if (data.result_code === '1') successCount++;
          else failCount++;
        } catch (error) {
          console.error('학부모 발송 실패:', student.name, error);
          failCount++;
        }
      }
    }

    setSendingBulk(false);
    alert(`발송 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
  };

  // 학생 제출 기록 불러오기
  const loadSubmissions = async (assignmentId) => {
    try {
      const q = query(
        collection(db, 'homeworkSubmissions'),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const submissionList = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(sub => sub.homeworkId === assignmentId);
      setSubmissions(submissionList);
    } catch (error) {
      console.error('제출 기록 불러오기 실패:', error);
    }
  };

  // 학생 목록 불러오기
  const loadStudents = async () => {
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentList);
    } catch (error) {
      console.error('학생 목록 불러오기 실패:', error);
    }
  };
  
    const handleDeleteSubmission = async (submissionId) => {
      if (!window.confirm('정말 이 제출 기록을 삭제하시겠습니까?')) {
        return;
      }

      try {
        await deleteDoc(doc(db, 'submissions', submissionId));
        // 목록 새로고침
        if (selectedAssignment) {
          loadSubmissions(selectedAssignment.id);
        }
        alert('제출 기록이 삭제되었습니다.');
      } catch (error) {
        console.error('삭제 실패:', error);
        alert('삭제에 실패했습니다.');
      }
  };

  // 수동으로 과제 상태 변경 (개별 확인 예정/완료)
  const handleManualStatusChange = async (studentId, studentName, status) => {
    if (!selectedAssignment) return;

    try {
      // 해당 학생의 기존 제출 기록 찾기
      const existingSubmission = submissions.find(sub => 
        sub.studentId === studentId || sub.studentName === studentName
      );

      if (existingSubmission) {
        // 기존 기록 업데이트
        await updateDoc(doc(db, 'homeworkSubmissions', existingSubmission.id), {
          manualStatus: status,
          updatedAt: serverTimestamp()
        });
      } else {
        // 새 기록 생성
        const { month, week } = getMonthWeek(selectedAssignment.dueDate);
        await addDoc(collection(db, 'homeworkSubmissions'), {
          homeworkId: selectedAssignment.id,
          studentId: studentId,
          studentName: studentName,
          month: month,
          week: week,
          manualStatus: status,  // 수동 상태
          submitted: false,
          submittedAt: serverTimestamp()
        });
      }

      // 목록 새로고침
      loadSubmissions(selectedAssignment.id);
    } catch (error) {
      console.error('상태 변경 실패:', error);
      alert('상태 변경에 실패했습니다.');
    }
  };

  // 과제 생성
  const handleCreateAssignment = async (e) => {
    e.preventDefault();

    if (!newAssignment.title || !newAssignment.dueDate) {
      alert('제목과 마감일을 입력하세요!');
      return;
    }

    try {
      const { month, week } = getMonthWeek(newAssignment.dueDate);
      
      await addDoc(collection(db, 'assignments'), {
        ...newAssignment,
        month: month,
        week: week,
        taskCode: newAssignment.taskCode || '',
        sendToStudent: newAssignment.sendToStudent,   // ★ 발송 대상
        sendToParent: newAssignment.sendToParent,     // ★ 발송 대상
        branch: branch || '',                          // ★ 지점 정보
        createdAt: serverTimestamp(),
        status: 'active'
      });

      alert('과제가 생성되었습니다!');
      setNewAssignment({ 
        title: '', 
        description: '', 
        dueDate: '', 
        taskCode: '',
        sendToStudent: true,
        sendToParent: true
      });
      setShowCreateForm(false);
      loadAssignments();
    } catch (error) {
      console.error('과제 생성 실패:', error);
      alert('과제 생성 실패: ' + error.message);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('정말 이 과제를 삭제하시겠습니까?')) {
      return;
    }

    try {
      // 1. 먼저 이 과제의 모든 제출물 삭제
      const submissionsRef = collection(db, 'homeworkSubmissions');
      const q = query(submissionsRef, where('assignmentId', '==', assignmentId));
      const submissionsSnapshot = await getDocs(q);
      
      // 모든 제출물 삭제
      const deletePromises = submissionsSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePromises);

      // 2. 과제 삭제
      await deleteDoc(doc(db, 'assignments', assignmentId));
      
      // 목록에서 제거
      setAssignments(assignments.filter(a => a.id !== assignmentId));
      alert('과제가 삭제되었습니다.');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 학생 선택/해제
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // 전체 선택/해제
  const toggleAllStudents = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  // 과제 알림 발송
  const handleSendNotification = async (assignment) => {
    if (selectedStudents.length === 0) {
      alert('발송할 학생을 선택해주세요.');
      return;
    }

    if (!window.confirm(`선택한 ${selectedStudents.length}명의 학생에게 알림을 발송하시겠습니까?`)) {
      return;
    }

    try {
      // 선택된 학생들만 필터링
      const selectedStudentsList = students.filter(s => selectedStudents.includes(s.id));
      
      const submittedStudents = submissions.filter(sub => 
        sub.homeworkId === assignment.id && selectedStudents.includes(sub.studentId)
      );
      const submittedStudentIds = submittedStudents.map(sub => sub.studentId);
      const notSubmittedStudents = selectedStudentsList.filter(student => 
        !submittedStudentIds.includes(student.id)
      );

      let successCount = 0;
      let failCount = 0;

      // 제출한 학생들에게 메시지 발송
      for (const submission of submittedStudents) {
        const student = students.find(s => s.id === submission.studentId);
        if (student && student.phone) {
          const message = `[과제 제출 완료]\n${student.name} 학생\n과제: ${assignment.title}\n제출 시간: ${new Date(submission.submittedAt.seconds * 1000).toLocaleString('ko-KR')}\n\n오늘의 과제를 잘 제출했어요. 오늘도 마음 따뜻한 1등급을 위해!`;
          
          // SMS 발송
          const sent = await sendSMS(student.phone, message);
          if (sent) {
            console.log('✓ 발송 성공:', student.name);
            successCount++;
          } else {
            console.log('✗ 발송 실패:', student.name);
            failCount++;
          }
        }
      }

      // 미제출 학생들에게 메시지 발송
      for (const student of notSubmittedStudents) {
        if (student.phone) {
          const message = `[과제 미제출 알림]\n${student.name} 학생\n과제: ${assignment.title}\n마감일: ${assignment.dueDate}\n\n오늘의 과제를 아직 제출하지 않았어요. 소중한 나의 꿈을 향해서 시작하자!`;
          
          // SMS 발송
          const sent = await sendSMS(student.phone, message);
          if (sent) {
            console.log('✓ 발송 성공:', student.name);
            successCount++;
          } else {
            console.log('✗ 발송 실패:', student.name);
            failCount++;
          }
        }
      }

      alert(`알림 발송 완료!\n제출: ${submittedStudents.length}명\n미제출: ${notSubmittedStudents.length}명`);
    } catch (error) {
      console.error('알림 발송 실패:', error);
      alert('알림 발송에 실패했습니다.');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2>📚 과제 관리</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setViewMode('assignments')}
            style={{
              padding: '10px 20px',
              backgroundColor: viewMode === 'assignments' ? '#4F46E5' : '#E5E7EB',
              color: viewMode === 'assignments' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            📋 과제 목록
          </button>
          <button
            onClick={() => setViewMode('overview')}
            style={{
              padding: '10px 20px',
              backgroundColor: viewMode === 'overview' ? '#4F46E5' : '#E5E7EB',
              color: viewMode === 'overview' ? 'white' : '#374151',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            📊 전체 현황표
          </button>
        </div>
      </div>

      {/* ★ 전체 현황표 뷰 */}
      {viewMode === 'overview' && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <h3 className="text-lg font-bold">학생별 과제 제출 현황</h3>
            <select
              value={overviewMonth}
              onChange={(e) => setOverviewMonth(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
            <select
              value={overviewWeek}
              onChange={(e) => setOverviewWeek(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {[1,2,3,4,5].map(w => (
                <option key={w} value={w}>{w}주차</option>
              ))}
            </select>
            {branch && (
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                📍 {branch}
              </span>
            )}
          </div>

          {/* ★ 미제출자 알림 발송 섹션 */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h4 className="font-bold text-orange-800 mb-3">📱 미제출자 알림 발송</h4>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">과제 코드:</label>
                <select
                  value={selectedTaskCode}
                  onChange={(e) => setSelectedTaskCode(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">선택</option>
                  <optgroup label="숫자형">
                    {TASK_CODES.numbers.map(code => (
                      <option key={code} value={code}>{code}번</option>
                    ))}
                  </optgroup>
                  <optgroup label="알파벳형">
                    {TASK_CODES.letters.map(code => (
                      <option key={code} value={code}>{code}번</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToStudentBulk}
                    onChange={(e) => setSendToStudentBulk(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">학생</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToParentBulk}
                    onChange={(e) => setSendToParentBulk(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">학부모</span>
                </label>
              </div>

              <button
                onClick={sendBulkNotSubmittedSMS}
                disabled={sendingBulk || !selectedTaskCode}
                className={`px-4 py-2 rounded-lg text-sm font-bold ${
                  sendingBulk || !selectedTaskCode
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {sendingBulk ? '발송 중...' : '📤 미제출자 알림 발송'}
              </button>

              {selectedTaskCode && (
                <span className="text-sm text-orange-700 font-medium">
                  미제출: {getNotSubmittedStudents(selectedTaskCode).length}명
                </span>
              )}
            </div>

            {/* 미제출자 미리보기 */}
            {selectedTaskCode && getNotSubmittedStudents(selectedTaskCode).length > 0 && (
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-xs text-gray-600 mb-2">미제출자 목록:</p>
                <div className="flex flex-wrap gap-2">
                  {getNotSubmittedStudents(selectedTaskCode).map(student => (
                    <span 
                      key={student.id}
                      className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                    >
                      {student.name} ({student.grade})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left sticky left-0 bg-gray-100">학생</th>
                  <th className="border px-2 py-2 text-center bg-blue-50" colSpan={5}>숫자형 (1~5)</th>
                  <th className="border px-2 py-2 text-center bg-green-50" colSpan={5}>알파벳형 (a~e)</th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 text-left sticky left-0 bg-gray-50">이름</th>
                  {TASK_CODES.numbers.map(code => (
                    <th key={code} className="border px-2 py-1 text-center text-xs bg-blue-50">{code}</th>
                  ))}
                  {TASK_CODES.letters.map(code => (
                    <th key={code} className="border px-2 py-1 text-center text-xs bg-green-50">{code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border px-3 py-2 font-medium sticky left-0 bg-inherit">
                      {student.name}
                      <span className="text-xs text-gray-500 ml-1">{student.grade}</span>
                    </td>
                    {TASK_CODES.numbers.map(code => (
                      <td key={code} className="border px-1 py-1 text-center">
                        <button
                          onClick={() => toggleTaskCodeInOverview(student.id, code)}
                          className={`w-6 h-6 rounded text-xs font-bold transition ${
                            hasTaskCodeInOverview(student.id, code)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                          }`}
                        >
                          {hasTaskCodeInOverview(student.id, code) ? '✓' : ''}
                        </button>
                      </td>
                    ))}
                    {TASK_CODES.letters.map(code => (
                      <td key={code} className="border px-1 py-1 text-center">
                        <button
                          onClick={() => toggleTaskCodeInOverview(student.id, code)}
                          className={`w-6 h-6 rounded text-xs font-bold transition ${
                            hasTaskCodeInOverview(student.id, code)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
                          }`}
                        >
                          {hasTaskCodeInOverview(student.id, code) ? '✓' : ''}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            <p>💡 각 칸을 클릭하면 제출 상태가 토글됩니다. 학생이 과제 제출 시 자동 체크됩니다.</p>
            <p>• 숫자형(1~5): 파란색 | 알파벳형(a~e): 초록색</p>
          </div>
        </div>
      )}

      {/* 기존 과제 목록 뷰 */}
      {viewMode === 'assignments' && (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '10px'
          }}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {showCreateForm ? '취소' : '+ 새 과제'}
            </button>
          </div>

      {/* 과제 생성 폼 */}
      {showCreateForm && (
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '30px'
        }}>
          <h3>새 과제 만들기</h3>
          <form onSubmit={handleCreateAssignment}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                과제 제목 *
              </label>
              <input
                type="text"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                placeholder="예: 구구단 2단 쓰기"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                설명
              </label>
              <textarea
                value={newAssignment.description}
                onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                placeholder="공책에 2단을 5번 또박또박 쓰세요"
                rows="3"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                마감일 *
              </label>
              <input
                type="date"
                value={newAssignment.dueDate}
                onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              />
            </div>

            {/* ★ 과제 코드 선택 */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                과제 코드 (자동 체크용)
              </label>
              <select
                value={newAssignment.taskCode}
                onChange={(e) => setNewAssignment({ ...newAssignment, taskCode: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '5px',
                  border: '1px solid #ddd'
                }}
              >
                <option value="">선택 안함 (수동 관리)</option>
                <optgroup label="숫자형">
                  <option value="1">1번 과제</option>
                  <option value="2">2번 과제</option>
                  <option value="3">3번 과제</option>
                  <option value="4">4번 과제</option>
                  <option value="5">5번 과제</option>
                </optgroup>
                <optgroup label="알파벳형">
                  <option value="a">a번 과제</option>
                  <option value="b">b번 과제</option>
                  <option value="c">c번 과제</option>
                  <option value="d">d번 과제</option>
                  <option value="e">e번 과제</option>
                </optgroup>
              </select>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                💡 코드 선택 시, 학생이 이 과제를 제출하면 대시보드에 자동 체크됩니다.
              </p>
            </div>

            {/* ★ 미제출 알림 발송 대상 설정 */}
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                📱 미제출 자동 알림 발송 대상
              </label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newAssignment.sendToStudent}
                    onChange={(e) => setNewAssignment({ ...newAssignment, sendToStudent: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>학생에게 발송</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newAssignment.sendToParent}
                    onChange={(e) => setNewAssignment({ ...newAssignment, sendToParent: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>학부모님께 발송</span>
                </label>
              </div>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                ⏰ 마감일 다음날 오후 1시에 미제출자에게 자동 발송됩니다.
              </p>
            </div>

            <button
              type="submit"
              style={{
                padding: '12px 30px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              과제 생성
            </button>
          </form>
        </div>
      )}

      {/* 과제 목록 */}
      <div>
        <h3>현재 과제 목록</h3>
        {assignments.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
            아직 생성된 과제가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {assignments.map(assignment => (
              <div
                key={assignment.id}
                onClick={() => {
                  setSelectedAssignment(assignment);
                  loadSubmissions(assignment.id);
                }}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #ddd',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>{assignment.title}</h4>
                  {assignment.taskCode && (
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: TASK_CODES.numbers.includes(assignment.taskCode) ? '#dbeafe' : '#dcfce7',
                      color: TASK_CODES.numbers.includes(assignment.taskCode) ? '#1d4ed8' : '#15803d',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      borderRadius: '12px'
                    }}>
                      코드: {assignment.taskCode}
                    </span>
                  )}
                  {assignment.month && assignment.week && (
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      borderRadius: '12px'
                    }}>
                      {assignment.month}월 {assignment.week}주차
                    </span>
                  )}
                </div>
                <p style={{ color: '#666', margin: '5px 0' }}>{assignment.description}</p>
                <p style={{ color: '#999', fontSize: '14px', margin: '10px 0 0 0' }}>
                  📅 마감일: {assignment.dueDate}
                  <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendNotification(assignment);
                  }}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  📱 알림 발송
                </button>
                  <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAssignment(assignment.id);
                  }}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  🗑️ 삭제
                </button>
                </p>
              </div>
            ))}
          </div>
        )}
        {/* 선택된 과제의 제출 기록 */}
        {selectedAssignment && (
          <div style={{ marginTop: '30px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              📝 {selectedAssignment.title} - 제출 기록
            </h3>
            {/* 제출 현황 테이블 */}
              <div style={{ marginTop: '20px', marginBottom: '30px' }}>
                <h4 style={{ marginBottom: '15px', color: '#666' }}>📊 제출 현황</h4>
                <div style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  backgroundColor: 'white'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>학생 이름</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>제출 상태</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>수동 상태</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>제출 시간</th>
                      </tr>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                  <input 
                    type="checkbox"
                    checked={selectedStudents.length === students.length && students.length > 0}
                    onChange={toggleAllStudents}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </th>
                    </thead>
                    <tbody>
                      {students.map(student => {
                        const submission = submissions.find(sub => sub.studentName === student.name || sub.studentId === student.id);
                        const manualStatus = submission?.manualStatus || '';
                        
                        // 상태 결정: 수동 상태 > 제출 여부
                        const getDisplayStatus = () => {
                          if (manualStatus === '개별확인예정') return { text: '📋 개별확인 예정', color: '#f59e0b', bg: '#fef3c7' };
                          if (manualStatus === '개별확인완료') return { text: '✔️ 개별확인 완료', color: '#10b981', bg: '#d1fae5' };
                          if (submission && (submission.submitted || submission.imageUrl || submission.files)) {
                            return { text: '✅ 제출', color: '#10b981', bg: '#d1fae5' };
                          }
                          return { text: '❌ 미제출', color: '#ef4444', bg: '#fee2e2' };
                        };
                        
                        const displayStatus = getDisplayStatus();
                        
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudentSelection(student.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                  </td>
                            <td style={{ padding: '12px' }}>{student.name}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ 
                                color: displayStatus.color, 
                                fontWeight: 'bold',
                                backgroundColor: displayStatus.bg,
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '13px'
                              }}>
                                {displayStatus.text}
                              </span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <select
                                value={manualStatus}
                                onChange={(e) => handleManualStatusChange(student.id, student.name, e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #ddd',
                                  backgroundColor: manualStatus ? '#f0f9ff' : 'white',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                              >
                                <option value="">선택</option>
                                <option value="개별확인예정">📋 개별확인 예정</option>
                                <option value="개별확인완료">✔️ 개별확인 완료</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {submission?.submittedAt ? new Date(submission.submittedAt.seconds * 1000).toLocaleString('ko-KR') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderTop: '1px solid #ddd', textAlign: 'right' }}>
                    <strong>제출률: {submissions.length}/{students.length} ({students.length > 0 ? Math.round((submissions.length / students.length) * 100) : 0}%)</strong>
                  </div>
                </div>
              </div>

            {submissions.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                아직 제출한 학생이 없습니다.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {submissions.map(submission => (
                  <div
                    key={submission.id}
                    style={{
                      backgroundColor: 'white',
                      padding: '20px',
                      borderRadius: '10px',
                      border: '1px solid #ddd'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <p style={{ fontWeight: 'bold', fontSize: '16px' }}>
                          {submission.studentName || '학생'}
                        </p>
                        <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
                          제출 시간: {submission.submittedAt && new Date(submission.submittedAt.seconds * 1000).toLocaleString('ko-KR')}
                        </p>
                        {submission.files && (
                          <p style={{ color: '#4CAF50', fontSize: '13px', marginTop: '3px' }}>
                            📎 첨부파일 {submission.files.length}개
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSubmission(submission.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          borderRadius: '5px',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                    
                    {/* 모든 첨부 파일/이미지 표시 */}
                    {submission.files && submission.files.length > 0 && (
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                        gap: '10px',
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '8px'
                      }}>
                        {submission.files.map((file, index) => {
                          const isImage = file.type?.startsWith('image/') || 
                                          file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                          
                          return (
                            <div key={index} style={{ 
                              border: '1px solid #ddd', 
                              borderRadius: '8px', 
                              overflow: 'hidden',
                              backgroundColor: 'white'
                            }}>
                              {isImage ? (
                                <a href={file.url} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={file.url} 
                                    alt={`첨부 ${index + 1}`}
                                    style={{ 
                                      width: '100%', 
                                      height: '120px', 
                                      objectFit: 'cover',
                                      cursor: 'pointer'
                                    }}
                                  />
                                </a>
                              ) : (
                                <div style={{ 
                                  height: '120px', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  backgroundColor: '#f0f0f0'
                                }}>
                                  <span style={{ fontSize: '12px', color: '#666' }}>📄 파일</span>
                                </div>
                              )}
                              <div style={{ padding: '8px', textAlign: 'center' }}>
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '12px',
                                    color: '#4CAF50',
                                    textDecoration: 'none'
                                  }}
                                >
                                  {index + 1}번 파일 보기
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* 기존 imageUrl 필드 지원 (하위 호환) */}
                    {submission.imageUrl && !submission.files && (
                      <div style={{ marginTop: '10px' }}>
                        <a href={submission.imageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={submission.imageUrl} 
                            alt="제출 이미지"
                            style={{ 
                              maxWidth: '200px', 
                              borderRadius: '8px',
                              border: '1px solid #ddd'
                            }}
                          />
                        </a>
                      </div>
                    )}
                    
                    {submission.feedback && (
                      <div style={{
                        marginTop: '15px',
                        padding: '15px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '5px'
                      }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>AI 피드백:</p>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{submission.feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default HomeworkManager;