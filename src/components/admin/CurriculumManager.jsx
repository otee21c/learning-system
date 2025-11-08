import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { getMonthWeek } from '../../utils/dateUtils';

const CurriculumManager = ({ students = [] }) => {
  const [curriculums, setCurriculums] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState(null);
  const [formData, setFormData] = useState({
    weekNumber: '',
    title: '',
    description: '',
    topics: '',
    startDate: '',
    endDate: '',
    materials: '',
    selectedStudents: [] // 선택된 학생 ID 배열
  });

  // 커리큘럼 목록 로드
  useEffect(() => {
    loadCurriculums();
  }, []);

  const loadCurriculums = async () => {
    try {
      const q = query(collection(db, 'curriculums'), orderBy('weekNumber', 'asc'));
      const querySnapshot = await getDocs(q);
      const curriculumList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCurriculums(curriculumList);
    } catch (error) {
      console.error('커리큘럼 로드 실패:', error);
      alert('커리큘럼을 불러오는데 실패했습니다.');
    }
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.weekNumber || !formData.title) {
      alert('주차와 제목은 필수입니다.');
      return;
    }

    if (formData.selectedStudents.length === 0) {
      alert('최소 1명 이상의 학생을 선택해주세요.');
      return;
    }

    try {
      // startDate가 있으면 그것으로, 없으면 현재 날짜로 month 계산
      const dateForMonth = formData.startDate || new Date().toISOString().split('T')[0];
      const { month } = getMonthWeek(dateForMonth);
      
      const curriculumData = {
        weekNumber: parseInt(formData.weekNumber),
        month: month,
        title: formData.title,
        description: formData.description,
        topics: formData.topics.split(',').map(t => t.trim()).filter(t => t),
        startDate: formData.startDate,
        endDate: formData.endDate,
        materials: formData.materials,
        students: formData.selectedStudents, // 선택된 학생 ID 배열
        updatedAt: new Date()
      };

      if (editingCurriculum) {
        // 수정
        await updateDoc(doc(db, 'curriculums', editingCurriculum.id), curriculumData);
        alert('커리큘럼이 수정되었습니다.');
      } else {
        // 신규 등록
        curriculumData.createdAt = new Date();
        await addDoc(collection(db, 'curriculums'), curriculumData);
        alert('커리큘럼이 등록되었습니다.');
      }

      // 초기화
      setFormData({
        weekNumber: '',
        title: '',
        description: '',
        topics: '',
        startDate: '',
        endDate: '',
        materials: '',
        selectedStudents: []
      });
      setShowForm(false);
      setEditingCurriculum(null);
      loadCurriculums();
    } catch (error) {
      console.error('커리큘럼 저장 실패:', error);
      alert('커리큘럼 저장에 실패했습니다.');
    }
  };

  // 수정 버튼
  const handleEdit = (curriculum) => {
    setEditingCurriculum(curriculum);
    setFormData({
      weekNumber: curriculum.weekNumber.toString(),
      title: curriculum.title,
      description: curriculum.description || '',
      topics: curriculum.topics?.join(', ') || '',
      startDate: curriculum.startDate || '',
      endDate: curriculum.endDate || '',
      materials: curriculum.materials || '',
      selectedStudents: curriculum.students || []
    });
    setShowForm(true);
  };

  // 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'curriculums', id));
      alert('커리큘럼이 삭제되었습니다.');
      loadCurriculums();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📅 커리큘럼 관리</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingCurriculum(null);
            setFormData({
              weekNumber: '',
              title: '',
              description: '',
              topics: '',
              startDate: '',
              endDate: '',
              materials: ''
            });
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: showForm ? '#ef4444' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {showForm ? '취소' : '+ 커리큘럼 추가'}
        </button>
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div style={{
          backgroundColor: '#f0f9ff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3>{editingCurriculum ? '커리큘럼 수정' : '새 커리큘럼 등록'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                주차 번호 *
              </label>
              <input
                type="number"
                value={formData.weekNumber}
                onChange={(e) => setFormData({ ...formData, weekNumber: e.target.value })}
                placeholder="예: 5"
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="예: 중학 영어 문법 - 현재완료"
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                설명
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="학습 내용 설명"
                rows="3"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                학습 주제 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={formData.topics}
                onChange={(e) => setFormData({ ...formData, topics: e.target.value })}
                placeholder="예: have + p.p, 경험, 완료, 계속"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  시작일
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  종료일
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                학습 자료
              </label>
              <input
                type="text"
                value={formData.materials}
                onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                placeholder="예: 교재 p.45-52"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            {/* 학생 선택 */}
            <div style={{ marginBottom: '15px', border: '2px solid #e0e0e0', borderRadius: '8px', padding: '15px', backgroundColor: '#fff' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                학생 선택 * (복수 선택 가능)
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                gap: '10px',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '10px',
                backgroundColor: '#f9f9f9',
                borderRadius: '6px'
              }}>
                {students.length > 0 ? (
                  students.map(student => (
                    <label 
                      key={student.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: formData.selectedStudents.includes(student.id) ? '#e0f2fe' : 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!formData.selectedStudents.includes(student.id)) {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!formData.selectedStudents.includes(student.id)) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              selectedStudents: [...formData.selectedStudents, student.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              selectedStudents: formData.selectedStudents.filter(id => id !== student.id)
                            });
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>
                        {student.name} ({student.grade})
                      </span>
                    </label>
                  ))
                ) : (
                  <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                    등록된 학생이 없습니다.
                  </p>
                )}
              </div>
              <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
                선택된 학생: {formData.selectedStudents.length}명
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: '10px 30px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {editingCurriculum ? '수정 완료' : '등록하기'}
            </button>
          </form>
        </div>
      )}

      {/* 커리큘럼 목록 */}
      <div>
        <h3>등록된 커리큘럼 ({curriculums.length}개)</h3>
        {curriculums.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            등록된 커리큘럼이 없습니다.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {curriculums.map(curriculum => (
              <div
                key={curriculum.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: 'white'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        {curriculum.weekNumber}주차
                      </span>
                      {curriculum.month && (
                        <span style={{
                          padding: '3px 10px',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          borderRadius: '10px'
                        }}>
                          {curriculum.month}월
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>
                      {curriculum.title}
                    </h3>
                    {curriculum.description && (
                      <p style={{ margin: '0 0 10px 0', color: '#666' }}>
                        {curriculum.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleEdit(curriculum)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(curriculum.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {curriculum.topics && curriculum.topics.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <strong>학습 주제:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
                      {curriculum.topics.map((topic, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '12px',
                            fontSize: '14px'
                          }}
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                  {curriculum.startDate && (
                    <span>📅 {curriculum.startDate} ~ {curriculum.endDate || '진행중'}</span>
                  )}
                  {curriculum.materials && (
                    <span>📚 {curriculum.materials}</span>
                  )}
                </div>

                {/* 선택된 학생 목록 */}
                {curriculum.students && curriculum.students.length > 0 && (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '12px', 
                    backgroundColor: '#f0fdf4', 
                    borderRadius: '6px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <strong style={{ fontSize: '14px', color: '#15803d' }}>👥 적용 학생 ({curriculum.students.length}명):</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {curriculum.students.map(studentId => {
                        const student = students.find(s => s.id === studentId);
                        return student ? (
                          <span
                            key={studentId}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              borderRadius: '10px',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}
                          >
                            {student.name} ({student.grade})
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumManager;