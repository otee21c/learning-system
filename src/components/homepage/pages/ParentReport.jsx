import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  User, Phone, Search, TrendingUp, BookOpen, CheckCircle, 
  BarChart3, Calendar, ChevronDown, ChevronUp, FileText,
  Target, Award, Clock, AlertCircle
} from 'lucide-react';

export default function ParentReport() {
  // 로그인 상태
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ studentName: '', parentPhone: '' });
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // 학생 데이터
  const [student, setStudent] = useState(null);
  
  // 기타 데이터
  const [attendanceData, setAttendanceData] = useState([]);
  const [curriculumData, setCurriculumData] = useState([]);
  const [memoData, setMemoData] = useState([]);
  const [homeworkData, setHomeworkData] = useState([]);

  // 기간 선택
  const [periodMode, setPeriodMode] = useState('recent'); // 'recent' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 확장된 행
  const [expandedRows, setExpandedRows] = useState({});

  // 로그인 처리
  const handleLogin = async () => {
    if (!loginForm.studentName.trim() || !loginForm.parentPhone.trim()) {
      setLoginError('학생 이름과 학부모 전화번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      // 전화번호 정규화 (하이픈 제거)
      const normalizedPhone = loginForm.parentPhone.replace(/-/g, '').trim();
      
      // 학생 조회
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const students = studentsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      
      // 이름과 학부모 전화번호로 찾기
      const foundStudent = students.find(s => {
        const studentParentPhone = s.parentPhone?.replace(/-/g, '').trim();
        return s.name === loginForm.studentName.trim() && studentParentPhone === normalizedPhone;
      });

      if (!foundStudent) {
        setLoginError('학생 정보를 찾을 수 없습니다. 이름과 전화번호를 확인해주세요.');
        setLoading(false);
        return;
      }

      setStudent(foundStudent);
      setIsLoggedIn(true);

      // 관련 데이터 로드
      await loadStudentData(foundStudent.id);

    } catch (error) {
      console.error('로그인 실패:', error);
      setLoginError('로그인 중 오류가 발생했습니다.');
    }

    setLoading(false);
  };

  // 학생 데이터 로드
  const loadStudentData = async (studentId) => {
    try {
      // 출결 데이터
      const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
      const attendance = attendanceSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(a => a.studentId === studentId);
      setAttendanceData(attendance);

      // 커리큘럼 데이터
      const curriculumSnapshot = await getDocs(collection(db, 'curriculums'));
      const curriculum = curriculumSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(c => c.students?.includes(studentId));
      setCurriculumData(curriculum);

      // 메모 데이터
      const memoSnapshot = await getDocs(collection(db, 'studentMemos'));
      const memos = memoSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => m.studentId === studentId);
      setMemoData(memos);

      // 숙제 데이터
      const homeworkSnapshot = await getDocs(collection(db, 'homeworkSubmissions'));
      const homework = homeworkSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(h => h.studentId === studentId);
      setHomeworkData(homework);

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  // 통계 계산
  const calculateStats = () => {
    if (!student) return null;

    const exams = student.exams || [];
    
    // 출석률
    const totalAttendance = attendanceData.length;
    const presentCount = attendanceData.filter(a => a.status === '출석' || a.status === '지각').length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    // 진도 진행률 (커리큘럼 기반)
    const totalCurriculum = curriculumData.length;
    const progressRate = totalCurriculum > 0 ? Math.min(100, Math.round((totalCurriculum / 20) * 100)) : 0;

    // 과제 완성도
    const totalHomework = homeworkData.length;
    const completedHomework = homeworkData.filter(h => 
      h.submitted || h.manualStatus === '개별확인완료'
    ).length;
    const homeworkRate = totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0;

    // 테스트 평균
    const validExams = exams.filter(e => e.totalScore !== null && e.totalScore !== undefined);
    const avgScore = validExams.length > 0 
      ? Math.round(validExams.reduce((sum, e) => sum + (e.totalScore || 0), 0) / validExams.length * 10) / 10
      : 0;

    return {
      attendanceRate,
      progressRate,
      homeworkRate,
      avgScore,
      totalExams: validExams.length
    };
  };

  // 점수 추이 데이터
  const getScoreHistory = () => {
    if (!student?.exams) return [];
    
    return student.exams
      .filter(e => e.totalScore !== null && e.totalScore !== undefined)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-10); // 최근 10개
  };

  // 학습 상세 기록
  const getLearningRecords = () => {
    if (!student?.exams) return [];

    // 시험 기록 + 수업 메모 결합
    const records = [];

    // 시험 기록
    student.exams.forEach(exam => {
      const curriculum = curriculumData.find(c => 
        c.month === exam.month && c.weekNumber === exam.week
      );
      const attendance = attendanceData.find(a => 
        a.month === exam.month && a.week === exam.week
      );
      const memo = memoData.find(m => 
        m.month === exam.month && m.week === exam.week
      );

      records.push({
        date: exam.date,
        month: exam.month,
        week: exam.week,
        className: curriculum?.title || '-',
        attendance: attendance?.status || '-',
        homeworkStatus: exam.note || '완료',
        score: exam.totalScore,
        examTitle: exam.examTitle,
        curriculum: curriculum?.content || '',
        nextTask: curriculum?.nextTask || '',
        memo: memo?.content || ''
      });
    });

    // 날짜순 정렬 (최신순)
    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // 종합 진단 생성
  const getComprehensiveDiagnosis = () => {
    if (!student) return '';
    
    const stats = calculateStats();
    const exams = student.exams || [];
    const recentMemos = memoData
      .sort((a, b) => (b.month * 10 + b.week) - (a.month * 10 + a.week))
      .slice(0, 5);

    let diagnosis = `안녕하세요, ${student.name} 학생 학부모님.\n\n`;
    
    // 출석 현황
    diagnosis += `📊 학습 현황 요약\n`;
    diagnosis += `• 출석률: ${stats?.attendanceRate || 0}%\n`;
    diagnosis += `• 과제 완성도: ${stats?.homeworkRate || 0}%\n`;
    diagnosis += `• 테스트 평균: ${stats?.avgScore || 0}점 (총 ${stats?.totalExams || 0}회)\n\n`;

    // 최근 수업 메모
    if (recentMemos.length > 0) {
      diagnosis += `📝 최근 수업 기록\n`;
      recentMemos.forEach(memo => {
        diagnosis += `• ${memo.month}월 ${memo.week}주차: ${memo.content}\n`;
      });
    }

    return diagnosis;
  };

  // 게이지 차트 컴포넌트
  const GaugeChart = ({ value, label, color, suffix = '%' }) => {
    const rotation = (value / 100) * 180;
    
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <p className="text-sm font-medium text-gray-600 mb-3">{label}</p>
        <div className="relative w-32 h-16 mx-auto overflow-hidden">
          {/* 배경 아크 */}
          <div 
            className="absolute w-32 h-32 rounded-full border-8 border-gray-200"
            style={{ 
              clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
              top: 0
            }}
          />
          {/* 값 아크 */}
          <div 
            className={`absolute w-32 h-32 rounded-full border-8 ${color}`}
            style={{ 
              clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
              top: 0,
              transform: `rotate(${rotation - 180}deg)`,
              transformOrigin: 'center center'
            }}
          />
        </div>
        <p className={`text-2xl font-bold text-center mt-2 ${color.replace('border-', 'text-')}`}>
          {value}{suffix}
        </p>
      </div>
    );
  };

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        {/* 배경 장식 */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-200 rounded-full opacity-30 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-200 rounded-full opacity-30 translate-x-1/3 translate-y-1/3" />
        
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative z-10">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            학습 보고서 확인
          </h1>
          <p className="text-center text-gray-500 mb-6 text-sm">
            오늘의 국어 연구소
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                학생 이름
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="학생 이름"
                  value={loginForm.studentName}
                  onChange={(e) => setLoginForm({ ...loginForm, studentName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                학부모 전화번호
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  placeholder="학부모 전화번호"
                  value={loginForm.parentPhone}
                  onChange={(e) => setLoginForm({ ...loginForm, parentPhone: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50"
            >
              {loading ? '확인 중...' : '확인'}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            ※ 학생 관리에 등록된 학부모 전화번호로만 확인 가능합니다.
          </p>
        </div>
      </div>
    );
  }

  // 보고서 화면
  const stats = calculateStats();
  const scoreHistory = getScoreHistory();
  const learningRecords = getLearningRecords();
  const diagnosis = getComprehensiveDiagnosis();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">학습 보고서</h1>
            <p className="text-sm text-gray-500">오늘의 국어 연구소</p>
          </div>
          <button
            onClick={() => {
              setIsLoggedIn(false);
              setStudent(null);
            }}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* 보고서 요약 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">보고서 요약</h2>
              <p className="text-sm text-gray-500">
                기간: 전체 학습 기록
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-800">{student?.name} 학생</p>
              <p className="text-sm text-gray-500">{student?.grade} · {student?.school || '-'}</p>
            </div>
          </div>

          {/* 게이지 차트 4개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-blue-600 mb-2">진도 진행률</p>
              <div className="relative w-24 h-12 mx-auto mb-2">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats?.attendanceRate || 0) * 1.26} 126`}
                  />
                </svg>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats?.attendanceRate || 0}%</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-green-600 mb-2">진도 완성률</p>
              <div className="relative w-24 h-12 mx-auto mb-2">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats?.progressRate || 0) * 1.26} 126`}
                  />
                </svg>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats?.progressRate || 0}%</p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-rose-600 mb-2">과제 완성도</p>
              <div className="relative w-24 h-12 mx-auto mb-2">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats?.homeworkRate || 0) * 1.26} 126`}
                  />
                </svg>
              </div>
              <p className="text-2xl font-bold text-rose-600">{stats?.homeworkRate || 0}%</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-purple-600 mb-2">테스트 평균</p>
              <div className="relative w-24 h-12 mx-auto mb-2">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(stats?.avgScore || 0) * 1.26} 126`}
                  />
                </svg>
              </div>
              <p className="text-2xl font-bold text-purple-600">{stats?.avgScore || 0}점</p>
            </div>
          </div>
        </div>

        {/* 점수 추이 */}
        {scoreHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-green-500" size={20} />
              점수 추이
            </h2>
            
            <div className="relative h-48">
              {/* 간단한 라인 차트 */}
              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-6">
                {scoreHistory.map((exam, idx) => {
                  const height = `${(exam.totalScore / 100) * 100}%`;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all hover:from-green-600 hover:to-emerald-500"
                        style={{ height }}
                      />
                      <p className="text-xs text-gray-500 mt-2 truncate w-full text-center">
                        {exam.date?.slice(5) || '-'}
                      </p>
                      <p className="text-xs font-medium text-green-600">
                        {exam.totalScore}점
                      </p>
                    </div>
                  );
                })}
              </div>
              
              {/* 평균선 */}
              <div 
                className="absolute w-full border-t-2 border-dashed border-green-300"
                style={{ bottom: `${(stats?.avgScore || 0) + 24}%` }}
              >
                <span className="absolute right-0 -top-5 text-xs text-green-600 bg-white px-1">
                  평균 {stats?.avgScore}점
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 학습 상세 기록 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="text-indigo-500" size={20} />
            학습 상세 기록
            <span className="text-sm font-normal text-gray-500">(항목 클릭 시 상세보기)</span>
          </h2>

          {learningRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              아직 학습 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">날짜</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">반</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">출석</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">과제 완성도</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">테스트</th>
                  </tr>
                </thead>
                <tbody>
                  {learningRecords.slice(0, 10).map((record, idx) => {
                    const isExpanded = expandedRows[idx];
                    
                    return (
                      <React.Fragment key={idx}>
                        <tr 
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                          onClick={() => setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              {record.date}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">{record.className}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              record.attendance === '출석' ? 'bg-green-100 text-green-700' :
                              record.attendance === '지각' ? 'bg-yellow-100 text-yellow-700' :
                              record.attendance === '결석' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {record.attendance}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">{record.homeworkStatus}</td>
                          <td className="px-4 py-3 text-center">
                            {record.score !== null && record.score !== undefined ? (
                              <span className="font-semibold text-indigo-600">{record.score}</span>
                            ) : '-'}
                          </td>
                        </tr>
                        
                        {/* 확장 행 */}
                        {isExpanded && (
                          <tr className="bg-indigo-50/50">
                            <td colSpan={5} className="px-6 py-4">
                              <div className="space-y-3">
                                {record.examTitle && (
                                  <div className="bg-white rounded-lg p-3">
                                    <p className="text-sm font-medium text-gray-700">📝 수업 내용:</p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {record.examTitle}
                                    </p>
                                  </div>
                                )}
                                {record.memo && (
                                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                    <p className="text-sm font-medium text-yellow-800">💡 특이사항:</p>
                                    <p className="text-sm text-yellow-700 mt-1 whitespace-pre-wrap">
                                      {record.memo}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 종합 진단 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-cyan-600 mb-4 flex items-center gap-2">
            1. 학습 과정 요약
          </h2>
          <div className="bg-cyan-50 rounded-xl p-4 mb-6">
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {diagnosis}
            </p>
          </div>

          <h2 className="text-lg font-bold text-green-600 mb-4 flex items-center gap-2">
            2. 학습 방향 제안
          </h2>
          <div className="bg-green-50 rounded-xl p-4 mb-6">
            <p className="text-gray-700 leading-relaxed">
              {stats?.avgScore >= 80 
                ? `${student?.name} 학생은 전반적으로 학습 태도가 긍정적이며, 꾸준히 노력하는 모습을 보여주고 있습니다. 현재 수준을 유지하면서 심화 학습을 병행하면 더욱 좋은 결과를 얻을 수 있을 것입니다.`
                : stats?.avgScore >= 60
                ? `${student?.name} 학생은 기본기가 잘 갖추어져 있으나, 일부 취약한 부분이 있습니다. 해당 부분을 집중적으로 보완하면 성적 향상을 기대할 수 있습니다.`
                : `${student?.name} 학생은 기초부터 차근차근 다지는 것이 중요합니다. 매일 꾸준한 학습 습관을 기르고, 모르는 부분은 바로바로 질문하는 것이 좋습니다.`
              }
            </p>
          </div>

          <h2 className="text-lg font-bold text-purple-600 mb-4 flex items-center gap-2">
            3. 종합 평가
          </h2>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-gray-700 leading-relaxed">
              {student?.name} 학생의 학습 현황을 종합적으로 평가했을 때, 
              출석률 {stats?.attendanceRate}%, 과제 완성도 {stats?.homeworkRate}%, 
              테스트 평균 {stats?.avgScore}점으로 
              {stats?.avgScore >= 80 ? '우수한' : stats?.avgScore >= 60 ? '양호한' : '노력이 필요한'} 
              학습 수준을 보이고 있습니다.
              가정에서도 꾸준한 관심과 격려를 부탁드립니다.
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center text-sm text-gray-400 py-4">
          오늘의 국어 연구소 | {new Date().toLocaleDateString('ko-KR')}
        </div>
      </div>
    </div>
  );
}
