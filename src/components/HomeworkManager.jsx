import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

// 숙제 관리 컴포넌트

const HomeworkManager = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    dueDate: ''
  });

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
      collection(db, 'submissions'),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const submissionList = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(sub => sub.assignmentId === assignmentId);
    setSubmissions(submissionList);
  } catch (error) {
    console.error('제출 기록 불러오기 실패:', error);
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
      await addDoc(collection(db, 'assignments'), {
        ...newAssignment,
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

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <h2>📚 숙제 관리</h2>
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
                onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
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
                onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
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
                onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
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
                <h4 style={{ margin: '0 0 10px 0' }}>{assignment.title}</h4>
                <p style={{ color: '#666', margin: '5px 0' }}>{assignment.description}</p>
                <p style={{ color: '#999', fontSize: '14px', margin: '10px 0 0 0' }}>
                  📅 마감일: {assignment.dueDate}
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
                    {submission.fileUrl && (
                      <a
                        href={submission.fileUrl}
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