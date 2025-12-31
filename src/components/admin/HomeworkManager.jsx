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
    dueDate: ''
  });

  // props로 받은 학생 목록이 변경되면 업데이트
  useEffect(() => {
    setStudents(propStudents);
  }, [propStudents]);

  // 과제 목록 불러오기
  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const assignmentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignments(assignmentList);
    } catch (error) {
      console.error('과제 불러오기 실패:', error);
    }
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
        createdAt: serverTimestamp(),
        status: 'active'
      });

      alert('과제가 생성되었습니다!');
      setNewAssignment({ title: '', description: '', dueDate: '' });
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
        marginBottom: '30px'
      }}>
        <h2>📚 과제 관리</h2>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 'bold', fontSize: '16px' }}>
                          {submission.studentName || '학생'}
                        </p>
                        <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
                          제출 시간: {submission.submittedAt && new Date(submission.submittedAt.seconds * 1000).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      {submission.files?.[0]?.url && (
                        <a
                          href={submission.files?.[0]?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            borderRadius: '5px',
                            textDecoration: 'none'
                          }}
                        >
                          파일 보기
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteSubmission(submission.id)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          borderRadius: '5px',
                          border: 'none',
                          cursor: 'pointer',
                          marginLeft: '10px'
                        }}
                      >
                        삭제
                      </button>
                    </div>
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
    </div>
  );
};

export default HomeworkManager;