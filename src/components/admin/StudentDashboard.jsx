import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  LayoutDashboard, User, Calendar, BookOpen, FileText, MessageSquare, 
  Check, X, Edit2, Trash2, Save, ChevronDown, ChevronUp, Search,
  CheckCircle, XCircle, Clock, AlertCircle
} from 'lucide-react';
import { getTodayMonthWeek } from '../../utils/dateUtils';

const StudentDashboard = ({ students = [] }) => {
  const todayMonthWeek = getTodayMonthWeek();
  
  // 필터 상태
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 데이터 상태
  const [attendanceData, setAttendanceData] = useState([]);
  const [curriculumData, setCurriculumData] = useState([]);
  const [homeworkData, setHomeworkData] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [memoData, setMemoData] = useState([]);
  
  // 편집 상태
  const [editingCell, setEditingCell] = useState(null); // {studentId, field}
  const [editValue, setEditValue] = useState('');
  
  // 확장된 행
  const [expandedRows, setExpandedRows] = useState({});
  
  // 로딩
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 출결 데이터
      const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
      setAttendanceData(attendanceSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      // 커리큘럼 데이터
      const curriculumSnapshot = await getDocs(collection(db, 'curriculums'));
      setCurriculumData(curriculumSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      // 숙제 데이터
      const homeworkSnapshot = await getDocs(collection(db, 'homeworkSubmissions'));
      setHomeworkData(homeworkSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      // 시험 결과 데이터
      const examResultsSnapshot = await getDocs(collection(db, 'examResults'));
      setExamResults(examResultsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      // 메모 데이터
      const memoSnapshot = await getDocs(collection(db, 'studentMemos'));
      setMemoData(memoSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
    setLoading(false);
  };

  // 학생별 출결 상태 가져오기
  const getAttendanceStatus = (studentId) => {
    const record = attendanceData.find(a => 
      a.studentId === studentId && 
      a.month === selectedMonth && 
      a.week === selectedWeek
    );
    return record?.status || '-';
  };

  // 학생별 커리큘럼 가져오기
  const getCurriculum = (studentId) => {
    const record = curriculumData.find(c => 
      c.studentId === studentId && 
      c.month === selectedMonth && 
      c.week === selectedWeek
    );
    return record?.curriculum || '-';
  };

  // 학생별 숙제 현황 가져오기
  const getHomeworkStatus = (studentId) => {
    // 해당 월/주차의 숙제 제출 현황
    const submissions = homeworkData.filter(h => 
      h.studentId === studentId && 
      h.month === selectedMonth && 
      h.week === selectedWeek
    );
    
    // 제출된 숙제 수
    const submitted = submissions.filter(s => s.submitted || s.imageUrl).length;
    
    // 전체 숙제 수 (assignments 컬렉션에서 가져와야 하지만, 간단히 3개로 가정)
    // 나중에 필요하면 수정
    return submitted > 0 ? `${submitted}개 제출` : '미제출';
  };

  // 학생별 최근 성적 가져오기
  const getRecentScore = (studentId) => {
    const results = examResults
      .filter(e => e.studentId === studentId)
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    
    if (results.length > 0 && results[0].score !== undefined) {
      return `${results[0].score}점`;
    }
    return '-';
  };

  // 학생별 메모 가져오기
  const getMemo = (studentId) => {
    const record = memoData.find(m => 
      m.studentId === studentId && 
      m.month === selectedMonth && 
      m.week === selectedWeek
    );
    return record?.memo || '';
  };

  // 출결 상태 아이콘
  const getAttendanceIcon = (status) => {
    switch (status) {
      case '출석': return <CheckCircle className="text-green-500" size={18} />;
      case '지각': return <Clock className="text-yellow-500" size={18} />;
      case '결석': return <XCircle className="text-red-500" size={18} />;
      case '조퇴': return <AlertCircle className="text-orange-500" size={18} />;
      default: return <span className="text-gray-400">-</span>;
    }
  };

  // 출결 상태 변경
  const handleAttendanceChange = async (studentId, newStatus) => {
    try {
      const existing = attendanceData.find(a => 
        a.studentId === studentId && 
        a.month === selectedMonth && 
        a.week === selectedWeek
      );

      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.docId), { status: newStatus });
      } else {
        const student = students.find(s => s.id === studentId);
        await addDoc(collection(db, 'attendance'), {
          studentId,
          studentName: student?.name || '',
          month: selectedMonth,
          week: selectedWeek,
          status: newStatus,
          date: new Date().toISOString()
        });
      }
      loadAllData();
    } catch (error) {
      console.error('출결 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 메모 저장
  const handleMemoSave = async (studentId, memo) => {
    try {
      const existing = memoData.find(m => 
        m.studentId === studentId && 
        m.month === selectedMonth && 
        m.week === selectedWeek
      );

      if (existing) {
        await updateDoc(doc(db, 'studentMemos', existing.docId), { memo });
      } else {
        const student = students.find(s => s.id === studentId);
        await addDoc(collection(db, 'studentMemos'), {
          studentId,
          studentName: student?.name || '',
          month: selectedMonth,
          week: selectedWeek,
          memo,
          createdAt: new Date().toISOString()
        });
      }
      setEditingCell(null);
      loadAllData();
    } catch (error) {
      console.error('메모 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 메모 삭제
  const handleMemoDelete = async (studentId) => {
    if (!window.confirm('메모를 삭제하시겠습니까?')) return;
    
    try {
      const existing = memoData.find(m => 
        m.studentId === studentId && 
        m.month === selectedMonth && 
        m.week === selectedWeek
      );

      if (existing) {
        await deleteDoc(doc(db, 'studentMemos', existing.docId));
        loadAllData();
      }
    } catch (error) {
      console.error('메모 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 행 확장 토글
  const toggleRow = (studentId) => {
    setExpandedRows(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // 검색 필터링된 학생 목록
  const filteredStudents = students.filter(student => 
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 셀 편집 시작
  const startEdit = (studentId, field, currentValue) => {
    setEditingCell({ studentId, field });
    setEditValue(currentValue || '');
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
            <LayoutDashboard className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              학생 대시보드
            </h2>
            <p className="text-gray-500 text-sm">한눈에 모든 학생 현황을 확인하고 관리하세요</p>
          </div>
        </div>

        {/* 필터 영역 */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* 월 선택 */}
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>

          {/* 주차 선택 */}
          <div className="flex items-center gap-2">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {[1,2,3,4,5].map(w => (
                <option key={w} value={w}>{w}주차</option>
              ))}
            </select>
          </div>

          {/* 검색 */}
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="학생 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 새로고침 */}
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 대시보드 테이블 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 w-12"></th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    학생
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-28">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle size={16} />
                    출결
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    커리큘럼
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-28">
                  <div className="flex items-center justify-center gap-2">
                    <BookOpen size={16} />
                    과제
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-24">
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={16} />
                    성적
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} />
                    메모
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-24">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const isExpanded = expandedRows[student.id];
                  const attendanceStatus = getAttendanceStatus(student.id);
                  const curriculum = getCurriculum(student.id);
                  const homeworkStatus = getHomeworkStatus(student.id);
                  const recentScore = getRecentScore(student.id);
                  const memo = getMemo(student.id);
                  const isEditingMemo = editingCell?.studentId === student.id && editingCell?.field === 'memo';

                  return (
                    <React.Fragment key={student.id}>
                      {/* 메인 행 */}
                      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        {/* 확장 버튼 */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRow(student.id)}
                            className="p-1 hover:bg-gray-200 rounded transition"
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </td>

                        {/* 학생 정보 */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.grade} · {student.school || '-'}</p>
                          </div>
                        </td>

                        {/* 출결 */}
                        <td className="px-4 py-3 text-center">
                          <div className="relative inline-block">
                            <select
                              value={attendanceStatus}
                              onChange={(e) => handleAttendanceChange(student.id, e.target.value)}
                              className={`appearance-none px-3 py-1 rounded-full text-sm font-medium cursor-pointer border-0 focus:ring-2 focus:ring-indigo-500 ${
                                attendanceStatus === '출석' ? 'bg-green-100 text-green-700' :
                                attendanceStatus === '지각' ? 'bg-yellow-100 text-yellow-700' :
                                attendanceStatus === '결석' ? 'bg-red-100 text-red-700' :
                                attendanceStatus === '조퇴' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'
                              }`}
                            >
                              <option value="-">-</option>
                              <option value="출석">출석</option>
                              <option value="지각">지각</option>
                              <option value="결석">결석</option>
                              <option value="조퇴">조퇴</option>
                            </select>
                          </div>
                        </td>

                        {/* 커리큘럼 */}
                        <td className="px-4 py-3">
                          <span className={`text-sm ${curriculum === '-' ? 'text-gray-400' : 'text-gray-700'}`}>
                            {curriculum}
                          </span>
                        </td>

                        {/* 과제 */}
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            homeworkStatus === '미제출' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {homeworkStatus}
                          </span>
                        </td>

                        {/* 성적 */}
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-medium ${recentScore === '-' ? 'text-gray-400' : 'text-indigo-600'}`}>
                            {recentScore}
                          </span>
                        </td>

                        {/* 메모 */}
                        <td className="px-4 py-3">
                          {isEditingMemo ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleMemoSave(student.id, editValue);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <button
                                onClick={() => handleMemoSave(student.id, editValue)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-gray-600 truncate max-w-xs cursor-pointer hover:text-indigo-600"
                              onClick={() => startEdit(student.id, 'memo', memo)}
                              title={memo || '클릭하여 메모 추가'}
                            >
                              {memo || <span className="text-gray-400 italic">메모 없음</span>}
                            </div>
                          )}
                        </td>

                        {/* 관리 버튼 */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(student.id, 'memo', memo)}
                              className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                              title="메모 수정"
                            >
                              <Edit2 size={16} />
                            </button>
                            {memo && (
                              <button
                                onClick={() => handleMemoDelete(student.id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                                title="메모 삭제"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 확장 행 - 상세 정보 */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* 연락처 정보 */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h4 className="font-medium text-gray-700 mb-2">📞 연락처</h4>
                                <p className="text-sm text-gray-600">학생: {student.phone || '-'}</p>
                                <p className="text-sm text-gray-600">학부모: {student.parentPhone || '-'}</p>
                              </div>

                              {/* 이번 주 출결 이력 */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h4 className="font-medium text-gray-700 mb-2">📅 {selectedMonth}월 출결</h4>
                                <div className="flex gap-2">
                                  {[1,2,3,4,5].map(week => {
                                    const weekStatus = attendanceData.find(a => 
                                      a.studentId === student.id && 
                                      a.month === selectedMonth && 
                                      a.week === week
                                    )?.status;
                                    return (
                                      <div key={week} className="text-center">
                                        <p className="text-xs text-gray-500 mb-1">{week}주</p>
                                        {getAttendanceIcon(weekStatus)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 최근 메모 이력 */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h4 className="font-medium text-gray-700 mb-2">📝 최근 메모</h4>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                  {memoData
                                    .filter(m => m.studentId === student.id)
                                    .sort((a, b) => (b.month * 10 + b.week) - (a.month * 10 + a.week))
                                    .slice(0, 3)
                                    .map((m, idx) => (
                                      <p key={idx} className="text-xs text-gray-600">
                                        <span className="text-gray-400">{m.month}월 {m.week}주:</span> {m.memo}
                                      </p>
                                    ))
                                  }
                                  {memoData.filter(m => m.studentId === student.id).length === 0 && (
                                    <p className="text-xs text-gray-400">메모 없음</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 푸터 - 요약 */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">전체 학생:</span>
              <span className="font-semibold text-gray-700">{filteredStudents.length}명</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-500" size={16} />
              <span className="text-gray-500">출석:</span>
              <span className="font-semibold text-green-600">
                {filteredStudents.filter(s => getAttendanceStatus(s.id) === '출석').length}명
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="text-red-500" size={16} />
              <span className="text-gray-500">결석:</span>
              <span className="font-semibold text-red-600">
                {filteredStudents.filter(s => getAttendanceStatus(s.id) === '결석').length}명
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-yellow-500" size={16} />
              <span className="text-gray-500">지각:</span>
              <span className="font-semibold text-yellow-600">
                {filteredStudents.filter(s => getAttendanceStatus(s.id) === '지각').length}명
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="bg-white rounded-xl shadow p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">💡 사용 방법</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• <strong>출결</strong>: 드롭다운을 클릭해서 바로 변경 가능</li>
          <li>• <strong>메모</strong>: 셀을 클릭하거나 수정 버튼으로 편집</li>
          <li>• <strong>▼ 버튼</strong>: 클릭하면 학생 상세 정보 확인</li>
          <li>• <strong>월/주차</strong>: 상단 필터로 기간 변경</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentDashboard;
