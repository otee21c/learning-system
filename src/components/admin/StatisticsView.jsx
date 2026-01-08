import React, { useState } from 'react';
import { User, TrendingUp, BarChart3, Edit3, Trash2, Save, X, Filter } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getTodayMonthWeek } from '../../utils/dateUtils';

export default function StatisticsView({ students, exams, branch }) {
  // 월/주차 선택 (기본값: 현재 월/주차)
  const todayMonthWeek = getTodayMonthWeek();
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  
  // 시험 종류 필터
  const [selectedExamType, setSelectedExamType] = useState('all');
  
  // 수정 모드
  const [editingExam, setEditingExam] = useState(null); // { studentId, examIndex, data }
  const [editForm, setEditForm] = useState({
    examTitle: '',
    totalScore: '',
    percentage: '',
    note: '' // 비고 추가
  });
  
  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { studentId, examIndex }

  // 선택한 월/주차에 해당하는 시험만 필터링
  const filteredExams = exams.filter(exam => 
    exam.month === selectedMonth && exam.week === selectedWeek
  );
  
  // 선택한 월/주차의 시험 ID 목록
  const filteredExamIds = filteredExams.map(exam => exam.id);
  
  // 학생 데이터를 필터링 (선택한 월/주차의 시험만 포함)
  const filteredStudents = students.map(student => {
    let studentExams = student.exams?.filter(exam => 
      filteredExamIds.includes(exam.examId) ||
      (exam.manualEntry && exam.month === selectedMonth && exam.week === selectedWeek)
    ) || [];
    
    // 시험 종류 필터 적용
    if (selectedExamType !== 'all') {
      studentExams = studentExams.filter(exam => 
        exam.examTitle?.includes(selectedExamType) || 
        exam.examType === selectedExamType
      );
    }
    
    return {
      ...student,
      exams: studentExams
    };
  });

  // 시험 종류 목록 추출 (중복 제거)
  const examTypes = [...new Set(
    students.flatMap(s => s.exams || [])
      .filter(e => 
        filteredExamIds.includes(e.examId) ||
        (e.manualEntry && e.month === selectedMonth && e.week === selectedWeek)
      )
      .map(e => e.examTitle || e.examType || '기타')
  )];

  // 전체 평균 계산
  const calculateOverallStats = () => {
    const allExams = filteredStudents.flatMap(s => s.exams || []);
    if (allExams.length === 0) return { avgScore: 0, avgPercentage: 0, totalExams: 0 };

    const avgScore = allExams.reduce((sum, e) => sum + (e.totalScore || 0), 0) / allExams.length;
    const avgPercentage = allExams.reduce((sum, e) => sum + parseFloat(e.percentage || 0), 0) / allExams.length;
    const totalExams = filteredStudents.reduce((sum, s) => sum + (s.exams?.length || 0), 0);

    return {
      avgScore: avgScore.toFixed(1),
      avgPercentage: avgPercentage.toFixed(1),
      totalExams
    };
  };

  // 학생별 평균 계산
  const calculateStudentAvg = (student) => {
    if (!student.exams || student.exams.length === 0) return { avgScore: 0, avgPercentage: 0 };

    const avgScore = student.exams.reduce((sum, e) => sum + (e.totalScore || 0), 0) / student.exams.length;
    const avgPercentage = student.exams.reduce((sum, e) => sum + parseFloat(e.percentage || 0), 0) / student.exams.length;

    return {
      avgScore: avgScore.toFixed(1),
      avgPercentage: avgPercentage.toFixed(1)
    };
  };

  // 최근 성적 변화
  const getRecentTrend = (student) => {
    if (!student.exams || student.exams.length < 2) return null;

    const recentExams = student.exams.slice(-2);
    const diff = (recentExams[1].totalScore || 0) - (recentExams[0].totalScore || 0);

    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
      value: Math.abs(diff)
    };
  };

  // 수정 시작
  const handleEditStart = (student, examIndex) => {
    const exam = student.exams[examIndex];
    
    setEditingExam({
      studentId: student.id,
      studentDocId: student.docId, // Firebase 문서 ID
      filteredIndex: examIndex,
      originalExam: exam // 원본 시험 데이터 저장
    });
    setEditForm({
      examTitle: exam.examTitle || '',
      totalScore: exam.totalScore?.toString() || '',
      percentage: exam.percentage?.toString() || '',
      note: exam.note || '' // 비고 추가
    });
  };

  // 수정 저장
  const handleEditSave = async () => {
    if (!editingExam) return;
    
    try {
      const student = students.find(s => s.id === editingExam.studentId);
      if (!student || !student.exams) {
        alert('학생 정보를 찾을 수 없습니다.');
        return;
      }
      
      const originalExam = editingExam.originalExam;
      const hasScore = editForm.totalScore && editForm.totalScore.trim() !== '';
      
      // 수정할 시험 찾아서 업데이트
      const updatedExams = student.exams.map(e => {
        const isSameExam = 
          e.examTitle === originalExam.examTitle &&
          e.totalScore === originalExam.totalScore &&
          e.date === originalExam.date &&
          e.month === originalExam.month &&
          e.week === originalExam.week;
        
        if (isSameExam) {
          return {
            ...e,
            examTitle: editForm.examTitle,
            totalScore: hasScore ? (parseInt(editForm.totalScore) || 0) : null,
            percentage: editForm.percentage || null,
            note: editForm.note || '', // 비고 저장
            modifiedAt: new Date().toISOString()
          };
        }
        return e;
      });
      
      // docId 사용 (Firebase 문서 ID)
      const docId = editingExam.studentDocId || student.docId || editingExam.studentId;
      await updateDoc(doc(db, 'students', docId), {
        exams: updatedExams
      });
      
      setEditingExam(null);
      setEditForm({ examTitle: '', totalScore: '', percentage: '', note: '' });
      alert('성적이 수정되었습니다.');
      
      // 페이지 새로고침으로 데이터 반영
      window.location.reload();
      
    } catch (error) {
      console.error('성적 수정 실패:', error);
      alert('성적 수정에 실패했습니다: ' + error.message);
    }
  };

  // 수정 취소
  const handleEditCancel = () => {
    setEditingExam(null);
    setEditForm({ examTitle: '', totalScore: '', percentage: '', note: '' });
  };

  // 삭제 확인
  const handleDeleteConfirm = (student, examIndex) => {
    const exam = student.exams[examIndex];
    
    setDeleteConfirm({
      studentId: student.id,
      studentDocId: student.docId, // Firebase 문서 ID
      studentName: student.name,
      exam: exam, // 시험 데이터 전체 저장
      examTitle: exam.examTitle || '시험'
    });
  };

  // 삭제 실행
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      const student = students.find(s => s.id === deleteConfirm.studentId);
      if (!student || !student.exams) {
        alert('학생 정보를 찾을 수 없습니다.');
        return;
      }
      
      // 삭제할 시험을 더 정확하게 찾기
      const examToDelete = deleteConfirm.exam;
      const updatedExams = student.exams.filter(e => {
        // 모든 필드가 일치하는 시험만 제외
        const isSameExam = 
          e.examTitle === examToDelete.examTitle &&
          e.totalScore === examToDelete.totalScore &&
          e.date === examToDelete.date &&
          e.month === examToDelete.month &&
          e.week === examToDelete.week;
        return !isSameExam;
      });
      
      // 실제로 삭제되었는지 확인
      if (updatedExams.length === student.exams.length) {
        alert('삭제할 시험을 찾을 수 없습니다.');
        return;
      }
      
      // docId 사용 (Firebase 문서 ID)
      const docId = deleteConfirm.studentDocId || student.docId || deleteConfirm.studentId;
      await updateDoc(doc(db, 'students', docId), {
        exams: updatedExams
      });
      
      setDeleteConfirm(null);
      alert('성적이 삭제되었습니다.');
      
      // 페이지 새로고침으로 데이터 반영
      window.location.reload();
      
    } catch (error) {
      console.error('성적 삭제 실패:', error);
      alert('성적 삭제에 실패했습니다: ' + error.message);
    }
  };

  const overallStats = calculateOverallStats();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          학생별 성적 통계
        </h2>
        
        {/* 월/주차 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800">조회 기간 선택</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">월 선택</label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">주차 선택</label>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">시험 종류</label>
              <select
                value={selectedExamType}
                onChange={(e) => setSelectedExamType(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">전체 시험</option>
                {examTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600 bg-white p-3 rounded-lg flex items-center gap-2">
            <Filter size={16} className="text-indigo-500" />
            <span>선택된 기간: <span className="font-semibold text-indigo-600">{selectedMonth}월 {selectedWeek}주차</span></span>
            {selectedExamType !== 'all' && (
              <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                {selectedExamType}
              </span>
            )}
            {filteredExams.length > 0 && (
              <span className="ml-2 text-gray-500">({filteredExams.length}개 시험)</span>
            )}
          </div>
        </div>
        
        {/* 전체 평균 통계 */}
        {filteredStudents.some(s => s.exams && s.exams.length > 0) && (
          <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200">
            <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
              <BarChart3 size={24} />
              전체 평균
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <p className="text-sm text-gray-600 mb-1">평균 점수</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {overallStats.avgScore}점
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <p className="text-sm text-gray-600 mb-1">평균 정답률</p>
                <p className="text-3xl font-bold text-green-600">
                  {overallStats.avgPercentage}%
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <p className="text-sm text-gray-600 mb-1">총 응시 횟수</p>
                <p className="text-3xl font-bold text-blue-600">
                  {overallStats.totalExams}회
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 학생별 통계 */}
        <div className="space-y-6">
          {filteredStudents.map((student) => {
            const stats = calculateStudentAvg(student);
            const trend = getRecentTrend(student);

            return (
              <div key={student.id} className="border-2 border-gray-200 rounded-2xl p-6 bg-gradient-to-r from-gray-50 to-purple-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                      <User className="text-white" size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">{student.name}</h3>
                      <p className="text-sm text-gray-600">{student.grade}</p>
                    </div>
                  </div>
                  <div className="text-center px-5 py-3 bg-white rounded-xl shadow-sm">
                    <p className="text-xs text-gray-500">응시 횟수</p>
                    <p className="text-2xl font-bold text-purple-600">{student.exams?.length || 0}</p>
                  </div>
                </div>

                {student.exams && student.exams.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">평균 점수</p>
                        <p className="text-2xl font-bold text-indigo-600">{stats.avgScore}점</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">평균 정답률</p>
                        <p className="text-2xl font-bold text-green-600">{stats.avgPercentage}%</p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">최고 점수</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {Math.max(...student.exams.map(e => e.totalScore || 0))}점
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">최근 성적</p>
                        <div className="flex items-center gap-1">
                          <p className="text-2xl font-bold text-purple-600">
                            {student.exams[student.exams.length - 1].totalScore || 0}점
                          </p>
                          {trend && trend.direction !== 'same' && (
                            <TrendingUp 
                              size={20} 
                              className={trend.direction === 'up' ? 'text-green-500' : 'text-red-500 rotate-180'}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 시험별 상세 - 수정/삭제 기능 추가 */}
                    <div className="border-t-2 border-gray-200 pt-4">
                      <p className="text-sm font-semibold mb-3 text-gray-700">시험별 성적 (수정/삭제 가능)</p>
                      <div className="space-y-2">
                        {student.exams.map((exam, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                            {editingExam?.studentId === student.id && editingExam?.filteredIndex === idx ? (
                              // 수정 모드
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3">
                                <input
                                  type="text"
                                  value={editForm.examTitle}
                                  onChange={(e) => setEditForm({ ...editForm, examTitle: e.target.value })}
                                  placeholder="시험명"
                                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <input
                                  type="number"
                                  value={editForm.totalScore}
                                  onChange={(e) => setEditForm({ ...editForm, totalScore: e.target.value })}
                                  placeholder="점수"
                                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <input
                                  type="text"
                                  value={editForm.percentage}
                                  onChange={(e) => setEditForm({ ...editForm, percentage: e.target.value })}
                                  placeholder="정답률 (%)"
                                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <input
                                  type="text"
                                  value={editForm.note}
                                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                                  placeholder="비고 (결석 등)"
                                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleEditSave}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                  >
                                    <Save size={16} />
                                    저장
                                  </button>
                                  <button
                                    onClick={handleEditCancel}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition"
                                  >
                                    <X size={16} />
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // 보기 모드
                              <>
                                <div className="flex-1">
                                  <p className="font-semibold text-sm">{exam.examTitle || '시험'}</p>
                                  <p className="text-xs text-gray-600">
                                    {exam.date}
                                    {exam.manualEntry && (
                                      <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                                        수동입력
                                      </span>
                                    )}
                                    {exam.note && (
                                      <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                        {exam.note}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right mr-4">
                                  {exam.note && !exam.totalScore ? (
                                    <p className="font-bold text-lg text-orange-600">{exam.note}</p>
                                  ) : (
                                    <>
                                      <p className="font-bold text-lg text-indigo-600">{exam.totalScore || 0}점</p>
                                      <p className="text-xs text-gray-600">{exam.percentage || 0}%</p>
                                    </>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditStart(student, idx)}
                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                    title="수정"
                                  >
                                    <Edit3 size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConfirm(student, idx)}
                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                                    title="삭제"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 bg-white rounded-xl">
                    <p className="text-gray-400">아직 응시한 시험이 없습니다.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 데이터 없음 메시지 */}
        {students.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
              <User className="text-gray-400" size={48} />
            </div>
            <p className="text-gray-500 text-lg">등록된 학생이 없습니다.</p>
          </div>
        ) : filteredStudents.every(s => !s.exams || s.exams.length === 0) && (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
              <BarChart3 className="text-gray-400" size={48} />
            </div>
            <p className="text-gray-500 text-lg">{selectedMonth}월 {selectedWeek}주차에 응시한 시험 기록이 없습니다.</p>
            <p className="text-gray-400 text-sm mt-2">다른 월/주차를 선택해보세요.</p>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">성적 삭제 확인</h3>
            <p className="text-gray-600 mb-6">
              <span className="font-semibold text-indigo-600">{deleteConfirm.studentName}</span> 학생의
              <span className="font-semibold text-red-600"> "{deleteConfirm.examTitle}"</span> 성적을 삭제하시겠습니까?
            </p>
            <p className="text-sm text-red-500 mb-6">
              ⚠️ 삭제된 성적은 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
