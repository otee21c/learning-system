import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText, Download, Image, Calendar, User, ChevronDown, ChevronUp, Save, Trash2, Send } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getTodayMonthWeek } from '../../utils/dateUtils';

const ReportGenerator = ({ students = [] }) => {
  const reportRef = useRef(null);
  const todayMonthWeek = getTodayMonthWeek();

  // 리포트 모드: 'auto' (자동 생성) | 'image' (저장된 이미지 발송)
  const [reportMode, setReportMode] = useState('auto');

  // 기간 선택 모드
  const [periodMode, setPeriodMode] = useState('monthly'); // 'monthly' | 'custom'
  
  // 월별 선택
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  
  // 과정별 선택 (시작~종료)
  const [startMonth, setStartMonth] = useState(todayMonthWeek.month);
  const [startWeek, setStartWeek] = useState(1);
  const [endMonth, setEndMonth] = useState(todayMonthWeek.month);
  const [endWeek, setEndWeek] = useState(todayMonthWeek.week);

  // 학생 선택
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 데이터
  const [curriculums, setCurriculums] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [studentMemos, setStudentMemos] = useState([]);
  const [exams, setExams] = useState([]);

  // 저장된 이미지 관련 (이미지 발송 모드용)
  const [studentImages, setStudentImages] = useState({});
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

  // 리포트 데이터
  const [reportData, setReportData] = useState(null);
  const [comprehensiveDiagnosis, setComprehensiveDiagnosis] = useState('');
  
  // 저장된 종합 진단 목록
  const [savedDiagnoses, setSavedDiagnoses] = useState([]);

  // 미리보기 표시
  const [showPreview, setShowPreview] = useState(false);

  // 이미지 생성 중
  const [generating, setGenerating] = useState(false);

  // MMS 발송 관련
  const [sendingMMS, setSendingMMS] = useState(false);
  const [mmsTarget, setMmsTarget] = useState('both'); // 'student' | 'parent' | 'both'
  const [mmsSenderType, setMmsSenderType] = useState('personal');

  // 데이터 로드
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // 커리큘럼
      const curriculumSnapshot = await getDocs(collection(db, 'curriculums'));
      const curriculumData = curriculumSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCurriculums(curriculumData);

      // 출결
      const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
      const attendanceData = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAttendanceList(attendanceData);

      // 수업 메모
      const memosSnapshot = await getDocs(collection(db, 'studentMemos'));
      const memosData = memosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudentMemos(memosData);

      // 저장된 종합 진단
      const diagnosesSnapshot = await getDocs(collection(db, 'reportDiagnoses'));
      const diagnosesData = diagnosesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedDiagnoses(diagnosesData);

      // 저장된 이미지 로드
      const imagesSnapshot = await getDocs(collection(db, 'studentImages'));
      const imagesData = imagesSnapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
      
      // 학생별로 그룹화
      const groupedImages = {};
      imagesData.forEach(img => {
        if (!groupedImages[img.studentId]) {
          groupedImages[img.studentId] = [];
        }
        groupedImages[img.studentId].push(img);
      });
      
      // 각 학생의 이미지를 최신순 정렬
      Object.keys(groupedImages).forEach(studentId => {
        groupedImages[studentId].sort((a, b) => new Date(b.date) - new Date(a.date));
      });
      
      setStudentImages(groupedImages);

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  // 학생 선택 시
  useEffect(() => {
    if (selectedStudentId) {
      const student = students.find(s => s.id === selectedStudentId);
      setSelectedStudent(student);
      
      // 저장된 종합 진단 불러오기
      const savedDiagnosis = savedDiagnoses.find(d => 
        d.studentId === selectedStudentId &&
        d.periodMode === periodMode &&
        (periodMode === 'monthly' 
          ? d.month === selectedMonth
          : d.startMonth === startMonth && d.startWeek === startWeek && d.endMonth === endMonth && d.endWeek === endWeek
        )
      );
      if (savedDiagnosis) {
        setComprehensiveDiagnosis(savedDiagnosis.content);
      } else {
        setComprehensiveDiagnosis('');
      }
    } else {
      setSelectedStudent(null);
      setComprehensiveDiagnosis('');
    }
  }, [selectedStudentId, students, savedDiagnoses, periodMode, selectedMonth, startMonth, startWeek, endMonth, endWeek]);

  // 기간 내 주차 목록 생성
  const getWeeksInPeriod = () => {
    const weeks = [];
    
    if (periodMode === 'monthly') {
      // 월별: 해당 월의 1~5주차
      for (let w = 1; w <= 5; w++) {
        weeks.push({ month: selectedMonth, week: w });
      }
    } else {
      // 과정별: 시작~종료 범위
      let currentMonth = startMonth;
      let currentWeek = startWeek;
      
      while (
        currentMonth < endMonth || 
        (currentMonth === endMonth && currentWeek <= endWeek)
      ) {
        weeks.push({ month: currentMonth, week: currentWeek });
        
        currentWeek++;
        if (currentWeek > 5) {
          currentWeek = 1;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
          }
        }
        
        // 무한 루프 방지
        if (weeks.length > 60) break;
      }
    }
    
    return weeks;
  };

  // 리포트 데이터 생성
  const generateReportData = () => {
    if (!selectedStudent) {
      alert('학생을 선택해주세요.');
      return;
    }

    const weeks = getWeeksInPeriod();
    
    // 출결 계산
    const periodAttendance = attendanceList.filter(a => 
      a.studentId === selectedStudentId &&
      weeks.some(w => w.month === a.month && w.week === a.week)
    );
    
    const totalAttendance = periodAttendance.length;
    const presentCount = periodAttendance.filter(a => 
      a.status === '출석' || a.status === '지각'
    ).length;
    const attendanceRate = totalAttendance > 0 
      ? Math.round((presentCount / totalAttendance) * 100) 
      : 0;

    // 주차별 데이터 수집
    const weeklyData = weeks.map(({ month, week }) => {
      // 해당 주차 커리큘럼
      const weekCurriculum = curriculums.find(c => 
        c.month === month && 
        c.weekNumber === week &&
        c.students?.includes(selectedStudentId)
      );

      // 해당 주차 메모
      const weekMemo = studentMemos.find(m => 
        m.studentId === selectedStudentId &&
        m.month === month &&
        m.week === week
      );

      // 해당 주차 시험 성적 (학생 데이터에서)
      const studentExams = selectedStudent?.exams || [];
      const weekExams = studentExams.filter(exam => {
        // 수동 입력 성적은 month/week 필드로 매칭
        if (exam.manualEntry) {
          return exam.month === month && exam.week === week;
        }
        
        // 시험 관리에서 등록된 성적은 날짜로 계산
        if (!exam.date) return false;
        const examDate = new Date(exam.date);
        const examMonth = examDate.getMonth() + 1;
        // 주차 계산 (대략적)
        const examWeek = Math.ceil(examDate.getDate() / 7);
        return examMonth === month && examWeek === week;
      });

      return {
        month,
        week,
        curriculum: weekCurriculum?.title || '-',
        curriculumDescription: weekCurriculum?.description || '',
        exams: weekExams,
        memo: weekMemo?.content || '-'
      };
    });

    // 데이터가 있는 주차만 필터링 (선택적)
    const filteredWeeklyData = weeklyData.filter(w => 
      w.curriculum !== '-' || w.memo !== '-' || w.exams.length > 0
    );

    const report = {
      student: selectedStudent,
      periodMode,
      month: periodMode === 'monthly' ? selectedMonth : null,
      startMonth: periodMode === 'custom' ? startMonth : null,
      startWeek: periodMode === 'custom' ? startWeek : null,
      endMonth: periodMode === 'custom' ? endMonth : null,
      endWeek: periodMode === 'custom' ? endWeek : null,
      attendance: {
        total: totalAttendance,
        present: presentCount,
        rate: attendanceRate
      },
      weeklyData: filteredWeeklyData.length > 0 ? filteredWeeklyData : weeklyData,
      comprehensiveDiagnosis
    };

    setReportData(report);
    setShowPreview(true);
  };

  // 종합 진단 저장
  const saveDiagnosis = async () => {
    if (!selectedStudentId || !comprehensiveDiagnosis.trim()) {
      alert('학생과 종합 진단 내용을 입력해주세요.');
      return;
    }

    try {
      // 기존 저장된 진단 찾기
      const existingDiagnosis = savedDiagnoses.find(d => 
        d.studentId === selectedStudentId &&
        d.periodMode === periodMode &&
        (periodMode === 'monthly' 
          ? d.month === selectedMonth
          : d.startMonth === startMonth && d.startWeek === startWeek && d.endMonth === endMonth && d.endWeek === endWeek
        )
      );

      const diagnosisData = {
        studentId: selectedStudentId,
        studentName: selectedStudent?.name,
        periodMode,
        month: periodMode === 'monthly' ? selectedMonth : null,
        startMonth: periodMode === 'custom' ? startMonth : null,
        startWeek: periodMode === 'custom' ? startWeek : null,
        endMonth: periodMode === 'custom' ? endMonth : null,
        endWeek: periodMode === 'custom' ? endWeek : null,
        content: comprehensiveDiagnosis,
        updatedAt: new Date()
      };

      if (existingDiagnosis) {
        await updateDoc(doc(db, 'reportDiagnoses', existingDiagnosis.id), diagnosisData);
      } else {
        diagnosisData.createdAt = new Date();
        await addDoc(collection(db, 'reportDiagnoses'), diagnosisData);
      }

      alert('종합 진단이 저장되었습니다.');
      loadAllData();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 이미지 생성 및 다운로드
  const downloadAsImage = async () => {
    if (!reportRef.current) return;

    setGenerating(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const link = document.createElement('a');
      link.download = `${selectedStudent?.name}_${getPeriodText()}_리포트.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      alert('이미지가 다운로드되었습니다!');
    } catch (error) {
      console.error('이미지 생성 실패:', error);
      alert('이미지 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  // MMS 발송 함수
  const sendMMS = async (phoneNumber, imageBase64, textMessage) => {
    try {
      const apiKey = import.meta.env.VITE_ALIGO_API_KEY;
      const userId = import.meta.env.VITE_ALIGO_USER_ID;
      
      let sender;
      if (mmsSenderType === 'main') {
        sender = import.meta.env.VITE_ALIGO_SENDER_MAIN || '025695559';
      } else if (mmsSenderType === 'sub') {
        sender = import.meta.env.VITE_ALIGO_SENDER_SUB || '01084661129';
      } else {
        sender = import.meta.env.VITE_ALIGO_SENDER || '01054535388';
      }

      if (!apiKey || !userId || !sender) {
        console.error('❌ Aligo API 설정이 없습니다.');
        return false;
      }

      const cleanPhone = phoneNumber.replace(/-/g, '');

      // FormData로 MMS 전송
      const formData = new FormData();
      formData.append('key', apiKey);
      formData.append('user_id', userId);
      formData.append('sender', sender);
      formData.append('receiver', cleanPhone);
      formData.append('msg', textMessage);
      formData.append('msg_type', 'MMS');
      formData.append('testmode_yn', 'N');
      
      // Base64 이미지를 Blob으로 변환
      const base64Data = imageBase64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      
      // 이미지 파일 추가
      formData.append('image', blob, 'report.png');

      const response = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.result_code === '1') {
        console.log('✅ MMS 발송 성공:', cleanPhone);
        return true;
      } else {
        console.error('❌ MMS 발송 실패:', result.message);
        return false;
      }
    } catch (error) {
      console.error('MMS 발송 중 오류:', error);
      return false;
    }
  };

  // MMS로 리포트 발송
  const handleSendMMS = async () => {
    if (!reportRef.current || !selectedStudent) {
      alert('리포트를 먼저 생성해주세요.');
      return;
    }

    // 전화번호 확인
    const phoneNumbers = [];
    if (mmsTarget === 'student' || mmsTarget === 'both') {
      if (selectedStudent.phone) {
        phoneNumbers.push({ type: '학생', number: selectedStudent.phone });
      }
    }
    if (mmsTarget === 'parent' || mmsTarget === 'both') {
      if (selectedStudent.parentPhone) {
        phoneNumbers.push({ type: '학부모', number: selectedStudent.parentPhone });
      }
    }

    if (phoneNumbers.length === 0) {
      alert('발송할 전화번호가 없습니다.\n학생 정보에서 전화번호를 확인해주세요.');
      return;
    }

    const confirmSend = window.confirm(
      `${selectedStudent.name} 학생의 리포트를 발송합니다.\n\n` +
      `발송 대상:\n${phoneNumbers.map(p => `- ${p.type}: ${p.number}`).join('\n')}\n\n` +
      `계속하시겠습니까?`
    );

    if (!confirmSend) return;

    setSendingMMS(true);

    try {
      // 이미지 생성
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8); // JPEG로 압축 (용량 줄이기)
      
      // 텍스트 메시지
      const textMessage = `[오늘의 국어 연구소]\n${selectedStudent.name} 학생 ${getPeriodText()} 진단 리포트입니다.`;

      // 각 번호로 발송
      let successCount = 0;
      let failCount = 0;

      for (const phone of phoneNumbers) {
        const success = await sendMMS(phone.number, imageBase64, textMessage);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        // 발송 간격
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (successCount > 0) {
        alert(`MMS 발송 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
      } else {
        alert('MMS 발송에 실패했습니다.\nAligo API 설정을 확인해주세요.');
      }

    } catch (error) {
      console.error('MMS 발송 실패:', error);
      alert('MMS 발송에 실패했습니다.');
    } finally {
      setSendingMMS(false);
    }
  };

  // 저장된 이미지로 MMS 발송 (이미지 발송 모드용)
  const handleSendSavedImage = async () => {
    if (!selectedStudent || !selectedImageUrl) {
      alert('학생과 이미지를 선택해주세요.');
      return;
    }

    // 전화번호 확인
    const phoneNumbers = [];
    if (mmsTarget === 'student' || mmsTarget === 'both') {
      if (selectedStudent.phone) {
        phoneNumbers.push({ type: '학생', number: selectedStudent.phone });
      }
    }
    if (mmsTarget === 'parent' || mmsTarget === 'both') {
      if (selectedStudent.parentPhone) {
        phoneNumbers.push({ type: '학부모', number: selectedStudent.parentPhone });
      }
    }

    if (phoneNumbers.length === 0) {
      alert('발송할 전화번호가 없습니다.\n학생 정보에서 전화번호를 확인해주세요.');
      return;
    }

    // 선택한 이미지 정보 찾기
    const images = studentImages[selectedStudentId] || [];
    const selectedImage = images.find(img => img.imageUrl === selectedImageUrl);

    const confirmSend = window.confirm(
      `${selectedStudent.name} 학생에게 이미지를 발송합니다.\n\n` +
      `이미지: ${selectedImage?.title || '선택한 이미지'}\n` +
      `발송 대상:\n${phoneNumbers.map(p => `- ${p.type}: ${p.number}`).join('\n')}\n\n` +
      `계속하시겠습니까?`
    );

    if (!confirmSend) return;

    setSendingMMS(true);

    try {
      // 이미지 URL을 Base64로 변환
      const response = await fetch(selectedImageUrl);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const imageBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      // 텍스트 메시지
      const textMessage = `[오늘의 국어 연구소]\n${selectedStudent.name} 학생\n${selectedImage?.title || '성적표'}입니다.`;

      // 각 번호로 발송
      let successCount = 0;
      let failCount = 0;

      for (const phone of phoneNumbers) {
        const success = await sendMMS(phone.number, imageBase64, textMessage);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (successCount > 0) {
        alert(`MMS 발송 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
      } else {
        alert('MMS 발송에 실패했습니다.\nAligo API 설정을 확인해주세요.');
      }

    } catch (error) {
      console.error('이미지 발송 실패:', error);
      alert('이미지 발송에 실패했습니다.');
    } finally {
      setSendingMMS(false);
    }
  };

  // 기간 텍스트
  const getPeriodText = () => {
    if (periodMode === 'monthly') {
      return `${selectedMonth}월`;
    } else {
      return `${startMonth}월${startWeek}주차~${endMonth}월${endWeek}주차`;
    }
  };

  // 리포트 제목
  const getReportTitle = () => {
    if (periodMode === 'monthly') {
      return `${selectedMonth}월 퍼스널 진단 리포트`;
    } else {
      return `${startMonth}월 ${startWeek}주차 ~ ${endMonth}월 ${endWeek}주차 퍼스널 진단 리포트`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <FileText className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            퍼스널 진단 리포트
          </h2>
        </div>

        {/* 리포트 모드 선택 */}
        <div className="mb-6 p-4 bg-gray-100 rounded-xl">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportMode"
                value="auto"
                checked={reportMode === 'auto'}
                onChange={() => {
                  setReportMode('auto');
                  setSelectedImageUrl('');
                }}
                className="w-4 h-4"
              />
              <span className="font-medium">📊 자동 리포트 생성</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reportMode"
                value="image"
                checked={reportMode === 'image'}
                onChange={() => {
                  setReportMode('image');
                  setShowPreview(false);
                }}
                className="w-4 h-4"
              />
              <span className="font-medium">📷 저장된 이미지 발송</span>
            </label>
          </div>
        </div>

        {/* 자동 리포트 모드 */}
        {reportMode === 'auto' && (
          <>
        {/* 기간 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
            <Calendar size={20} />
            1. 기간 선택
          </h3>

          {/* 모드 선택 */}
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="periodMode"
                value="monthly"
                checked={periodMode === 'monthly'}
                onChange={() => setPeriodMode('monthly')}
                className="w-4 h-4"
              />
              <span className="font-medium">월별</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="periodMode"
                value="custom"
                checked={periodMode === 'custom'}
                onChange={() => setPeriodMode('custom')}
                className="w-4 h-4"
              />
              <span className="font-medium">과정별 (기간 직접 선택)</span>
            </label>
          </div>

          {/* 월별 선택 */}
          {periodMode === 'monthly' && (
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="p-3 border border-gray-300 rounded-lg text-lg font-medium"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <span className="text-gray-600">전체 주차</span>
            </div>
          )}

          {/* 과정별 선택 */}
          {periodMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(parseInt(e.target.value))}
                  className="p-2 border border-gray-300 rounded-lg"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <select
                  value={startWeek}
                  onChange={(e) => setStartWeek(parseInt(e.target.value))}
                  className="p-2 border border-gray-300 rounded-lg"
                >
                  {[1,2,3,4,5].map(w => (
                    <option key={w} value={w}>{w}주차</option>
                  ))}
                </select>
              </div>
              
              <span className="text-gray-500 font-medium">~</span>
              
              <div className="flex items-center gap-2">
                <select
                  value={endMonth}
                  onChange={(e) => setEndMonth(parseInt(e.target.value))}
                  className="p-2 border border-gray-300 rounded-lg"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <select
                  value={endWeek}
                  onChange={(e) => setEndWeek(parseInt(e.target.value))}
                  className="p-2 border border-gray-300 rounded-lg"
                >
                  {[1,2,3,4,5].map(w => (
                    <option key={w} value={w}>{w}주차</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 학생 선택 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
            <User size={20} />
            2. 학생 선택
          </h3>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-lg"
          >
            <option value="">학생을 선택하세요</option>
            {students.map(student => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.grade}) {student.school && `- ${student.school}`}
              </option>
            ))}
          </select>
        </div>

        {/* 종합 진단 입력 */}
        <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
          <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
            <FileText size={20} />
            3. 종합 진단 작성
          </h3>

          <textarea
            value={comprehensiveDiagnosis}
            onChange={(e) => setComprehensiveDiagnosis(e.target.value)}
            placeholder="학생에 대한 종합적인 진단 내용을 작성하세요...&#10;&#10;예: 독서보다는 문학 영역에 대한 자신감이 있음. 하지만 아직 접근 방법에 대한 연습이 더 필요함..."
            className="w-full p-4 border border-gray-300 rounded-lg resize-none"
            rows="4"
          />

          <div className="flex justify-end mt-3">
            <button
              onClick={saveDiagnosis}
              disabled={!selectedStudentId || !comprehensiveDiagnosis.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-300"
            >
              <Save size={18} />
              종합 진단 저장
            </button>
          </div>
        </div>

        {/* 리포트 생성 버튼 */}
        <button
          onClick={generateReportData}
          disabled={!selectedStudentId}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg disabled:from-gray-300 disabled:to-gray-400 flex items-center justify-center gap-2"
        >
          <FileText size={20} />
          리포트 미리보기
        </button>

        {/* 미리보기 */}
        {showPreview && reportData && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800">📋 리포트 미리보기</h3>
              <div className="flex gap-2">
                <button
                  onClick={downloadAsImage}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                >
                  <Image size={18} />
                  {generating ? '생성 중...' : '이미지로 저장'}
                </button>
              </div>
            </div>

            {/* MMS 발송 옵션 */}
            <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                📱 MMS로 리포트 발송
              </h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* 발송 대상 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'student', label: '학생' },
                      { value: 'parent', label: '학부모' },
                      { value: 'both', label: '둘 다' }
                    ].map(option => (
                      <label key={option.value} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="mmsTarget"
                          value={option.value}
                          checked={mmsTarget === option.value}
                          onChange={(e) => setMmsTarget(e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 발신번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">발신번호</label>
                  <select
                    value={mmsSenderType}
                    onChange={(e) => setMmsSenderType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="personal">개인번호 (010-5453-5388)</option>
                    <option value="sub">추가번호 (010-8466-1129)</option>
                    <option value="main">대표번호 (02-562-5559)</option>
                  </select>
                </div>
              </div>

              {/* 발송 정보 표시 */}
              <div className="mb-3 p-3 bg-white rounded-lg text-sm">
                <p className="text-gray-600">
                  📞 발송 대상 번호:
                </p>
                <div className="mt-1 space-y-1">
                  {(mmsTarget === 'student' || mmsTarget === 'both') && (
                    <p className={selectedStudent?.phone ? 'text-green-600' : 'text-red-500'}>
                      • 학생: {selectedStudent?.phone || '번호 없음'}
                    </p>
                  )}
                  {(mmsTarget === 'parent' || mmsTarget === 'both') && (
                    <p className={selectedStudent?.parentPhone ? 'text-green-600' : 'text-red-500'}>
                      • 학부모: {selectedStudent?.parentPhone || '번호 없음'}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleSendMMS}
                disabled={sendingMMS}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:shadow-lg transition disabled:from-gray-400 disabled:to-gray-500 font-semibold"
              >
                <Send size={18} />
                {sendingMMS ? 'MMS 발송 중...' : 'MMS로 리포트 발송'}
              </button>
              
              <p className="text-xs text-gray-500 mt-2 text-center">
                💡 MMS는 건당 약 50~100원의 비용이 발생합니다.
              </p>
            </div>

            {/* 실제 리포트 (이미지로 변환될 영역) */}
            <div 
              ref={reportRef}
              className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden"
              style={{ maxWidth: '800px', margin: '0 auto' }}
            >
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                <h1 className="text-xl font-bold mb-1">{getReportTitle()}</h1>
                <p className="text-lg opacity-90">{reportData.student.name} ({reportData.student.grade})</p>
                {reportData.student.school && (
                  <p className="text-sm opacity-75">{reportData.student.school}</p>
                )}
              </div>

              <div className="p-6 space-y-6">
                {/* 출결 현황 */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    📊 출결 현황
                  </h2>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-lg">
                      <span className="font-semibold text-blue-800">
                        {reportData.attendance.present} / {reportData.attendance.total}회
                      </span>
                      <span className="text-blue-600 ml-2">
                        ({reportData.attendance.rate}%)
                      </span>
                    </p>
                  </div>
                </div>

                {/* 주차별 수업 내용 */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📚 주차별 수업 내용
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold" style={{ width: '60px' }}>주차</th>
                          <th className="border border-gray-300 px-2 py-2 text-left text-sm font-semibold" style={{ width: '200px' }}>커리큘럼</th>
                          <th className="border border-gray-300 px-2 py-2 text-center text-sm font-semibold" style={{ width: '100px' }}>성취도</th>
                          <th className="border border-gray-300 px-2 py-2 text-left text-sm font-semibold">수업 메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.weeklyData.map((week, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 px-2 py-2 text-center text-sm font-medium">
                              <div>{week.month}월</div>
                              <div>{week.week}주차</div>
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-sm">
                              <div style={{ wordBreak: 'keep-all', lineHeight: '1.4' }}>
                                {week.curriculum}
                              </div>
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-sm text-center">
                              {week.exams && week.exams.length > 0 ? (
                                <div className="space-y-1">
                                  {week.exams.map((exam, i) => (
                                    <div key={i}>
                                      <div className="font-semibold text-indigo-600">{exam.totalScore}점</div>
                                      <div className="text-xs text-gray-500">({exam.examTitle})</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-sm">
                              <div style={{ lineHeight: '1.5' }}>
                                {week.memo}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 종합 진단 */}
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    💡 종합 진단
                  </h2>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    {reportData.comprehensiveDiagnosis ? (
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {reportData.comprehensiveDiagnosis}
                      </p>
                    ) : (
                      <p className="text-gray-400 italic">종합 진단 내용이 없습니다.</p>
                    )}
                  </div>
                </div>

                {/* 푸터 */}
                <div className="text-center text-sm text-gray-400 pt-4 border-t">
                  오늘의 국어 연구소 | {new Date().toLocaleDateString('ko-KR')}
                </div>
              </div>
            </div>
          </div>
        )}
        </>
        )}

        {/* 이미지 발송 모드 */}
        {reportMode === 'image' && (
          <>
            {/* 학생 선택 */}
            <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
              <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                <User size={20} />
                1. 학생 선택
              </h3>

              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setSelectedImageUrl('');
                }}
                className="w-full p-3 border border-gray-300 rounded-lg text-lg"
              >
                <option value="">학생을 선택하세요</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.grade}) {student.school && `- ${student.school}`}
                    {studentImages[student.id]?.length > 0 && ` [이미지 ${studentImages[student.id].length}개]`}
                  </option>
                ))}
              </select>
            </div>

            {/* 이미지 선택 */}
            {selectedStudentId && (
              <div className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                  <Image size={20} />
                  2. 이미지 선택
                </h3>

                {studentImages[selectedStudentId] && studentImages[selectedStudentId].length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {studentImages[selectedStudentId].map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedImageUrl(img.imageUrl)}
                        className={`cursor-pointer rounded-xl overflow-hidden border-4 transition-all ${
                          selectedImageUrl === img.imageUrl
                            ? 'border-purple-500 shadow-lg scale-105'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img.imageUrl}
                          alt={img.title}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-2 bg-white">
                          <p className="text-sm font-medium truncate">{img.title}</p>
                          <p className="text-xs text-gray-500">{img.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Image size={48} className="mx-auto mb-2 opacity-30" />
                    <p>저장된 이미지가 없습니다.</p>
                    <p className="text-sm mt-1">학생 관리 탭에서 이미지를 먼저 저장해주세요.</p>
                  </div>
                )}
              </div>
            )}

            {/* 선택된 이미지 미리보기 */}
            {selectedImageUrl && (
              <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
                <h3 className="font-bold text-lg mb-4 text-gray-800">📱 MMS 발송</h3>

                <div className="mb-4">
                  <img
                    src={selectedImageUrl}
                    alt="선택된 이미지"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* 발송 대상 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'student', label: '학생' },
                        { value: 'parent', label: '학부모' },
                        { value: 'both', label: '둘 다' }
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="imageTarget"
                            value={option.value}
                            checked={mmsTarget === option.value}
                            onChange={(e) => setMmsTarget(e.target.value)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 발신번호 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">발신번호</label>
                    <select
                      value={mmsSenderType}
                      onChange={(e) => setMmsSenderType(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="personal">개인번호 (010-5453-5388)</option>
                      <option value="sub">추가번호 (010-8466-1129)</option>
                      <option value="main">대표번호 (02-562-5559)</option>
                    </select>
                  </div>
                </div>

                {/* 발송 정보 표시 */}
                <div className="mb-3 p-3 bg-white rounded-lg text-sm">
                  <p className="text-gray-600">📞 발송 대상 번호:</p>
                  <div className="mt-1 space-y-1">
                    {(mmsTarget === 'student' || mmsTarget === 'both') && (
                      <p className={selectedStudent?.phone ? 'text-green-600' : 'text-red-500'}>
                        • 학생: {selectedStudent?.phone || '번호 없음'}
                      </p>
                    )}
                    {(mmsTarget === 'parent' || mmsTarget === 'both') && (
                      <p className={selectedStudent?.parentPhone ? 'text-green-600' : 'text-red-500'}>
                        • 학부모: {selectedStudent?.parentPhone || '번호 없음'}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSendSavedImage}
                  disabled={sendingMMS}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:shadow-lg transition disabled:from-gray-400 disabled:to-gray-500 font-semibold"
                >
                  <Send size={18} />
                  {sendingMMS ? 'MMS 발송 중...' : 'MMS로 이미지 발송'}
                </button>

                <p className="text-xs text-gray-500 mt-2 text-center">
                  💡 MMS는 건당 약 50~100원의 비용이 발생합니다.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;
