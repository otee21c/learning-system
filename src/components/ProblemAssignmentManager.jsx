import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

const ProblemAssignmentManager = () => {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  
  // 과제 생성 폼
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    dueDate: ''
  });

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadAssignments();
    loadStudents();
  }, []);

  // 과제 선택 시 제출 내역 로드
  useEffect(() => {
    if (selectedAssignment) {
      loadSubmissions(selectedAssignment.id);
    }
  }, [selectedAssignment]);

  // 과제 목록 불러오기
  const loadAssignments = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'problemAssignments'));
      const assignmentList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignments(assignmentList);
    } catch (error) {
      console.error('과제 로드 실패:', error);
      alert('과제를 불러오는데 실패했습니다.');
    }
  };

  // 학생 목록 불러오기
  const loadStudents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'students'));
      const studentList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentList);
    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
    }
  };

  // 제출 내역 불러오기
  const loadSubmissions = async (assignmentId) => {
    try {
      const q = query(
        collection(db, 'problemSubmissions'),
        where('assignmentId', '==', assignmentId)
      );
      const querySnapshot = await getDocs(q);
      const submissionList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmissions(submissionList);
    } catch (error) {
      console.error('제출 내역 로드 실패:', error);
    }
  };

  // 과제 생성
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    
    if (!newAssignment.title || !newAssignment.dueDate) {
      alert('제목과 마감일을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'problemAssignments'), {
        title: newAssignment.title,
        description: newAssignment.description,
        dueDate: newAssignment.dueDate,
        createdAt: Timestamp.now(),
        createdBy: 'admin'
      });

      alert('과제가 생성되었습니다!');
      setNewAssignment({ title: '', description: '', dueDate: '' });
      loadAssignments();
    } catch (error) {
      console.error('과제 생성 실패:', error);
      alert('과제 생성에 실패했습니다.');
    }
  };

  // 과제 삭제
  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('이 과제를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'problemAssignments', assignmentId));
      alert('과제가 삭제되었습니다.');
      loadAssignments();
      if (selectedAssignment?.id === assignmentId) {
        setSelectedAssignment(null);
      }
    } catch (error) {
      console.error('과제 삭제 실패:', error);
      alert('과제 삭제에 실패했습니다.');
    }
  };

  // 제출물 삭제
  const handleDeleteSubmission = async (submissionId, imageUrl) => {
    if (!window.confirm('이 제출물을 삭제하시겠습니까?')) return;

    try {
      // Storage에서 이미지 삭제
      if (imageUrl) {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
      }

      // Firestore에서 제출 기록 삭제
      await deleteDoc(doc(db, 'problemSubmissions', submissionId));
      
      alert('제출물이 삭제되었습니다.');
      loadSubmissions(selectedAssignment.id);
    } catch (error) {
      console.error('제출물 삭제 실패:', error);
      alert('제출물 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
          📝 문제 분석 관리
        </h1>

        {/* 과제 생성 폼 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">+ 새 과제 만들기</h2>
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                과제 제목
              </label>
              <input
                type="text"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 틀린 문제 분석하기"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                과제 설명
              </label>
              <textarea
                value={newAssignment.description}
                onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="과제에 대한 설명을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                마감일
              </label>
              <input
                type="date"
                value={newAssignment.dueDate}
                onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              과제 생성
            </button>
          </form>
        </div>

        {/* 과제 목록 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">📚 생성된 과제 목록</h2>
          
          {assignments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">아직 생성된 과제가 없습니다.</p>
          ) : (
            <div className="grid gap-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedAssignment?.id === assignment.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedAssignment(assignment)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-800">{assignment.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{assignment.description}</p>
                      <p className="text-gray-500 text-sm mt-2">
                        📅 마감일: {assignment.dueDate}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAssignment(assignment.id);
                      }}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 제출 현황 */}
        {selectedAssignment && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              📋 {selectedAssignment.title} - 제출 기록
            </h2>

            {/* 제출 현황 테이블 */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-700">📊 제출 현황</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#374151' }}>학생 이름</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>제출 상태</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}>제출 시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const submission = submissions.find(s => s.studentId === student.id);
                      return (
                        <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px' }}>{student.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {submission ? (
                              <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ 제출</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>❌ 미제출</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {submission ? new Date(submission.submittedAt.seconds * 1000).toLocaleString('ko-KR') : '-'}
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

            {/* 제출물 목록 */}
            {submissions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">아직 제출된 과제가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <div key={submission.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{submission.studentName}</h3>
                        <p className="text-sm text-gray-500">
                          제출 시간: {new Date(submission.submittedAt.seconds * 1000).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSubmission(submission.id, submission.imageUrl)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-all"
                      >
                        삭제
                      </button>
                    </div>

                    {submission.imageUrl && (
                      <div className="mb-4">
                        <a
                          href={submission.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all"
                        >
                          파일 보기
                        </a>
                      </div>
                    )}

                    {submission.aiAnalysis && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-bold text-gray-800 mb-2">🤖 AI 분석 결과:</h4>
                        <p className="text-gray-700 whitespace-pre-wrap">{submission.aiAnalysis}</p>
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

export default ProblemAssignmentManager;