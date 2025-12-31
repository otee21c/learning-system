import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  User, Phone, Search, TrendingUp, BookOpen, CheckCircle, 
  BarChart3, Calendar, ChevronDown, ChevronUp, FileText,
  Target, Award, Clock, AlertCircle, Filter, Home
} from 'lucide-react';

export default function ParentReport() {
  // URL 파라미터 읽기
  const [searchParams] = useSearchParams();
  const urlStartMonth = searchParams.get('start');
  const urlStartWeek = searchParams.get('startWeek');
  const urlEndMonth = searchParams.get('end');
  const urlEndWeek = searchParams.get('endWeek');
  
  // URL에 기간이 설정되어 있으면 그 값 사용
  const hasUrlPeriod = urlStartMonth && urlEndMonth;

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

  // 기간 선택 (URL 파라미터 우선) - 주차 포함
  const [startMonth, setStartMonth] = useState(urlStartMonth ? parseInt(urlStartMonth) : 1);
  const [startWeek, setStartWeek] = useState(urlStartWeek ? parseInt(urlStartWeek) : 1);
  const [endMonth, setEndMonth] = useState(urlEndMonth ? parseInt(urlEndMonth) : 12);
  const [endWeek, setEndWeek] = useState(urlEndWeek ? parseInt(urlEndWeek) : 5);

  // 확장된 행
  const [expandedRows, setExpandedRows] = useState({});

  // 기간 비교 함수 (월/주차 기준)
  const isInPeriod = (month, week) => {
    const itemValue = month * 10 + (week || 1);
    const startValue = startMonth * 10 + startWeek;
    const endValue = endMonth * 10 + endWeek;
    return itemValue >= startValue && itemValue <= endValue;
  };

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

      // URL 파라미터가 없으면 현재 월 기준으로 기간 설정
      if (!hasUrlPeriod) {
        const currentMonth = new Date().getMonth() + 1;
        setStartMonth(Math.max(1, currentMonth - 1));
        setStartWeek(1);
        setEndMonth(currentMonth);
        setEndWeek(5);
      }

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

  // 선택한 기간의 데이터 필터링 (주차 포함)
  const getFilteredExams = () => {
    if (!student?.exams) return [];
    return student.exams.filter(e => isInPeriod(e.month, e.week));
  };

  const getFilteredAttendance = () => {
    return attendanceData.filter(a => isInPeriod(a.month, a.week));
  };

  const getFilteredHomework = () => {
    return homeworkData.filter(h => isInPeriod(h.month, h.week));
  };

  const getFilteredMemos = () => {
    return memoData.filter(m => isInPeriod(m.month, m.week));
  };

  // 통계 계산 (기간 필터 적용)
  const calculateStats = () => {
    if (!student) return null;

    const exams = getFilteredExams();
    const attendance = getFilteredAttendance();
    const homework = getFilteredHomework();
    
    // 출석률
    const totalAttendance = attendance.length;
    const presentCount = attendance.filter(a => a.status === '출석' || a.status === '지각').length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    // 과제 완성도
    const totalHomework = homework.length;
    const completedHomework = homework.filter(h => 
      h.submitted || h.manualStatus === '개별확인완료'
    ).length;
    const homeworkRate = totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0;

    // 테스트 평균
    const validExams = exams.filter(e => e.totalScore !== null && e.totalScore !== undefined);
    const avgScore = validExams.length > 0 
      ? Math.round(validExams.reduce((sum, e) => sum + (e.totalScore || 0), 0) / validExams.length * 10) / 10
      : 0;

    // 수업 참여 횟수
    const totalClasses = attendance.length;

    return {
      attendanceRate,
      homeworkRate,
      avgScore,
      totalExams: validExams.length,
      totalClasses
    };
  };

  // 점수 추이 데이터 (기간 필터 적용)
  const getScoreHistory = () => {
    const exams = getFilteredExams();
    return exams
      .filter(e => e.totalScore !== null && e.totalScore !== undefined)
      .sort((a, b) => {
        // 월/주차 순으로 정렬
        if (a.month !== b.month) return a.month - b.month;
        if (a.week !== b.week) return (a.week || 0) - (b.week || 0);
        return new Date(a.date) - new Date(b.date);
      })
      .slice(-10); // 최근 10개
  };

  // 학습 상세 기록 (기간 필터 적용)
  const getLearningRecords = () => {
    const exams = getFilteredExams();
    const records = [];

    exams.forEach(exam => {
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
        attendance: attendance?.status || '-',
        score: exam.totalScore,
        examTitle: exam.examTitle,
        note: exam.note || '',
        memo: memo?.content || ''
      });
    });

    // 날짜순 정렬 (최신순)
    return records.sort((a, b) => {
      if (a.month !== b.month) return b.month - a.month;
      return (b.week || 0) - (a.week || 0);
    });
  };

  // 수업 메모 모아보기
  const getAllMemos = () => {
    return getFilteredMemos()
      .sort((a, b) => {
        if (a.month !== b.month) return b.month - a.month;
        return (b.week || 0) - (a.week || 0);
      });
  };

  // 기간 표시 텍스트
  const getPeriodText = () => {
    if (startMonth === endMonth && startWeek === endWeek) {
      return `${startMonth}월 ${startWeek}주차`;
    }
    return `${startMonth}월 ${startWeek}주차 ~ ${endMonth}월 ${endWeek}주차`;
  };

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        {/* 배경 장식 */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-200 rounded-full opacity-30 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-200 rounded-full opacity-30 translate-x-1/3 translate-y-1/3" />
        
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative z-10">
          {/* 홈페이지 돌아가기 버튼 */}
          <Link 
            to="/"
            className="absolute top-4 left-4 flex items-center gap-1 text-gray-500 hover:text-emerald-600 transition text-sm"
          >
            <Home size={16} />
            <span>홈으로</span>
          </Link>

          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2 mt-4">
            학습 보고서 확인
          </h1>
          <p className="text-center text-gray-500 mb-6 text-sm">
            오늘의 국어 연구소
          </p>

          {/* URL 파라미터로 기간이 설정된 경우 안내 */}
          {hasUrlPeriod && (
            <div className="mb-4 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700 text-center">
              📅 조회 기간: {startMonth}월 {startWeek}주차 ~ {endMonth}월 {endWeek}주차
            </div>
          )}

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
  const allMemos = getAllMemos();

  // 점수 범위 계산 (그래프용)
  const scores = scoreHistory.map(e => e.totalScore || 0);
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 100;
  const scoreRange = maxScore - minScore || 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">학습 보고서</h1>
            <p className="text-sm text-gray-500">오늘의 국어 연구소</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-1"
            >
              <Home size={16} />
              홈으로
            </Link>
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
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* 기간 표시 */}
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">조회 기간:</span>
            </div>
            
            {hasUrlPeriod ? (
              // URL 파라미터로 기간이 설정된 경우 - 읽기 전용
              <div className="flex items-center gap-2">
                <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
                  {getPeriodText()}
                </span>
                <span className="text-xs text-gray-400">(선생님이 설정한 기간)</span>
              </div>
            ) : (
              // URL 파라미터 없으면 직접 선택 가능
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(Number(e.target.value))}
                    className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                  <select
                    value={startWeek}
                    onChange={(e) => setStartWeek(Number(e.target.value))}
                    className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    {[1,2,3,4,5].map(w => (
                      <option key={w} value={w}>{w}주차</option>
                    ))}
                  </select>
                </div>
                <span className="text-gray-500">~</span>
                <div className="flex items-center gap-1">
                  <select
                    value={endMonth}
                    onChange={(e) => setEndMonth(Number(e.target.value))}
                    className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                  <select
                    value={endWeek}
                    onChange={(e) => setEndWeek(Number(e.target.value))}
                    className="px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                  >
                    {[1,2,3,4,5].map(w => (
                      <option key={w} value={w}>{w}주차</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            <div className="text-right flex-1">
              <p className="font-medium text-gray-800">{student?.name} 학생</p>
              <p className="text-sm text-gray-500">{student?.grade} · {student?.school || '-'}</p>
            </div>
          </div>
        </div>

        {/* 보고서 요약 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📊 학습 현황 요약</h2>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-blue-600 mb-2">출석률</p>
              <p className="text-3xl font-bold text-blue-600">{stats?.attendanceRate || 0}%</p>
              <p className="text-xs text-blue-500 mt-1">{stats?.totalClasses || 0}회 수업</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-green-600 mb-2">과제 완성도</p>
              <p className="text-3xl font-bold text-green-600">{stats?.homeworkRate || 0}%</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-purple-600 mb-2">테스트 평균</p>
              <p className="text-3xl font-bold text-purple-600">{stats?.avgScore || 0}점</p>
              <p className="text-xs text-purple-500 mt-1">{stats?.totalExams || 0}회 응시</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-orange-600 mb-2">조회 기간</p>
              <p className="text-lg font-bold text-orange-600">{startMonth}월{startWeek}주</p>
              <p className="text-lg font-bold text-orange-600">~{endMonth}월{endWeek}주</p>
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
            
            <div className="relative h-64 pt-6">
              {/* Y축 라벨 */}
              <div className="absolute left-0 top-6 bottom-8 w-10 flex flex-col justify-between text-xs text-gray-400">
                <span>{maxScore}</span>
                <span>{Math.round((maxScore + minScore) / 2)}</span>
                <span>{minScore}</span>
              </div>
              
              {/* 그래프 영역 */}
              <div className="ml-12 h-full flex items-end gap-2 pb-8">
                {scoreHistory.map((exam, idx) => {
                  // 점수를 0~100% 범위로 변환 (최소~최대 범위 기준)
                  const heightPercent = scoreRange > 0 
                    ? ((exam.totalScore - minScore) / scoreRange) * 80 + 10  // 10~90% 범위
                    : 50;
                  
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex flex-col items-center" style={{ height: '180px' }}>
                        <span className="text-xs font-semibold text-green-600 mb-1">
                          {exam.totalScore}
                        </span>
                        <div 
                          className="w-full max-w-12 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-lg transition-all hover:from-green-600 hover:to-emerald-500"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {exam.month}/{exam.week || 1}주
                      </p>
                    </div>
                  );
                })}
              </div>
              
              {/* 평균선 */}
              {stats?.avgScore > 0 && (
                <div 
                  className="absolute left-12 right-0 border-t-2 border-dashed border-orange-400"
                  style={{ 
                    bottom: `${((stats.avgScore - minScore) / scoreRange) * 80 + 10 + 32}px`
                  }}
                >
                  <span className="absolute right-0 -top-5 text-xs text-orange-500 bg-white px-1">
                    평균 {stats.avgScore}점
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 학습 상세 기록 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="text-indigo-500" size={20} />
            학습 상세 기록
          </h2>

          {learningRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              선택한 기간에 학습 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">날짜</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">출석</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">시험</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">점수</th>
                  </tr>
                </thead>
                <tbody>
                  {learningRecords.map((record, idx) => {
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
                              {record.month}월 {record.week}주
                            </div>
                          </td>
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
                          <td className="px-4 py-3 text-sm">{record.examTitle || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            {record.score !== null && record.score !== undefined ? (
                              <span className="font-semibold text-indigo-600">{record.score}점</span>
                            ) : (
                              <span className="text-gray-400">{record.note || '-'}</span>
                            )}
                          </td>
                        </tr>
                        
                        {/* 확장 행 */}
                        {isExpanded && record.memo && (
                          <tr className="bg-indigo-50/50">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                <p className="text-sm font-medium text-yellow-800">💡 수업 메모:</p>
                                <p className="text-sm text-yellow-700 mt-1 whitespace-pre-wrap">
                                  {record.memo}
                                </p>
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

        {/* 수업 메모 모아보기 */}
        {allMemos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-cyan-600 mb-4">
              📝 선생님 메모
            </h2>
            <div className="space-y-3">
              {allMemos.map((memo, idx) => (
                <div key={idx} className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
                  <p className="text-xs text-cyan-600 font-medium mb-1">
                    {memo.month}월 {memo.week}주차
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {memo.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 종합 평가 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-purple-600 mb-4">
            📋 종합 평가
          </h2>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-gray-700 leading-relaxed">
              <strong>{student?.name}</strong> 학생의 {getPeriodText()} 학습 현황입니다.
              <br /><br />
              • 출석률 <strong>{stats?.attendanceRate}%</strong> ({stats?.totalClasses}회 수업)
              <br />
              • 과제 완성도 <strong>{stats?.homeworkRate}%</strong>
              <br />
              • 테스트 평균 <strong>{stats?.avgScore}점</strong> ({stats?.totalExams}회 응시)
              <br /><br />
              {stats?.avgScore >= 80 
                ? '전반적으로 우수한 학습 태도를 보이고 있습니다. 현재 수준을 유지하면서 심화 학습을 병행하면 더욱 좋은 결과를 얻을 수 있을 것입니다.'
                : stats?.avgScore >= 60
                ? '기본기가 잘 갖추어져 있으나, 일부 취약한 부분이 있습니다. 해당 부분을 집중적으로 보완하면 성적 향상을 기대할 수 있습니다.'
                : stats?.totalExams > 0
                ? '기초부터 차근차근 다지는 것이 중요합니다. 매일 꾸준한 학습 습관을 기르고, 모르는 부분은 바로바로 질문하는 것이 좋습니다.'
                : '아직 테스트 기록이 없습니다. 앞으로의 학습 과정을 기대합니다.'
              }
              <br /><br />
              가정에서도 꾸준한 관심과 격려를 부탁드립니다. 🙏
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
