import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Upload, CheckCircle, Clock, Image as ImageIcon } from 'lucide-react';

const HomeworkSubmission = ({ currentUser }) => {
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);

  // 과제 목록 및 제출 내역 불러오기
  useEffect(() => {
    loadAssignments();
    loadSubmissions();
  }, []);

  const loadAssignments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'assignments'));
      const assignmentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignments(assignmentList);
    } catch (error) {
      console.error('과제 불러오기 실패:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('studentId', '==', currentUser.id)
      );
      const snapshot = await getDocs(q);
      const submissionList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmissions(submissionList);
    } catch (error) {
      console.error('제출 내역 불러오기 실패:', error);
    }
  };

  // 이미지 선택
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedImage(file);
    
    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 숙제 제출
  const handleSubmit = async () => {
    if (!selectedAssignment || !uploadedImage) {
      alert('과제를 선택하고 사진을 업로드하세요!');
      return;
    }

    setUploading(true);

    try {
      // 1. Firebase Storage에 이미지 업로드
      const timestamp = Date.now();
      const fileName = `homework/${currentUser.id}/${selectedAssignment.id}_${timestamp}.jpg`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, uploadedImage);
      const imageUrl = await getDownloadURL(storageRef);

      // 2. Firestore에 제출 정보 저장
      await addDoc(collection(db, 'submissions'), {
        assignmentId: selectedAssignment.id,
        assignmentTitle: selectedAssignment.title,
        studentId: currentUser.id,
        studentName: currentUser.name,
        imageUrl: imageUrl,
        submittedAt: serverTimestamp(),
        status: 'pending', // pending, completed, needs_improvement
        aiResult: null
      });

      alert('숙제가 제출되었습니다! AI 검사 중...');
      
      // 상태 초기화
      setSelectedAssignment(null);
      setUploadedImage(null);
      setImagePreview('');
      
      // 제출 내역 새로고침
      loadSubmissions();

    } catch (error) {
      console.error('제출 실패:', error);
      alert('제출 실패: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 제출 여부 확인
  const isSubmitted = (assignmentId) => {
    return submissions.some(sub => sub.assignmentId === assignmentId);
  };

  // 제출 정보 가져오기
  const getSubmission = (assignmentId) => {
    return submissions.find(sub => sub.assignmentId === assignmentId);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '30px' }}>📝 숙제 제출</h2>

      {/* 과제 목록 */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px' }}>제출할 과제 선택</h3>
        <div style={{ display: 'grid', gap: '15px' }}>
          {assignments.map(assignment => {
            const submitted = isSubmitted(assignment.id);
            const submission = getSubmission(assignment.id);
            
            return (
              <div
                key={assignment.id}
                onClick={() => !submitted && setSelectedAssignment(assignment)}
                style={{
                  padding: '20px',
                  backgroundColor: selectedAssignment?.id === assignment.id ? '#e3f2fd' : 'white',
                  border: `2px solid ${selectedAssignment?.id === assignment.id ? '#2196F3' : '#ddd'}`,
                  borderRadius: '10px',
                  cursor: submitted ? 'default' : 'pointer',
                  opacity: submitted ? 0.6 : 1,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>{assignment.title}</h4>
                    <p style={{ color: '#666', margin: '5px 0', fontSize: '14px' }}>
                      {assignment.description}
                    </p>
                    <p style={{ color: '#999', fontSize: '12px', margin: '10px 0 0 0' }}>
                      📅 마감일: {assignment.dueDate}
                    </p>
                  </div>
                  
                  {submitted && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '5px',
                      padding: '8px 15px',
                      backgroundColor: submission?.status === 'completed' ? '#4CAF50' : '#FF9800',
                      color: 'white',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      {submission?.status === 'completed' ? (
                        <>
                          <CheckCircle size={16} />
                          완료
                        </>
                      ) : (
                        <>
                          <Clock size={16} />
                          검사중
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 제출된 과제의 피드백 표시 */}
                {submitted && submission?.aiResult && (
                  <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                    borderLeft: '4px solid #2196F3'
                  }}>
                    <p style={{ fontSize: '14px', margin: 0 }}>
                      <strong>AI 피드백:</strong> {submission.aiResult.feedback}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 사진 업로드 영역 */}
      {selectedAssignment && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '15px',
          border: '2px solid #2196F3',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginBottom: '20px' }}>
            "{selectedAssignment.title}" 제출하기
          </h3>

          <div style={{
            border: '2px dashed #2196F3',
            borderRadius: '10px',
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#f5f9ff',
            marginBottom: '20px'
          }}>
            {imagePreview ? (
              <div>
                <img 
                  src={imagePreview} 
                  alt="숙제 미리보기"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    borderRadius: '10px',
                    marginBottom: '15px'
                  }}
                />
                <label style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  다른 사진 선택
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            ) : (
              <label style={{ cursor: 'pointer', display: 'block' }}>
                <ImageIcon size={64} style={{ color: '#2196F3', margin: '0 auto 15px' }} />
                <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
                  숙제 사진을 업로드하세요
                </p>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                  클릭하여 파일 선택
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!uploadedImage || uploading}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: uploadedImage && !uploading ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: uploadedImage && !uploading ? 'pointer' : 'not-allowed'
            }}
          >
            {uploading ? '업로드 중...' : '제출하기'}
          </button>
        </div>
      )}

      {/* 제출 내역 */}
      {submissions.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '15px',
          border: '1px solid #ddd'
        }}>
          <h3 style={{ marginBottom: '20px' }}>📋 제출 내역</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            {submissions.map(submission => (
              <div
                key={submission.id}
                style={{
                  padding: '15px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '10px',
                  border: '1px solid #e0e0e0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>
                      {submission.assignmentTitle}
                    </p>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                      제출일: {submission.submittedAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                  <span style={{
                    padding: '5px 15px',
                    backgroundColor: submission.status === 'completed' ? '#4CAF50' : '#FF9800',
                    color: 'white',
                    borderRadius: '15px',
                    fontSize: '12px'
                  }}>
                    {submission.status === 'completed' ? '완료' : '검사중'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeworkSubmission;