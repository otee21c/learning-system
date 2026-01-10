import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  X, User, Calendar, BookOpen, FileText, Target, TrendingUp, 
  CheckCircle, XCircle, Clock, AlertCircle, Send, Download,
  BarChart2, PieChart, MessageSquare, ChevronRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';

// 유형별 색상
const TYPE_COLORS = {
  '독서-정보': 'bg-blue-100 text-blue-800',
  '독서-의미': 'bg-indigo-100 text-indigo-800',
  '독서-보기': 'bg-purple-100 text-purple-800',
  '문학-정보': 'bg-green-100 text-green-800',
  '문학-의미': 'bg-emerald-100 text-emerald-800',
  '문학-보기': 'bg-teal-100 text-teal-800',
  '화작': 'bg-orange-100 text-orange-800',
  '언매': 'bg-pink-100 text-pink-800'
};

export default function StudentDetailDashboard({ 
  student, 
  onClose, 
  selectedMonth, 
  selectedRound,
  schedules = []
}) {
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [homeworkHistory, setHomeworkHistory] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [wrongAnswerHistory, setWrongAnswerHistory] = useState([]);
  const [curriculumHistory, setCurriculumHistory] = useState([]);
  const [memoHistory, setMemoHistory] = useState([]);
  const [weaknessAnalysis, setWeaknessAnalysis] = useState([]);

  useEffect(() => {
    if (student) {
      loadStudentData();
    }
  }, [student, selectedMonth, selectedRound]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // 출석 데이터
      const attendanceSnapshot = await getDocs(
        query(collection(db, 'attendance'), where('studentId', '==', student.id))
      );
      setAttendanceHistory(attendanceSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      // 과제 제출 데이터
      const homeworkSnapshot = await getDocs(
        query(collection(db, 'homeworkSubmissions'), where('studentId', '==', student.id))
      );
      setHomeworkHistory(homeworkSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      // 오답 기록 (약점 분석용)
      const wrongSnapshot = await getDocs(
        query(collection(db, 'wrongAnswers'), where('studentId', '==', student.id))
      );
      const wrongData = wrongSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setWrongAnswerHistory(wrongData);

      // 약점 분석 계산
      calculateWeakness(wrongData);

      // 커리큘럼 데이터
      const curriculumSnapshot = await getDocs(
        query(collection(db, 'curriculum'), where('studentId', '==', student.id))
      );
      setCurriculumHistory(curriculumSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      // 메모 데이터
      const memoSnapshot = await getDocs(
        query(collection(db, 'studentMemos'), where('studentId', '==', student.id))
      );
      setMemoHistory(memoSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

      // 시험 점수 (학생 문서에서)
      setScoreHistory(student.exams || []);

    } catch (error) {
      console.error('학생 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 약점 분석 계산
  const calculateWeakness = (wrongData) => {
    const typeStats = {};
    let totalWrong = 0;

    wrongData.forEach(record => {
      Object.entries(record.analyzedTypes || {}).forEach(([type, count]) => {
        typeStats[type] = (typeStats[type] || 0) + count;
        totalWrong += count;
      });
    });

    const sorted = Object.entries(typeStats)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalWrong > 0 ? Math.round((count / totalWrong) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    setWeaknessAnalysis(sorted);
  };

  // 이번 주 출석 상태
  const getCurrentAttendance = () => {
    return attendanceHistory.find(a => 
      a.month === selectedMonth && a.round === selectedRound
    );
  };

  // 이번 주 과제 현황
  const getCurrentHomework = () => {
    return homeworkHistory.filter(h => 
      h.month === selectedMonth && (h.round === selectedRound || h.week === selectedRound)
    );
  };

  // 이번 주 커리큘럼
  const getCurrentCurriculum = () => {
    return curriculumHistory.find(c => 
      c.month === selectedMonth && c.round === selectedRound
    );
  };

  // 이번 주 메모
  const getCurrentMemo = () => {
    return memoHistory.find(m => 
      m.month === selectedMonth && m.round === selectedRound
    );
  };

  // 최근 성적 (이번 달)
  const getMonthScores = () => {
    return wrongAnswerHistory.filter(w => {
      const recordDate = new Date(w.date);
      return recordDate.getMonth() + 1 === selectedMonth;
    });
  };

  // 출석 아이콘
  const getAttendanceIcon = (status) => {
    switch (status) {
      case '출석': return <CheckCircle className="text-green-500" size={20} />;
      case '지각': return <Clock className="text-yellow-500" size={20} />;
      case '결석': return <XCircle className="text-red-500" size={20} />;
      case '조퇴': return <AlertCircle className="text-orange-500" size={20} />;
      default: return <span className="text-gray-400">-</span>;
    }
  };

  // 출석률 계산
  const calculateAttendanceRate = () => {
    const monthAttendance = attendanceHistory.filter(a => a.month === selectedMonth);
    if (monthAttendance.length === 0) return 0;
    const attended = monthAttendance.filter(a => a.status === '출석').length;
    return Math.round((attended / monthAttendance.length) * 100);
  };

  // 과제 완료율 계산
  const calculateHomeworkRate = () => {
    const monthHomework = homeworkHistory.filter(h => h.month === selectedMonth);
    if (monthHomework.length === 0) return 0;
    const completed = monthHomework.filter(h => h.submitted || h.manualStatus === '완료').length;
    return Math.round((completed / monthHomework.length) * 100);
  };

  // 주간 리포트 PDF 생성
  const generateWeeklyReport = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // 제목
    pdf.setFontSize(20);
    pdf.setTextColor(79, 70, 229);
    pdf.text(`${student.name} 주간 학습 리포트`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // 기간
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${selectedMonth}월 ${selectedRound}차`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // 구분선
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 10;

    // 출석
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    const attendance = getCurrentAttendance();
    pdf.text(`출석: ${attendance?.status || '-'}`, margin, y);
    y += 10;

    // 과제
    const homework = getCurrentHomework();
    const completedCount = homework.filter(h => h.submitted).length;
    pdf.text(`과제: ${completedCount}건 제출`, margin, y);
    y += 10;

    // 약점
    pdf.text('약점 TOP 3:', margin, y);
    y += 8;
    weaknessAnalysis.slice(0, 3).forEach((w, i) => {
      pdf.setFontSize(11);
      pdf.text(`  ${i + 1}. ${w.type} (${w.percentage}%)`, margin, y);
      y += 7;
    });

    // 다운로드
    pdf.save(`${student.name}_주간리포트_${selectedMonth}월${selectedRound}차.pdf`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  const currentAttendance = getCurrentAttendance();
  const currentHomework = getCurrentHomework();
  const currentCurriculum = getCurrentCurriculum();
  const currentMemo = getCurrentMemo();
  const monthScores = getMonthScores();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{student.name}</h2>
                <p className="text-indigo-200">{student.grade} · {student.school || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-4 py-2 bg-white/20 rounded-lg font-medium">
                {selectedMonth}월 {selectedRound}차
              </span>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 출석 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Calendar size={18} />
                <span className="text-sm font-medium">출석</span>
              </div>
              <div className="flex items-center gap-2">
                {getAttendanceIcon(currentAttendance?.status)}
                <span className={`text-lg font-bold ${
                  currentAttendance?.status === '출석' ? 'text-green-600' :
                  currentAttendance?.status === '결석' ? 'text-red-600' :
                  currentAttendance?.status === '지각' ? 'text-yellow-600' :
                  'text-gray-400'
                }`}>
                  {currentAttendance?.status || '-'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">이번 달 출석률: {calculateAttendanceRate()}%</p>
            </div>

            {/* 과제 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <BookOpen size={18} />
                <span className="text-sm font-medium">과제</span>
              </div>
              <p className="text-2xl font-bold text-indigo-600">
                {currentHomework.filter(h => h.submitted).length}/{currentHomework.length || '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">이번 달 완료율: {calculateHomeworkRate()}%</p>
            </div>

            {/* 성적 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <BarChart2 size={18} />
                <span className="text-sm font-medium">이번 달 채점</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {monthScores.length}회
              </p>
              <p className="text-xs text-gray-500 mt-1">
                총 오답: {monthScores.reduce((sum, s) => sum + (s.wrongQuestions?.length || 0), 0)}문제
              </p>
            </div>

            {/* 약점 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Target size={18} />
                <span className="text-sm font-medium">주요 약점</span>
              </div>
              {weaknessAnalysis.length > 0 ? (
                <p className={`text-sm font-bold px-2 py-1 rounded inline-block ${TYPE_COLORS[weaknessAnalysis[0].type] || 'bg-gray-100'}`}>
                  {weaknessAnalysis[0].type}
                </p>
              ) : (
                <p className="text-gray-400">-</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {weaknessAnalysis[0]?.percentage || 0}% 비중
              </p>
            </div>
          </div>

          {/* 이번 주 현황 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 커리큘럼 */}
            <div className="bg-white rounded-xl p-5 shadow">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                이번 주 커리큘럼
              </h3>
              {currentCurriculum ? (
                <div className="space-y-2">
                  <p className="text-gray-700">{currentCurriculum.content || currentCurriculum.description || '-'}</p>
                </div>
              ) : (
                <p className="text-gray-400">등록된 커리큘럼이 없습니다.</p>
              )}
            </div>

            {/* 수업 메모 */}
            <div className="bg-white rounded-xl p-5 shadow">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-amber-600" />
                수업 메모
              </h3>
              {currentMemo ? (
                <p className="text-gray-700 whitespace-pre-wrap">{currentMemo.content}</p>
              ) : (
                <p className="text-gray-400">등록된 메모가 없습니다.</p>
              )}
            </div>
          </div>

          {/* 약점 분석 */}
          <div className="bg-white rounded-xl p-5 shadow">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target size={18} className="text-red-600" />
              약점 분석 (누적)
            </h3>
            {weaknessAnalysis.length > 0 ? (
              <div className="space-y-3">
                {weaknessAnalysis.slice(0, 5).map((w, i) => (
                  <div key={w.type} className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-white text-sm font-bold ${
                      i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}>
                      {i + 1}
                    </span>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${TYPE_COLORS[w.type] || 'bg-gray-100'}`}>
                      {w.type}
                    </span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-yellow-500' : 'bg-gray-400'}`}
                        style={{ width: `${w.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-16 text-right">{w.count}문제 ({w.percentage}%)</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">아직 오답 기록이 없습니다.</p>
            )}
          </div>

          {/* 채점 기록 타임라인 */}
          <div className="bg-white rounded-xl p-5 shadow">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              최근 채점 기록
            </h3>
            {wrongAnswerHistory.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {wrongAnswerHistory.slice(0, 10).map((record, i) => (
                  <div key={record.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500 w-20">{record.date}</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{record.workbookName}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(record.analyzedTypes || {}).slice(0, 3).map(([type, count]) => (
                          <span key={type} className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[type] || 'bg-gray-100'}`}>
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-red-600 font-bold">{record.wrongQuestions?.length || 0}문제</span>
                      <p className="text-xs text-gray-500">오답</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">채점 기록이 없습니다.</p>
            )}
          </div>

        </div>

        {/* 하단 버튼 */}
        <div className="bg-white border-t p-4 flex gap-3 justify-end">
          <button
            onClick={generateWeeklyReport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Download size={18} />
            주간 리포트
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Download size={18} />
            종합 리포트
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Send size={18} />
            학부모 알림
          </button>
        </div>

      </div>
    </div>
  );
}
