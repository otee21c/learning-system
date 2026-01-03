import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  LayoutDashboard, User, Calendar, BookOpen, FileText, MessageSquare, 
  Check, X, Edit2, Trash2, Save, ChevronDown, ChevronUp, Search,
  CheckCircle, XCircle, Clock, AlertCircle, Plus, Send, Image, BarChart2
} from 'lucide-react';
import { getTodayMonthWeek, getMonthWeek } from '../../utils/dateUtils';

const StudentDashboard = ({ students = [], branch }) => {
  const todayMonthWeek = getTodayMonthWeek();
  
  // 필터 상태
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState(''); // 학년 필터
  const [schoolFilter, setSchoolFilter] = useState(''); // 학교 필터
  
  // 데이터 상태
  const [attendanceData, setAttendanceData] = useState([]);
  const [curriculumData, setCurriculumData] = useState([]);
  const [homeworkData, setHomeworkData] = useState([]);
  const [assignmentsData, setAssignmentsData] = useState([]);
  const [memoData, setMemoData] = useState([]);
  
  // 편집 상태
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  // 확장된 행
  const [expandedRows, setExpandedRows] = useState({});
  
  // 로딩
  const [loading, setLoading] = useState(true);

  // ★ 성적 입력 모달 상태
  const [scoreModal, setScoreModal] = useState({
    isOpen: false,
    studentId: '',
    studentName: '',
    studentDocId: ''
  });
  const [scoreForm, setScoreForm] = useState({
    examTitle: '',
    totalScore: '',
    percentage: '',
    note: ''
  });
  const [savingScore, setSavingScore] = useState(false);

  // ★ 문자 발송 관련 상태
  const [selectedStudentsForSMS, setSelectedStudentsForSMS] = useState([]);
  const [sendingSMS, setSendingSMS] = useState(false);

  // ★ 학교 성적 관련 상태
  const [schoolGradesData, setSchoolGradesData] = useState([]);
  const [schoolGradeModal, setSchoolGradeModal] = useState({ isOpen: false, studentId: '', studentName: '' });
  
  // ★ 과제 제출물 모달 상태
  const [submissionsModal, setSubmissionsModal] = useState({ isOpen: false, studentId: '', studentName: '' });
  const [studentSubmissions, setStudentSubmissions] = useState([]);

  // ★ SMS 발송 함수 (클라이언트에서 직접 Aligo 호출)
  const sendSMS = async (phoneNumber, message) => {
    try {
      const apiKey = import.meta.env.VITE_ALIGO_API_KEY;
      const userId = import.meta.env.VITE_ALIGO_USER_ID;
      // 기본 발신번호: 02-562-5559
      const sender = import.meta.env.VITE_ALIGO_SENDER_MAIN || '025625559';

      if (!apiKey || !userId || !sender) {
        console.error('❌ Aligo API 설정이 없습니다.');
        return false;
      }

      const cleanPhone = phoneNumber.replace(/-/g, '');

      const formData = new URLSearchParams();
      formData.append('key', apiKey);
      formData.append('user_id', userId);
      formData.append('sender', sender);
      formData.append('receiver', cleanPhone);
      formData.append('msg', message);
      formData.append('testmode_yn', 'N');

      const response = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      const result = await response.json();
      
      if (result.result_code === '1') {
        console.log('✅ SMS 발송 성공:', cleanPhone);
        return true;
      } else {
        console.error('❌ SMS 발송 실패:', result.message);
        return false;
      }
    } catch (error) {
      console.error('SMS 발송 오류:', error);
      return false;
    }
  };

  // ★ 개별 지각/결석 문자 발송
  const sendAttendanceSMS = async (student, status) => {
    if (!student.parentPhone) {
      alert(`${student.name} 학생의 학부모 연락처가 없습니다.`);
      return;
    }

    const statusText = status === '지각' ? '아직 등원하지 않아서' : '결석하여';
    const message = `안녕하세요. 오늘의 국어입니다. ${student.name} 학생이 ${statusText} 문자 보냅니다. 일정 확인 부탁드립니다. 고맙습니다.`;

    setSendingSMS(true);
    const success = await sendSMS(student.parentPhone, message);
    setSendingSMS(false);

    if (success) {
      alert(`${student.name} 학생 학부모님께 문자가 발송되었습니다.`);
    } else {
      alert('문자 발송에 실패했습니다.');
    }
  };

  // ★ 일괄 문자 발송 (결석/지각)
  const sendBulkAttendanceSMS = async () => {
    if (selectedStudentsForSMS.length === 0) {
      alert('문자를 보낼 학생을 선택해주세요.');
      return;
    }

    const studentsToSend = selectedStudentsForSMS
      .map(id => students.find(s => s.id === id))
      .filter(s => s && s.parentPhone);

    if (studentsToSend.length === 0) {
      alert('학부모 연락처가 등록된 학생이 없습니다.');
      return;
    }

    if (!confirm(`${studentsToSend.length}명의 학부모님께 문자를 발송하시겠습니까?`)) {
      return;
    }

    setSendingSMS(true);
    let successCount = 0;

    for (const student of studentsToSend) {
      const status = getAttendanceStatus(student.id);
      const statusText = status === '지각' ? '아직 등원하지 않아서' : status === '결석' ? '결석하여' : '출결 관련으로';
      const message = `안녕하세요. 오늘의 국어입니다. ${student.name} 학생이 ${statusText} 문자 보냅니다. 일정 확인 부탁드립니다. 고맙습니다.`;

      const success = await sendSMS(student.parentPhone, message);
      if (success) successCount++;
    }

    setSendingSMS(false);
    setSelectedStudentsForSMS([]);
    alert(`${successCount}명의 학부모님께 문자가 발송되었습니다.`);
  };

  // ★ 학생 선택 토글 (문자용)
  const toggleStudentForSMS = (studentId) => {
    setSelectedStudentsForSMS(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // ★ 전체 선택/해제 (결석/지각 학생만)
  const toggleSelectAllAbsent = () => {
    const absentStudents = filteredStudents.filter(s => {
      const status = getAttendanceStatus(s.id);
      return status === '결석' || status === '지각';
    });

    const allSelected = absentStudents.every(s => selectedStudentsForSMS.includes(s.id));
    
    if (allSelected) {
      setSelectedStudentsForSMS(prev => prev.filter(id => !absentStudents.some(s => s.id === id)));
    } else {
      setSelectedStudentsForSMS(prev => [...new Set([...prev, ...absentStudents.map(s => s.id)])]);
    }
  };

  // 데이터 로드
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
      setAttendanceData(attendanceSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      const curriculumSnapshot = await getDocs(collection(db, 'curriculums'));
      setCurriculumData(curriculumSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      const assignmentsSnapshot = await getDocs(query(collection(db, 'assignments'), orderBy('createdAt', 'desc')));
      setAssignmentsData(assignmentsSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      const homeworkSnapshot = await getDocs(collection(db, 'homeworkSubmissions'));
      setHomeworkData(homeworkSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      const memoSnapshot = await getDocs(collection(db, 'studentMemos'));
      setMemoData(memoSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

      // 학교 성적 로드
      const schoolGradesSnapshot = await getDocs(collection(db, 'schoolGrades'));
      setSchoolGradesData(schoolGradesSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));

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
      c.students?.includes(studentId) && 
      c.month === selectedMonth && 
      c.weekNumber === selectedWeek
    );
    return record ? true : false;
  };

  // 학생별 학교 성적 가져오기
  const getSchoolGrades = (studentId) => {
    return schoolGradesData
      .filter(g => g.studentId === studentId)
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.semester - a.semester;
      });
  };

  // 학생별 모든 과제 제출물 가져오기
  const getStudentAllSubmissions = (studentId) => {
    return homeworkData
      .filter(h => h.studentId === studentId && (h.files?.length > 0 || h.imageUrl))
      .sort((a, b) => {
        const dateA = a.submittedAt?.seconds || 0;
        const dateB = b.submittedAt?.seconds || 0;
        return dateB - dateA;
      });
  };

  // 과제 제출물 모달 열기
  const openSubmissionsModal = (student) => {
    const submissions = getStudentAllSubmissions(student.id);
    setStudentSubmissions(submissions);
    setSubmissionsModal({ isOpen: true, studentId: student.id, studentName: student.name });
  };

  // 학생별 숙제 현황 가져오기
  const getHomeworkStatus = (studentId) => {
    const submissions = homeworkData.filter(h => 
      h.studentId === studentId && 
      h.month === selectedMonth && 
      h.week === selectedWeek
    );
    
    const manualComplete = submissions.filter(s => s.manualStatus === '개별확인완료').length;
    const manualPending = submissions.filter(s => s.manualStatus === '개별확인예정').length;
    const submitted = submissions.filter(s => s.submitted || s.imageUrl || s.files).length;
    const totalComplete = submitted + manualComplete;
    
    if (manualPending > 0) return { text: `확인예정 ${manualPending}`, type: 'pending' };
    if (totalComplete > 0) return { text: `${totalComplete}개 완료`, type: 'complete' };
    return { text: '미제출', type: 'none' };
  };

  // 학생별 성적 가져오기 (해당 월/주차)
  const getRecentScore = (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student?.exams || student.exams.length === 0) return '-';
    
    const monthWeekExams = student.exams.filter(e => 
      e.month === selectedMonth && e.week === selectedWeek
    );
    
    if (monthWeekExams.length > 0) {
      const latestExam = monthWeekExams[monthWeekExams.length - 1];
      if (latestExam.note && !latestExam.totalScore) {
        return latestExam.note;
      }
      return `${latestExam.totalScore || 0}점`;
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
    return record?.content || '';
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

      const today = new Date().toISOString().split('T')[0];

      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.docId), { 
          status: newStatus,
          date: existing.date || today,
          timestamp: new Date()
        });
      } else {
        const student = students.find(s => s.id === studentId);
        await addDoc(collection(db, 'attendance'), {
          studentId,
          studentName: student?.name || '',
          month: selectedMonth,
          week: selectedWeek,
          date: today,
          status: newStatus,
          note: '',
          timestamp: new Date()
        });
      }
      loadAllData();
    } catch (error) {
      console.error('출결 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 과제 수동 상태 변경
  const handleHomeworkStatusChange = async (studentId, newStatus) => {
    try {
      const student = students.find(s => s.id === studentId);
      
      const existing = homeworkData.find(h => 
        h.studentId === studentId && 
        h.month === selectedMonth && 
        h.week === selectedWeek
      );

      if (existing) {
        await updateDoc(doc(db, 'homeworkSubmissions', existing.docId), {
          manualStatus: newStatus,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'homeworkSubmissions'), {
          studentId: studentId,
          studentName: student?.name || '',
          month: selectedMonth,
          week: selectedWeek,
          manualStatus: newStatus,
          submitted: false,
          submittedAt: serverTimestamp()
        });
      }

      loadAllData();
    } catch (error) {
      console.error('과제 상태 변경 실패:', error);
      alert('상태 변경에 실패했습니다.');
    }
  };

  // 메모 저장
  const handleMemoSave = async (studentId, memoContent) => {
    try {
      const existing = memoData.find(m => 
        m.studentId === studentId && 
        m.month === selectedMonth && 
        m.week === selectedWeek
      );

      if (existing) {
        await updateDoc(doc(db, 'studentMemos', existing.docId), { content: memoContent });
      } else {
        const student = students.find(s => s.id === studentId);
        await addDoc(collection(db, 'studentMemos'), {
          studentId,
          studentName: student?.name || '',
          month: selectedMonth,
          week: selectedWeek,
          content: memoContent,
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

  // ★ 성적 입력 모달 열기
  const openScoreModal = (student) => {
    setScoreModal({
      isOpen: true,
      studentId: student.id,
      studentName: student.name,
      studentDocId: student.docId
    });
    setScoreForm({
      examTitle: '',
      totalScore: '',
      percentage: '',
      note: ''
    });
  };

  // ★ 성적 입력 모달 닫기
  const closeScoreModal = () => {
    setScoreModal({
      isOpen: false,
      studentId: '',
      studentName: '',
      studentDocId: ''
    });
    setScoreForm({
      examTitle: '',
      totalScore: '',
      percentage: '',
      note: ''
    });
  };

  // ★ 성적 저장
  const handleScoreSave = async () => {
    if (!scoreForm.examTitle) {
      alert('시험명을 입력해주세요.');
      return;
    }
    
    if (!scoreForm.totalScore && !scoreForm.note) {
      alert('점수 또는 비고를 입력해주세요.');
      return;
    }

    setSavingScore(true);
    
    try {
      const student = students.find(s => s.id === scoreModal.studentId);
      if (!student) {
        alert('학생 정보를 찾을 수 없습니다.');
        setSavingScore(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      
      const newExam = {
        examTitle: scoreForm.examTitle,
        totalScore: scoreForm.totalScore ? parseInt(scoreForm.totalScore) : null,
        percentage: scoreForm.percentage || null,
        note: scoreForm.note || '',
        date: today,
        month: selectedMonth,
        week: selectedWeek,
        manualEntry: true,
        createdAt: new Date().toISOString()
      };

      const updatedExams = [...(student.exams || []), newExam];

      const docId = scoreModal.studentDocId || student.docId;
      await updateDoc(doc(db, 'students', docId), {
        exams: updatedExams
      });

      alert('성적이 저장되었습니다.');
      closeScoreModal();
      window.location.reload();
      
    } catch (error) {
      console.error('성적 저장 실패:', error);
      alert('성적 저장에 실패했습니다: ' + error.message);
    }
    
    setSavingScore(false);
  };

  // 행 확장 토글
  const toggleRow = (studentId) => {
    setExpandedRows(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // 검색 필터링된 학생 목록
  const filteredStudents = students.filter(student => {
    // 검색어 필터
    const matchesSearch = searchTerm === '' || 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.school?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.grade?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 학년 필터
    const matchesGrade = gradeFilter === '' || student.grade === gradeFilter;
    
    // 학교 필터
    const matchesSchool = schoolFilter === '' || student.school === schoolFilter;
    
    return matchesSearch && matchesGrade && matchesSchool;
  });

  // 학년 목록 추출 (중복 제거, 정렬)
  const gradeList = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();
  
  // 학교 목록 추출 (중복 제거, 정렬)
  const schoolList = [...new Set(students.map(s => s.school).filter(Boolean))].sort();

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

  // 현재 학생의 과제 수동 상태 가져오기
  const getHomeworkManualStatus = (studentId) => {
    const record = homeworkData.find(h => 
      h.studentId === studentId && 
      h.month === selectedMonth && 
      h.week === selectedWeek
    );
    return record?.manualStatus || '';
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

          {/* 학년 필터 */}
          <div className="flex items-center gap-2">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체 학년</option>
              {gradeList.map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          {/* 학교 필터 */}
          <div className="flex items-center gap-2">
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체 학교</option>
              {schoolList.map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </div>

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
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-24">
                  <div className="flex items-center justify-center gap-2">
                    <Calendar size={16} />
                    커리
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-40">
                  <div className="flex items-center justify-center gap-2">
                    <BookOpen size={16} />
                    과제
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-24">
                  <div className="flex items-center justify-center gap-2">
                    <Image size={16} />
                    제출물
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-gray-700 w-32">
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
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const isExpanded = expandedRows[student.id];
                  const attendanceStatus = getAttendanceStatus(student.id);
                  const curriculum = getCurriculum(student.id);
                  const homeworkStatus = getHomeworkStatus(student.id);
                  const homeworkManualStatus = getHomeworkManualStatus(student.id);
                  const recentScore = getRecentScore(student.id);
                  const memo = getMemo(student.id);
                  const isEditingMemo = editingCell?.studentId === student.id && editingCell?.field === 'memo';

                  return (
                    <React.Fragment key={student.id}>
                      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRow(student.id)}
                            className="p-1 hover:bg-gray-200 rounded transition"
                          >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.grade} · {student.school || '-'}</p>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* 문자 발송용 체크박스 (결석/지각만) */}
                            {(attendanceStatus === '결석' || attendanceStatus === '지각') && (
                              <input
                                type="checkbox"
                                checked={selectedStudentsForSMS.includes(student.id)}
                                onChange={() => toggleStudentForSMS(student.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            )}
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
                            {/* 개별 문자 발송 버튼 */}
                            {(attendanceStatus === '결석' || attendanceStatus === '지각') && (
                              <button
                                onClick={() => sendAttendanceSMS(student, attendanceStatus)}
                                disabled={sendingSMS}
                                className="p-1 text-blue-500 hover:bg-blue-100 rounded transition disabled:opacity-50"
                                title="문자 발송"
                              >
                                <Send size={14} />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          {curriculum ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold">
                              O
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold">
                              X
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <select
                            value={homeworkManualStatus}
                            onChange={(e) => handleHomeworkStatusChange(student.id, e.target.value)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium cursor-pointer border focus:ring-2 focus:ring-indigo-500 ${
                              homeworkStatus.type === 'complete' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              homeworkStatus.type === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            <option value="">
                              {homeworkStatus.text}
                            </option>
                            <option value="개별확인예정">📋 개별확인 예정</option>
                            <option value="개별확인완료">✔️ 개별확인 완료</option>
                          </select>
                        </td>

                        {/* ★ 제출물 - 학생별 모든 과제 사진 보기 */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openSubmissionsModal(student)}
                            className="px-2 py-1 bg-purple-100 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-200 transition flex items-center gap-1 mx-auto"
                          >
                            <Image size={14} />
                            {getStudentAllSubmissions(student.id).length}개
                          </button>
                        </td>

                        {/* ★ 성적 - 클릭하면 입력 모달 열림 */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openScoreModal(student)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition hover:shadow-md ${
                              recentScore === '-' 
                                ? 'bg-gray-100 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600' 
                                : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                            }`}
                            title="클릭하여 성적 입력"
                          >
                            <div className="flex items-center gap-1">
                              {recentScore === '-' ? (
                                <>
                                  <Plus size={14} />
                                  <span>입력</span>
                                </>
                              ) : (
                                <span>{recentScore}</span>
                              )}
                            </div>
                          </button>
                        </td>

                        <td className="px-4 py-3">
                          {isEditingMemo ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
                                rows={3}
                                autoFocus
                                placeholder="메모 입력 (Enter로 줄바꿈)"
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleMemoSave(student.id, editValue)}
                                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="text-sm text-gray-600 max-w-xs cursor-pointer hover:text-indigo-600 whitespace-pre-wrap"
                              onClick={() => startEdit(student.id, 'memo', memo)}
                              title={memo || '클릭하여 메모 추가'}
                            >
                              {memo || <span className="text-gray-400 italic">메모 없음</span>}
                            </div>
                          )}
                        </td>

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

                      {isExpanded && (
                        <tr className="bg-indigo-50/50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h4 className="font-medium text-gray-700 mb-2">📞 연락처</h4>
                                <p className="text-sm text-gray-600">학생: {student.phone || '-'}</p>
                                <p className="text-sm text-gray-600">학부모: {student.parentPhone || '-'}</p>
                              </div>

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

                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h4 className="font-medium text-gray-700 mb-2">📝 최근 메모</h4>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                  {memoData
                                    .filter(m => m.studentId === student.id)
                                    .sort((a, b) => (b.month * 10 + b.week) - (a.month * 10 + a.week))
                                    .slice(0, 3)
                                    .map((m, idx) => (
                                      <p key={idx} className="text-xs text-gray-600">
                                        <span className="text-gray-400">{m.month}월 {m.week}주:</span> {m.content}
                                      </p>
                                    ))
                                  }
                                  {memoData.filter(m => m.studentId === student.id).length === 0 && (
                                    <p className="text-xs text-gray-400">메모 없음</p>
                                  )}
                                </div>
                              </div>

                              {/* 학교 성적 */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h4 className="font-medium text-gray-700 mb-2">📊 학교 성적</h4>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                  {getSchoolGrades(student.id).slice(0, 3).map((g, idx) => (
                                    <p key={idx} className="text-xs text-gray-600">
                                      <span className="text-gray-400">{g.year} {g.semester}학기 {g.examType}:</span>{' '}
                                      {g.score && `${g.score}점`}
                                      {g.grade && ` ${g.grade}등급`}
                                      {g.rank && g.totalStudents && ` (${g.rank}/${g.totalStudents})`}
                                    </p>
                                  ))}
                                  {getSchoolGrades(student.id).length === 0 && (
                                    <p className="text-xs text-gray-400">등록된 성적 없음</p>
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

        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex flex-wrap gap-6 text-sm items-center justify-between">
            <div className="flex flex-wrap gap-6">
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
            
            {/* 문자 발송 버튼 영역 */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAllAbsent}
                className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                결석/지각 전체 선택
              </button>
              {selectedStudentsForSMS.length > 0 && (
                <button
                  onClick={sendBulkAttendanceSMS}
                  disabled={sendingSMS}
                  className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Send size={14} />
                  {sendingSMS ? '발송 중...' : `선택 ${selectedStudentsForSMS.length}명 문자 발송`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="bg-white rounded-xl shadow p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">💡 사용 방법</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• <strong>출결</strong>: 드롭다운을 클릭해서 바로 변경 → 출석 관리에도 반영됨</li>
          <li>• <strong>과제</strong>: 드롭다운으로 "개별확인 예정/완료" 선택 가능 → 숙제 관리에도 반영됨</li>
          <li>• <strong>커리</strong>: 커리큘럼 배정 여부 (O: 배정됨, X: 미배정) - 상세 내용은 커리큘럼 탭에서 확인</li>
          <li>• <strong className="text-indigo-600">성적</strong>: 버튼을 클릭하여 시험명/점수/비고 입력 → 성적 통계 탭에도 반영됨</li>
          <li>• <strong>메모</strong>: 셀을 클릭하거나 ✏️ 버튼으로 편집 → 학생 관리에도 반영됨</li>
          <li>• <strong>▼ 버튼</strong>: 클릭하면 학생 상세 정보 확인</li>
        </ul>
      </div>

      {/* ★ 성적 입력 모달 */}
      {scoreModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              📝 성적 입력
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-semibold text-indigo-600">{scoreModal.studentName}</span> 학생 · {selectedMonth}월 {selectedWeek}주차
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시험명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={scoreForm.examTitle}
                  onChange={(e) => setScoreForm({ ...scoreForm, examTitle: e.target.value })}
                  placeholder="예: 복습 test, 중간고사"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    점수
                  </label>
                  <input
                    type="number"
                    value={scoreForm.totalScore}
                    onChange={(e) => setScoreForm({ ...scoreForm, totalScore: e.target.value })}
                    placeholder="예: 85"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    정답률 (%)
                  </label>
                  <input
                    type="text"
                    value={scoreForm.percentage}
                    onChange={(e) => setScoreForm({ ...scoreForm, percentage: e.target.value })}
                    placeholder="예: 85"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비고
                </label>
                <input
                  type="text"
                  value={scoreForm.note}
                  onChange={(e) => setScoreForm({ ...scoreForm, note: e.target.value })}
                  placeholder="예: 결석, 조퇴, 재시험 필요"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <p className="text-xs text-gray-400">
                💡 점수 없이 비고만 입력할 수도 있어요 (예: 결석)
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeScoreModal}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                취소
              </button>
              <button
                onClick={handleScoreSave}
                disabled={savingScore}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition disabled:opacity-50"
              >
                {savingScore ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 과제 제출물 모달 */}
      {submissionsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                📷 {submissionsModal.studentName} - 과제 제출물
              </h3>
              <button
                onClick={() => setSubmissionsModal({ isOpen: false, studentId: '', studentName: '' })}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {studentSubmissions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Image size={48} className="mx-auto mb-4 opacity-50" />
                  <p>제출된 과제가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {studentSubmissions.map((sub, idx) => {
                    const assignment = assignmentsData.find(a => a.id === sub.homeworkId || a.docId === sub.homeworkId);
                    return (
                      <div key={idx} className="border rounded-xl p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {assignment?.title || sub.homeworkId || '과제'}
                            </h4>
                            <p className="text-xs text-gray-500">
                              제출: {sub.submittedAt?.seconds 
                                ? new Date(sub.submittedAt.seconds * 1000).toLocaleString('ko-KR')
                                : '-'}
                            </p>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {sub.files?.length || 1}개 파일
                          </span>
                        </div>
                        
                        {/* 이미지 그리드 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {sub.files?.map((file, fIdx) => {
                            const isImage = file.type?.startsWith('image/') || 
                                            file.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                            return (
                              <a 
                                key={fIdx} 
                                href={file.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block border rounded-lg overflow-hidden bg-white hover:shadow-md transition"
                              >
                                {isImage ? (
                                  <img 
                                    src={file.url} 
                                    alt={`제출물 ${fIdx + 1}`}
                                    className="w-full h-32 object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                                    <FileText size={32} className="text-gray-400" />
                                  </div>
                                )}
                                <p className="text-xs text-center py-2 text-blue-600">파일 {fIdx + 1}</p>
                              </a>
                            );
                          })}
                          {/* 기존 imageUrl 지원 */}
                          {sub.imageUrl && !sub.files && (
                            <a 
                              href={sub.imageUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block border rounded-lg overflow-hidden bg-white hover:shadow-md transition"
                            >
                              <img 
                                src={sub.imageUrl} 
                                alt="제출물"
                                className="w-full h-32 object-cover"
                              />
                              <p className="text-xs text-center py-2 text-blue-600">보기</p>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
