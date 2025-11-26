import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { getMonthWeek, getTodayMonthWeek } from '../../utils/dateUtils';
import { ChevronDown, ChevronUp, Filter, Calendar, Users } from 'lucide-react';

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
    selectedStudents: []
  });

  // 필터 상태
  const todayMonthWeek = getTodayMonthWeek();
  const [filterMonth, setFilterMonth] = useState(todayMonthWeek.month);
  const [filterWeek, setFilterWeek] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');

  // 펼침/접힘 상태
  const [expandedIds, setExpandedIds] = useState({});

  const grades = ['중1', '중2', '중3', '고1', '고2', '고3'];

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

  // 필터링된 커리큘럼
  const filteredCurriculums = curriculums.filter(c => {
    // 월 필터
    if (filterMonth !== 'all' && c.month !== filterMonth) return false;
    
    // 주차 필터
    if (filterWeek !== 'all' && c.weekNumber !== parseInt(filterWeek)) return false;
    
    // 학년 필터 (해당 학년 학생이 포함된 커리큘럼만)
    if (filterGrade !== 'all') {
      const gradeStudents = students.filter(s => s.grade === filterGrade);
      const hasGradeStudent = c.students?.some(studentId => 
        gradeStudents.some(s => s.id === studentId)
      );
      if (!hasGradeStudent) return false;
    }
    
    return true;
  });

  // 펼침/접힘 토글
  const toggleExpand = (id) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 전체 펼치기/접기
  const expandAll = () => {
    const allExpanded = {};
    filteredCurriculums.forEach(c => {
      allExpanded[c.id] = true;
    });
    setExpandedIds(allExpanded);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.weekNumber || !formData.title) {
      alert('주차와 제목은 필수입니다.');
      return;
    }

    if (!formData.selectedStudents || formData.selectedStudents.length === 0) {
      alert('최소 1명 이상의 학생을 선택해주세요.');
      return;
    }

    try {
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
        students: formData.selectedStudents,
        updatedAt: new Date()
      };

      if (editingCurriculum) {
        await updateDoc(doc(db, 'curriculums', editingCurriculum.id), curriculumData);
        alert('커리큘럼이 수정되었습니다.');
      } else {
        curriculumData.createdAt = new Date();
        await addDoc(collection(db, 'curriculums'), curriculumData);
        alert('커리큘럼이 등록되었습니다.');
      }

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
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
          📅 커리큘럼 관리
        </h2>
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
              materials: '',
              selectedStudents: []
            });
          }}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            showForm 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showForm ? '취소' : '+ 커리큘럼 추가'}
        </button>
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
          <h3 className="font-bold text-lg mb-4">
            {editingCurriculum ? '커리큘럼 수정' : '새 커리큘럼 등록'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주차 번호 *</label>
                <input
                  type="number"
                  value={formData.weekNumber}
                  onChange={(e) => setFormData({ ...formData, weekNumber: e.target.value })}
                  placeholder="예: 5"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="예: 비문학 독해 전략"
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="커리큘럼에 대한 설명..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                rows="2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                학습 주제 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={formData.topics}
                onChange={(e) => setFormData({ ...formData, topics: e.target.value })}
                placeholder="예: 추론, 비판적 읽기, 구조 분석"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">교재/자료</label>
              <input
                type="text"
                value={formData.materials}
                onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                placeholder="예: 필기 노트+점검 노트+문제집"
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            {/* 학생 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                적용 학생 선택 * (선택: {(formData.selectedStudents || []).length}명)
              </label>
              
              {/* 학년별 빠른 선택 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {grades.map(grade => {
                  const gradeStudents = students.filter(s => s.grade === grade);
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => {
                        const gradeStudentIds = gradeStudents.map(s => s.id);
                        const currentSelected = formData.selectedStudents || [];
                        const allSelected = gradeStudentIds.every(id => currentSelected.includes(id));
                        
                        if (allSelected) {
                          // 해제
                          setFormData({
                            ...formData,
                            selectedStudents: currentSelected.filter(id => !gradeStudentIds.includes(id))
                          });
                        } else {
                          // 선택
                          const newSelected = [...new Set([...currentSelected, ...gradeStudentIds])];
                          setFormData({
                            ...formData,
                            selectedStudents: newSelected
                          });
                        }
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
                    >
                      {grade} 전체 ({gradeStudents.length}명)
                    </button>
                  );
                })}
              </div>

              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
                <div className="flex flex-wrap gap-2">
                  {students.length > 0 ? (
                    students.map(student => (
                      <label
                        key={student.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                          (formData.selectedStudents || []).includes(student.id)
                            ? 'bg-indigo-100 border-2 border-indigo-400'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(formData.selectedStudents || []).includes(student.id)}
                          onChange={(e) => {
                            const currentSelected = formData.selectedStudents || [];
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                selectedStudents: [...currentSelected, student.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                selectedStudents: currentSelected.filter(id => id !== student.id)
                              });
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm font-medium">
                          {student.name} <span className="text-xs text-gray-500">({student.grade})</span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4 w-full">등록된 학생이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
            >
              {editingCurriculum ? '수정 완료' : '등록하기'}
            </button>
          </form>
        </div>
      )}

      {/* 필터 영역 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-gray-500" />
          <span className="font-medium text-gray-700">필터</span>
        </div>
        
        <div className="flex flex-wrap gap-4">
          {/* 월 필터 */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="p-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">전체 월</option>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>

          {/* 주차 필터 */}
          <div className="flex items-center gap-2">
            <select
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">전체 주차</option>
              {[1,2,3,4,5].map(w => (
                <option key={w} value={w}>{w}주차</option>
              ))}
            </select>
          </div>

          {/* 학년 필터 */}
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-400" />
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">전체 학년</option>
              {grades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 전체 펼치기/접기 */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition"
            >
              전체 펼치기
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition"
            >
              전체 접기
            </button>
          </div>
        </div>
      </div>

      {/* 커리큘럼 목록 */}
      <div>
        <h3 className="font-bold text-lg mb-4 text-gray-700">
          등록된 커리큘럼 ({filteredCurriculums.length}개)
          {curriculums.length !== filteredCurriculums.length && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (전체 {curriculums.length}개 중)
            </span>
          )}
        </h3>

        {filteredCurriculums.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>표시할 커리큘럼이 없습니다.</p>
            <p className="text-sm mt-1">필터를 조정하거나 새 커리큘럼을 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCurriculums.map(curriculum => (
              <div
                key={curriculum.id}
                className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition"
              >
                {/* 헤더 (항상 표시) */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(curriculum.id)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{curriculum.weekNumber}주차</span>
                      {curriculum.month && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                          {curriculum.month}월
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-800">{curriculum.title}</h4>
                    <span className="text-xs text-gray-400">
                      ({curriculum.students?.length || 0}명)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(curriculum);
                      }}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(curriculum.id);
                      }}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                    >
                      삭제
                    </button>
                    {expandedIds[curriculum.id] ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </div>

                {/* 상세 내용 (펼쳤을 때만 표시) */}
                {expandedIds[curriculum.id] && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                    {curriculum.description && (
                      <p className="text-sm text-gray-600 mb-3">{curriculum.description}</p>
                    )}

                    {curriculum.topics && curriculum.topics.length > 0 && (
                      <div className="mb-3">
                        <span className="text-sm font-medium text-gray-700">학습 주제: </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {curriculum.topics.map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                      {curriculum.startDate && (
                        <span>📅 {curriculum.startDate} ~ {curriculum.endDate || '진행중'}</span>
                      )}
                      {curriculum.materials && (
                        <span>📚 {curriculum.materials}</span>
                      )}
                    </div>

                    {/* 적용 학생 목록 */}
                    {curriculum.students && curriculum.students.length > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-medium text-green-800 mb-2">
                          👥 적용 학생 ({curriculum.students.length}명)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {curriculum.students.map(studentId => {
                            const student = students.find(s => s.id === studentId);
                            return student ? (
                              <span
                                key={studentId}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"
                              >
                                {student.name} ({student.grade})
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
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
