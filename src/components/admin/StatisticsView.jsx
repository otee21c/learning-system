import React, { useState } from 'react';
import { User, TrendingUp, BarChart3 } from 'lucide-react';
import { getTodayMonthWeek } from '../../utils/dateUtils';

export default function StatisticsView({ students, exams }) {
  // 월/주차 선택 (기본값: 현재 월/주차)
  const todayMonthWeek = getTodayMonthWeek();
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  
  // 선택한 월/주차에 해당하는 시험만 필터링
  const filteredExams = exams.filter(exam => 
    exam.month === selectedMonth && exam.week === selectedWeek
  );
  
  // 선택한 월/주차의 시험 ID 목록
  const filteredExamIds = filteredExams.map(exam => exam.id);
  
  // 학생 데이터를 필터링 (선택한 월/주차의 시험만 포함)
  // - 시험 관리에서 등록된 시험 (examId 매칭)
  // - 수동 입력 성적 (월/주차 매칭)
  const filteredStudents = students.map(student => ({
    ...student,
    exams: student.exams?.filter(exam => 
      filteredExamIds.includes(exam.examId) ||
      (exam.manualEntry && exam.month === selectedMonth && exam.week === selectedWeek)
    ) || []
  }));
  // 전체 평균 계산
  const calculateOverallStats = () => {
    const allExams = filteredStudents.flatMap(s => s.exams || []);
    if (allExams.length === 0) return { avgScore: 0, avgPercentage: 0, totalExams: 0 };

    const avgScore = allExams.reduce((sum, e) => sum + e.totalScore, 0) / allExams.length;
    const avgPercentage = allExams.reduce((sum, e) => sum + parseFloat(e.percentage), 0) / allExams.length;
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

    const avgScore = student.exams.reduce((sum, e) => sum + e.totalScore, 0) / student.exams.length;
    const avgPercentage = student.exams.reduce((sum, e) => sum + parseFloat(e.percentage), 0) / student.exams.length;

    return {
      avgScore: avgScore.toFixed(1),
      avgPercentage: avgPercentage.toFixed(1)
    };
  };

  // 최근 성적 변화
  const getRecentTrend = (student) => {
    if (!student.exams || student.exams.length < 2) return null;

    const recentExams = student.exams.slice(-2);
    const diff = recentExams[1].totalScore - recentExams[0].totalScore;

    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
      value: Math.abs(diff)
    };
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
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="mt-3 text-sm text-gray-600 bg-white p-3 rounded-lg">
            💡 선택된 기간: <span className="font-semibold text-indigo-600">{selectedMonth}월 {selectedWeek}주차</span>
            {filteredExams.length > 0 && (
              <span className="ml-2">({filteredExams.length}개 시험)</span>
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
                          {Math.max(...student.exams.map(e => e.totalScore))}점
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-xs text-gray-600 mb-1">최근 성적</p>
                        <div className="flex items-center gap-1">
                          <p className="text-2xl font-bold text-purple-600">
                            {student.exams[student.exams.length - 1].totalScore}점
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

                    {/* 시험별 상세 */}
                    <div className="border-t-2 border-gray-200 pt-4">
                      <p className="text-sm font-semibold mb-3 text-gray-700">시험별 성적</p>
                      <div className="space-y-2">
                        {student.exams.map((exam, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                            <div>
                              <p className="font-semibold text-sm">{exam.examTitle}</p>
                              <p className="text-xs text-gray-600">{exam.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-indigo-600">{exam.totalScore}점</p>
                              <p className="text-xs text-gray-600">{exam.percentage}%</p>
                            </div>
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
    </div>
  );
}
