import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Trash2, Save, X, 
  ChevronDown, ChevronUp, Camera, AlertCircle, Loader2,
  CheckCircle, File, Printer, Download, Edit3, List, Crosshair
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { getTodayMonthWeek, getMonthWeek } from '../../utils/dateUtils';
import { gradeOMRFromBase64, formatResults } from '../../utils/omrCoordinates';

export default function OMRBatchGrading({ exams, students, branch }) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState('scan');
  
  // 시험 선택
  const [selectedExamId, setSelectedExamId] = useState('');
  const selectedExam = exams.find(e => e.id === selectedExamId);
  
  // PDF 및 인식 결과
  const [pdfPages, setPdfPages] = useState([]);
  const [scanResults, setScanResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  
  // 스캔 모드: 'vision' (Claude Vision) 또는 'coordinate' (좌표 기반)
  const [scanMode, setScanMode] = useState('coordinate');
  
  // 수정 모드
  const [editingIndex, setEditingIndex] = useState(null);
  
  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [savedResults, setSavedResults] = useState([]);

  // 수동 성적 입력용
  const [manualScore, setManualScore] = useState({
    studentId: '',
    score: '',
    maxScore: 100,
    note: ''
  });

  // 성적표 생성용
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportExamId, setReportExamId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // 멘트 수정용
  const [strengthComment, setStrengthComment] = useState('');
  const [weaknessComment, setWeaknessComment] = useState('');
  const [changeComment, setChangeComment] = useState('');
  const [isEditingComments, setIsEditingComments] = useState(false);

  // ★ 퍼스널 성취도용 state
  const [personalData, setPersonalData] = useState({
    studentName: '',
    reportDate: '',
    totalScore: '',
    // 영역별 밸런스 (4가지)
    balanceScores: {
      과제: 0,
      훈련: 0,
      과정: 0,
      진단: 0
    },
    // 상세 영역별 (4가지)
    detailContents: {
      과제점검: '',
      훈련적용: '',
      학습과정: '',
      학습진단: ''
    },
    // 자기 점검 (2단 박스)
    selfCheck1Title: '',
    selfCheck1Content: '',
    selfCheck2Title: '',
    selfCheck2Content: '',
    // 진단 메모
    diagnosisMemo: ''
  });
  const [isGeneratingPersonalPdf, setIsGeneratingPersonalPdf] = useState(false);
  const personalReportRef = useRef(null);
  
  // ★ 퍼스널 성취도 저장/불러오기 관련
  const [savedPersonalReports, setSavedPersonalReports] = useState([]);
  const [selectedPersonalReportId, setSelectedPersonalReportId] = useState('');
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [isLoadingPersonalReports, setIsLoadingPersonalReports] = useState(false);

  // 성적표 ref
  const reportRef = useRef(null);

  // PDF.js 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // PDF 파일 업로드
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setIsLoadingPdf(true);
    setPdfPages([]);
    setScanResults([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (!window.pdfjsLib) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        pages.push({ pageNum: i, preview: imageData, base64: imageData.split(',')[1] });
      }

      setPdfPages(pages);
      alert(`PDF에서 ${pages.length}장의 OMR을 추출했습니다.`);
    } catch (error) {
      alert('PDF 처리 오류: ' + error.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const removePage = (index) => {
    setPdfPages(prev => prev.filter((_, i) => i !== index));
    setScanResults(prev => prev.filter((_, i) => i !== index));
  };

  // Claude Vision OMR 인식
  const scanOMRWithVision = async () => {
    if (!selectedExam) { alert('시험을 선택해주세요.'); return; }
    if (pdfPages.length === 0) { alert('PDF를 업로드해주세요.'); return; }

    setIsScanning(true);
    setScanProgress({ current: 0, total: pdfPages.length });
    
    const results = [];
    
    for (let i = 0; i < pdfPages.length; i++) {
      setScanProgress({ current: i + 1, total: pdfPages.length });
      
      try {
        const result = await analyzeOMRImage(pdfPages[i].base64, selectedExam);
        results.push({
          ...result,
          pageIndex: i,
          pageNum: pdfPages[i].pageNum,
          matchedStudentId: findMatchingStudent(result.studentName)
        });
      } catch (error) {
        results.push({
          error: true,
          pageIndex: i,
          pageNum: pdfPages[i].pageNum,
          studentName: '',
          birthDate: '',
          matchedStudentId: '',
          answers: Array(selectedExam.totalQuestions).fill(0)
        });
      }
    }
    
    setScanResults(results);
    setIsScanning(false);
  };

  // 좌표 기반 OMR 인식 (빠르고 정확)
  const scanOMRWithCoordinates = async () => {
    if (!selectedExam) { alert('시험을 선택해주세요.'); return; }
    if (pdfPages.length === 0) { alert('PDF를 업로드해주세요.'); return; }

    setIsScanning(true);
    setScanProgress({ current: 0, total: pdfPages.length });
    
    const results = [];
    
    for (let i = 0; i < pdfPages.length; i++) {
      setScanProgress({ current: i + 1, total: pdfPages.length });
      
      try {
        // 좌표 기반 채점
        const gradeResult = await gradeOMRFromBase64(pdfPages[i].base64);
        
        // answers 객체를 배열로 변환 (1번부터 순서대로)
        const answersArray = [];
        for (let q = 1; q <= selectedExam.totalQuestions; q++) {
          answersArray.push(gradeResult.answers[q] || 0);
        }
        
        results.push({
          studentName: '', // 좌표 기반은 이름 인식 안 함 - 수동 입력 필요
          birthDate: '',
          selectedSubject: '화작',
          answers: answersArray,
          pageIndex: i,
          pageNum: pdfPages[i].pageNum,
          matchedStudentId: '',
          // 좌표 기반 추가 정보
          scanMethod: 'coordinate',
          confidence: gradeResult.details?.map(d => d.confidence) || []
        });
      } catch (error) {
        console.error('좌표 기반 스캔 오류:', error);
        results.push({
          error: true,
          pageIndex: i,
          pageNum: pdfPages[i].pageNum,
          studentName: '',
          birthDate: '',
          matchedStudentId: '',
          answers: Array(selectedExam.totalQuestions).fill(0)
        });
      }
    }
    
    setScanResults(results);
    setIsScanning(false);
  };

  // 통합 스캔 함수 (모드에 따라 분기)
  const scanOMR = async () => {
    if (scanMode === 'coordinate') {
      await scanOMRWithCoordinates();
    } else {
      await scanOMRWithVision();
    }
  };

  const findMatchingStudent = (name) => {
    if (!name) return '';
    let match = students.find(s => s.name === name);
    if (match) return match.id;
    match = students.find(s => s.name.includes(name) || name.includes(s.name));
    return match ? match.id : '';
  };

  const analyzeOMRImage = async (base64Image, exam) => {
    const prompt = `OMR 답안지 분석. JSON만 출력:
{"studentName":"이름","birthDate":"MMDD","selectedSubject":"화작","answers":[1,2,3,...]}
- answers: ${exam.totalQuestions}개, 마킹없으면 0`;

    const response = await fetch('/api/analyze-omr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, prompt })
    });

    if (!response.ok) throw new Error('OMR 분석 실패');
    const data = await response.json();
    
    try {
      const jsonMatch = data.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        while (parsed.answers.length < exam.totalQuestions) parsed.answers.push(0);
        return parsed;
      }
    } catch (e) {}
    
    return { studentName: '', birthDate: '', selectedSubject: '화작', answers: Array(exam.totalQuestions).fill(0) };
  };

  const updateScanResult = (index, field, value) => {
    setScanResults(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const updateAnswer = (resultIndex, answerIndex, value) => {
    setScanResults(prev => {
      const updated = [...prev];
      const newAnswers = [...updated[resultIndex].answers];
      newAnswers[answerIndex] = parseInt(value) || 0;
      updated[resultIndex].answers = newAnswers;
      return updated;
    });
  };

  // 채점 및 저장
  const saveAllResults = async () => {
    if (!selectedExam || scanResults.length === 0) return;

    setIsSaving(true);
    const saved = [];

    for (const result of scanResults) {
      if (result.error || !result.matchedStudentId) {
        saved.push({ ...result, saveStatus: result.error ? 'error' : 'not_found' });
        continue;
      }

      try {
        const gradingResult = gradeAnswers(result.answers, selectedExam);
        const studentsRef = collection(db, 'students');
        const snapshot = await getDocs(studentsRef);
        const studentDoc = snapshot.docs.find(doc => doc.data().id === result.matchedStudentId);

        if (studentDoc) {
          const studentData = studentDoc.data();
          const { month, week } = getMonthWeek(selectedExam.date);
          
          const examResult = {
            examId: selectedExam.id,
            examTitle: selectedExam.title,
            date: selectedExam.date,
            month, week,
            totalScore: gradingResult.totalScore,
            maxScore: gradingResult.maxScore,
            percentage: gradingResult.percentage,
            answers: result.answers,
            results: gradingResult.results,
            typeStats: gradingResult.typeStats,
            weakTypes: gradingResult.weakTypes,
            selectedSubject: result.selectedSubject || '화작'
          };

          await updateDoc(doc(db, 'students', studentDoc.id), {
            exams: [...(studentData.exams || []), examResult]
          });

          saved.push({ ...result, saveStatus: 'success', score: gradingResult.totalScore, maxScore: gradingResult.maxScore });
        }
      } catch (error) {
        saved.push({ ...result, saveStatus: 'error' });
      }
    }

    setSavedResults(saved);
    setIsSaving(false);
    alert(`${saved.filter(s => s.saveStatus === 'success').length}명 저장 완료`);
  };

  const gradeAnswers = (studentAnswers, exam) => {
    const results = [];
    let totalScore = 0, maxScore = 0;
    const typeStats = {};

    exam.answers.forEach((correctAnswer, index) => {
      const studentAnswer = studentAnswers[index] || 0;
      const isCorrect = studentAnswer === parseInt(correctAnswer);
      const score = exam.scores?.[index] || 2;
      const type = exam.types?.[index] || '독서_정보 독해';

      maxScore += score;
      if (isCorrect) totalScore += score;

      if (!typeStats[type]) typeStats[type] = { total: 0, correct: 0, totalScore: 0, earnedScore: 0 };
      typeStats[type].total++;
      typeStats[type].totalScore += score;
      if (isCorrect) { typeStats[type].correct++; typeStats[type].earnedScore += score; }

      results.push({ questionNum: index + 1, correct: correctAnswer, student: studentAnswer, isCorrect, score, type });
    });

    const weakTypes = Object.entries(typeStats)
      .map(([type, stats]) => ({ type, correctRate: Math.round((stats.correct / stats.total) * 100), total: stats.total, correct: stats.correct }))
      .filter(stat => stat.correctRate < 70)
      .sort((a, b) => a.correctRate - b.correctRate);

    return { totalScore, maxScore, percentage: ((totalScore / maxScore) * 100).toFixed(1), results, typeStats, weakTypes };
  };

  // 수동 저장
  const handleManualScoreSave = async () => {
    if (!manualScore.studentId || !selectedExamId) { alert('학생과 시험 선택'); return; }

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === manualScore.studentId);

      if (studentDoc) {
        const studentData = studentDoc.data();
        const { month, week } = getMonthWeek(selectedExam.date);
        const score = manualScore.score ? parseInt(manualScore.score) : null;

        const result = {
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          date: selectedExam.date,
          month, week,
          totalScore: score,
          maxScore: parseInt(manualScore.maxScore),
          percentage: score ? ((score / parseInt(manualScore.maxScore)) * 100).toFixed(1) : null,
          note: manualScore.note,
          manualEntry: true
        };

        await updateDoc(doc(db, 'students', studentDoc.id), { exams: [...(studentData.exams || []), result] });
        setManualScore({ studentId: '', score: '', maxScore: 100, note: '' });
        alert('저장 완료');
      }
    } catch (error) {
      alert('저장 실패: ' + error.message);
    }
  };

  // ===== 성적표 생성 =====
  const generateReport = () => {
    if (!reportStudentId || !reportExamId) { alert('학생과 시험 선택'); return; }

    const student = students.find(s => s.id === reportStudentId);
    const exam = exams.find(e => e.id === reportExamId);
    if (!student || !exam) return;

    const examResult = student.exams?.find(e => e.examId === reportExamId);
    if (!examResult) { alert('시험 결과 없음'); return; }

    // 평균 계산
    let totalStudents = 0, totalScoreSum = 0;
    students.forEach(s => {
      const result = s.exams?.find(e => e.examId === reportExamId);
      if (result?.totalScore) { totalStudents++; totalScoreSum += result.totalScore; }
    });
    const classAverage = totalStudents > 0 ? (totalScoreSum / totalStudents).toFixed(1) : 0;

    // 영역별 성취도 계산
    const typeScores = {};
    if (examResult.typeStats) {
      Object.entries(examResult.typeStats).forEach(([type, stats]) => {
        typeScores[type] = Math.round((stats.correct / stats.total) * 100);
      });
    }

    // 이전 시험
    const previousExams = (student.exams || [])
      .filter(e => e.examId !== reportExamId && e.typeStats)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    // 강점/약점 분석
    const sortedTypes = Object.entries(typeScores).sort((a, b) => b[1] - a[1]);
    const strongTypes = sortedTypes.filter(([_, rate]) => rate >= 80);
    const weakTypesArr = sortedTypes.filter(([_, rate]) => rate < 70);

    // 기본 멘트 생성
    let defaultStrength = '';
    let defaultWeakness = '';

    if (strongTypes.length > 0) {
      defaultStrength = `${strongTypes[0][0]} 영역의 성취도가 압도적입니다. 텍스트를 사실적으로 이해하는 능력이 매우 뛰어나 지문 분석 속도가 빠를 것으로 예상됩니다. 이 장점은 고난도 독서 지문에서 시간을 확보할 수 있는 핵심 경쟁력이 됩니다.`;
    } else {
      defaultStrength = '전반적으로 균형 잡힌 학습이 이루어지고 있습니다. 꾸준한 학습으로 모든 영역에서 안정적인 성취를 보이고 있습니다.';
    }

    if (weakTypesArr.length > 0) {
      defaultWeakness = `${weakTypesArr[0][0]} 적용 유형에서 치명적인 오답이 발생했습니다. 지문 내용은 이해하나, 조건이 추가되었을 때의 논리적 추론이 약합니다. 매일 2지문 이상의 추론형 문항 집중 훈련이 반드시 병행되어야 합니다.`;
    } else {
      defaultWeakness = '현재 모든 영역에서 70% 이상의 성취도를 보이고 있습니다. 고난도 문항에 대한 심화 학습을 권장합니다.';
    }

    // 변화 분석
    let defaultChange = '';
    if (previousExams.length > 0) {
      const prevResult = previousExams[0];
      const scoreDiff = examResult.totalScore - prevResult.totalScore;
      if (scoreDiff > 0) {
        defaultChange = `이전 시험 대비 ${scoreDiff}점 상승했습니다. 꾸준한 학습의 효과가 나타나고 있습니다. 현재 학습 방향을 유지하면서 약점 영역을 보완하면 더 좋은 결과를 기대할 수 있습니다.`;
      } else if (scoreDiff < 0) {
        defaultChange = `이전 시험 대비 ${Math.abs(scoreDiff)}점 하락했습니다. 약점 영역에 대한 집중 학습이 필요합니다. 오답 유형을 분석하고 해당 영역의 기본 개념부터 다시 점검해 보세요.`;
      } else {
        defaultChange = '이전 시험과 동일한 점수를 유지하고 있습니다. 안정적인 성취를 보이고 있으나, 성적 향상을 위해 약점 영역에 대한 집중 학습이 필요합니다.';
      }
    } else {
      defaultChange = '첫 시험 결과입니다. 이번 결과를 기준으로 학습 계획을 수립하시기 바랍니다.';
    }

    setStrengthComment(defaultStrength);
    setWeaknessComment(defaultWeakness);
    setChangeComment(defaultChange);

    setReportData({
      student, exam, examResult, classAverage, typeScores, previousExams, strongTypes, weakTypesArr
    });
  };

  // PDF 다운로드
  const downloadPdf = async () => {
    if (!reportRef.current) return;
    
    setIsGeneratingPdf(true);
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // 여백 설정 (mm)
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // 비율 계산 (여백 고려)
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      
      // 중앙 정렬
      const imgX = (pdfWidth - scaledWidth) / 2;
      const imgY = margin; // 상단 여백
      
      pdf.addImage(imgData, 'JPEG', imgX, imgY, scaledWidth, scaledHeight);
      
      pdf.save(`성적표_${reportData.student.name}_${reportData.exam.title}.pdf`);
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      alert('PDF 생성 실패');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 레이더 차트 SVG
  const RadarChart = ({ data }) => {
    const types = Object.keys(data);
    const values = Object.values(data);
    const n = types.length;
    if (n === 0) return null;

    const cx = 120, cy = 120, r = 80;
    const angleStep = (2 * Math.PI) / n;

    // 배경 다각형 (100%, 75%, 50%, 25%)
    const createPolygon = (radius) => {
      return types.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return `${x},${y}`;
      }).join(' ');
    };

    // 데이터 다각형
    const dataPoints = types.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const value = values[i] / 100;
      const x = cx + r * value * Math.cos(angle);
      const y = cy + r * value * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    // 레이블 위치
    const labels = types.map((type, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + (r + 25) * Math.cos(angle);
      const y = cy + (r + 25) * Math.sin(angle);
      const shortType = type.replace('독해', '').replace('영역', '').replace('_', '\n');
      return { x, y, text: shortType };
    });

    return (
      <svg viewBox="0 0 240 240" className="w-full h-full">
        {/* 배경 그리드 */}
        <polygon points={createPolygon(r)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={createPolygon(r * 0.75)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={createPolygon(r * 0.5)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={createPolygon(r * 0.25)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        
        {/* 축 */}
        {types.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x2 = cx + r * Math.cos(angle);
          const y2 = cy + r * Math.sin(angle);
          return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        
        {/* 데이터 영역 */}
        <polygon points={dataPoints} fill="rgba(99, 102, 241, 0.3)" stroke="#6366f1" strokeWidth="2" />
        
        {/* 데이터 포인트 */}
        {types.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const value = values[i] / 100;
          const x = cx + r * value * Math.cos(angle);
          const y = cy + r * value * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r="4" fill="#6366f1" />;
        })}
        
        {/* 레이블 */}
        {labels.map((label, i) => (
          <text key={i} x={label.x} y={label.y} textAnchor="middle" className="text-[8px] fill-gray-600">
            {label.text.split('\n').map((line, j) => (
              <tspan key={j} x={label.x} dy={j === 0 ? 0 : 10}>{line}</tspan>
            ))}
          </text>
        ))}
      </svg>
    );
  };

  // ★ 퍼스널 성취도용 레이더 차트 (4개 항목)
  const PersonalRadarChart = ({ data }) => {
    const types = Object.keys(data);
    const values = Object.values(data);
    const n = types.length;
    if (n === 0) return null;

    const cx = 120, cy = 120, r = 80;
    const angleStep = (2 * Math.PI) / n;

    // 배경 다각형 (100%, 75%, 50%, 25%)
    const createPolygon = (radius) => {
      return types.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return `${x},${y}`;
      }).join(' ');
    };

    // 데이터 다각형
    const dataPoints = types.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const value = values[i] / 100;
      const x = cx + r * value * Math.cos(angle);
      const y = cy + r * value * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');

    // 레이블 위치
    const labels = types.map((type, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + (r + 30) * Math.cos(angle);
      const y = cy + (r + 30) * Math.sin(angle);
      return { x, y, text: type, value: values[i] };
    });

    return (
      <svg viewBox="0 0 240 240" className="w-full h-full">
        {/* 배경 그리드 */}
        <polygon points={createPolygon(r)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={createPolygon(r * 0.75)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={createPolygon(r * 0.5)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={createPolygon(r * 0.25)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        
        {/* 축 */}
        {types.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x2 = cx + r * Math.cos(angle);
          const y2 = cy + r * Math.sin(angle);
          return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        
        {/* 데이터 영역 */}
        <polygon points={dataPoints} fill="rgba(99, 102, 241, 0.3)" stroke="#6366f1" strokeWidth="2" />
        
        {/* 데이터 포인트 */}
        {types.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const value = values[i] / 100;
          const x = cx + r * value * Math.cos(angle);
          const y = cy + r * value * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r="5" fill="#6366f1" />;
        })}
        
        {/* 레이블 */}
        {labels.map((label, i) => (
          <text key={i} x={label.x} y={label.y} textAnchor="middle" className="text-[10px] fill-gray-700 font-medium">
            {label.text}
            <tspan x={label.x} dy="12" className="text-[9px] fill-indigo-600 font-bold">{label.value}</tspan>
          </text>
        ))}
      </svg>
    );
  };

  // ★ 퍼스널 성취도 목록 불러오기
  const loadPersonalReports = async () => {
    setIsLoadingPersonalReports(true);
    try {
      const snapshot = await getDocs(collection(db, 'personalReports'));
      let reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 지점 필터링
      if (branch) {
        reports = reports.filter(r => !r.branch || r.branch === branch);
      }
      
      // 날짜순 정렬 (최신순)
      reports.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      setSavedPersonalReports(reports);
    } catch (error) {
      console.error('퍼스널 성취도 목록 로드 실패:', error);
    }
    setIsLoadingPersonalReports(false);
  };

  // ★ 퍼스널 성취도 저장
  const savePersonalReport = async () => {
    if (!personalData.studentName) {
      alert('학생 이름을 입력해주세요.');
      return;
    }
    
    setIsSavingPersonal(true);
    try {
      if (selectedPersonalReportId) {
        // 기존 문서 수정
        await updateDoc(doc(db, 'personalReports', selectedPersonalReportId), {
          ...personalData,
          branch: branch || '',
          updatedAt: serverTimestamp()
        });
        alert('수정되었습니다!');
      } else {
        // 새 문서 추가
        await addDoc(collection(db, 'personalReports'), {
          ...personalData,
          branch: branch || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        alert('저장되었습니다!');
      }
      loadPersonalReports();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
    setIsSavingPersonal(false);
  };

  // ★ 퍼스널 성취도 불러오기
  const loadPersonalReport = (report) => {
    setPersonalData({
      studentName: report.studentName || '',
      reportDate: report.reportDate || '',
      totalScore: report.totalScore || '',
      balanceScores: report.balanceScores || { 과제: 0, 훈련: 0, 과정: 0, 진단: 0 },
      detailContents: report.detailContents || { 과제점검: '', 훈련적용: '', 학습과정: '', 학습진단: '' },
      selfCheck1Title: report.selfCheck1Title || '',
      selfCheck1Content: report.selfCheck1Content || '',
      selfCheck2Title: report.selfCheck2Title || '',
      selfCheck2Content: report.selfCheck2Content || '',
      diagnosisMemo: report.diagnosisMemo || ''
    });
    setSelectedPersonalReportId(report.id);
  };

  // ★ 퍼스널 성취도 삭제
  const deletePersonalReport = async (reportId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, 'personalReports', reportId));
      alert('삭제되었습니다.');
      loadPersonalReports();
      if (selectedPersonalReportId === reportId) {
        resetPersonalForm();
      }
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // ★ 폼 초기화
  const resetPersonalForm = () => {
    setPersonalData({
      studentName: '',
      reportDate: '',
      totalScore: '',
      balanceScores: { 과제: 0, 훈련: 0, 과정: 0, 진단: 0 },
      detailContents: { 과제점검: '', 훈련적용: '', 학습과정: '', 학습진단: '' },
      selfCheck1Title: '',
      selfCheck1Content: '',
      selfCheck2Title: '',
      selfCheck2Content: '',
      diagnosisMemo: ''
    });
    setSelectedPersonalReportId('');
  };

  // ★ 퍼스널 성취도 PDF 다운로드 (수정됨)
  const downloadPersonalPdf = async () => {
    if (!personalData.studentName) {
      alert('학생 이름을 입력해주세요.');
      return;
    }
    
    if (!personalReportRef.current) return;
    
    setIsGeneratingPersonalPdf(true);
    try {
      // 기존 성적표와 동일한 방식으로 import
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      const element = personalReportRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // 여백 설정 (mm)
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // 비율 계산 (여백 고려)
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      
      // 중앙 정렬
      const imgX = (pdfWidth - scaledWidth) / 2;
      const imgY = margin;
      
      pdf.addImage(imgData, 'JPEG', imgX, imgY, scaledWidth, scaledHeight);
      pdf.save(`퍼스널성취도_${personalData.studentName}_${personalData.reportDate || new Date().toLocaleDateString('ko-KR')}.pdf`);
    } catch (error) {
      console.error('PDF 생성 실패:', error);
      alert('PDF 생성에 실패했습니다. 다시 시도해주세요.');
    }
    setIsGeneratingPersonalPdf(false);
  };

  // 퍼스널 탭 진입 시 목록 로드
  useEffect(() => {
    if (activeTab === 'personal') {
      loadPersonalReports();
    }
  }, [activeTab, branch]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Camera className="text-indigo-600" />
        OMR 일괄 채점
      </h2>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b">
        {['scan', 'manual', 'report', 'personal'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            {tab === 'scan' ? '📷 OMR 스캔' : tab === 'manual' ? '✏️ 수동 입력' : tab === 'report' ? '📄 성적표 생성' : '📋 퍼스널 성취도'}
          </button>
        ))}
      </div>

      {/* 시험 선택 */}
      {(activeTab === 'scan' || activeTab === 'manual') && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <label className="block text-sm font-medium mb-2">시험 선택</label>
          <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="w-full md:w-1/2 px-4 py-2 border rounded-lg">
            <option value="">-- 선택 --</option>
            {exams.map(exam => <option key={exam.id} value={exam.id}>{exam.title} ({exam.date})</option>)}
          </select>
        </div>
      )}

      {/* OMR 스캔 탭 */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" id="pdf-upload" />
            <label htmlFor="pdf-upload" className="cursor-pointer">
              {isLoadingPdf ? <Loader2 className="mx-auto h-12 w-12 text-indigo-500 animate-spin" /> : <File className="mx-auto h-12 w-12 text-gray-400" />}
              <p className="mt-2">{isLoadingPdf ? 'PDF 처리 중...' : 'PDF 파일 업로드'}</p>
            </label>
          </div>

          {pdfPages.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>추출된 OMR ({pdfPages.length}장)</span>
                <div className="flex items-center gap-2">
                  {/* 스캔 모드 선택 */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setScanMode('coordinate')}
                      className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${scanMode === 'coordinate' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}
                    >
                      <Crosshair size={14} />좌표
                    </button>
                    <button
                      onClick={() => setScanMode('vision')}
                      className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${scanMode === 'vision' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'}`}
                    >
                      <Camera size={14} />AI
                    </button>
                  </div>
                  {/* 스캔 버튼 */}
                  <button onClick={scanOMR} disabled={isScanning || !selectedExam} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                    {isScanning ? (
                      <><Loader2 className="animate-spin" size={18} />{scanProgress.current}/{scanProgress.total}</>
                    ) : (
                      <>{scanMode === 'coordinate' ? <Crosshair size={18} /> : <Camera size={18} />}{scanMode === 'coordinate' ? '좌표 인식' : 'AI 인식'}</>
                    )}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {pdfPages.map((page, i) => (
                  <div key={i} className="relative group">
                    <img src={page.preview} alt="" className="w-full h-32 object-contain border rounded bg-gray-100" />
                    <button onClick={() => removePage(i)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"><X size={12} /></button>
                  </div>
                ))}
              </div>
              {/* 스캔 모드 설명 */}
              <p className="text-xs text-gray-500">
                {scanMode === 'coordinate' 
                  ? '💡 좌표 인식: 빠르고 정확하지만 이름은 수동 입력 필요' 
                  : '💡 AI 인식: 이름/생년월일 자동 인식, 다소 느림'}
              </p>
            </div>
          )}

          {scanResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>인식 결과 ({scanResults.length}명)</span>
                <button onClick={saveAllResults} disabled={isSaving} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}저장
                </button>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead><tr className="bg-gray-100"><th className="px-2 py-2">상태</th><th className="px-2 py-2">이름</th><th className="px-2 py-2">학생</th><th className="px-2 py-2">답안</th><th className="px-2 py-2">수정</th></tr></thead>
                <tbody>
                  {scanResults.map((result, i) => {
                    const saved = savedResults.find(s => s.pageIndex === i);
                    return (
                      <React.Fragment key={i}>
                        <tr className="border-b">
                          <td className="px-2 py-2">{saved?.saveStatus === 'success' ? <span className="text-green-600">{saved.score}/{saved.maxScore}</span> : saved?.saveStatus ? <span className="text-yellow-600">!</span> : '-'}</td>
                          <td className="px-2 py-2">{result.studentName || '-'}</td>
                          <td className="px-2 py-2">
                            <select value={result.matchedStudentId || ''} onChange={(e) => updateScanResult(i, 'matchedStudentId', e.target.value)} className="w-24 border rounded px-1 py-1">
                              <option value="">선택</option>
                              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-gray-500">{result.answers?.slice(0, 6).join(',')}...</td>
                          <td className="px-2 py-2"><button onClick={() => setEditingIndex(editingIndex === i ? null : i)}>{editingIndex === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
                        </tr>
                        {editingIndex === i && (
                          <tr><td colSpan={5} className="bg-gray-50 p-3">
                            <div className="grid grid-cols-9 gap-1">
                              {result.answers?.map((ans, j) => (
                                <div key={j} className="flex items-center gap-1">
                                  <span className="text-xs w-4">{j+1}</span>
                                  <select value={ans} onChange={(e) => updateAnswer(i, j, e.target.value)} className={`w-10 border rounded text-xs ${ans === 0 ? 'bg-red-50' : ''}`}>
                                    <option value={0}>-</option>
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 수동 입력 탭 */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">학생</label>
              <select value={manualScore.studentId} onChange={(e) => setManualScore({...manualScore, studentId: e.target.value})} className="w-full px-4 py-2 border rounded-lg">
                <option value="">선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">점수</label>
              <div className="flex gap-2">
                <input type="number" value={manualScore.score} onChange={(e) => setManualScore({...manualScore, score: e.target.value})} className="flex-1 px-4 py-2 border rounded-lg" placeholder="점수" />
                <span className="flex items-center">/</span>
                <input type="number" value={manualScore.maxScore} onChange={(e) => setManualScore({...manualScore, maxScore: e.target.value})} className="w-16 px-2 py-2 border rounded-lg" />
              </div>
            </div>
          </div>
          <button onClick={handleManualScoreSave} disabled={!selectedExamId} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">저장</button>
        </div>
      )}

      {/* 성적표 생성 탭 */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* 선택 영역 */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
            <div>
              <label className="block text-sm font-medium mb-1">학생</label>
              <select value={reportStudentId} onChange={(e) => setReportStudentId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">시험</label>
              <select value={reportExamId} onChange={(e) => setReportExamId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={generateReport} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2">
                <FileText size={18} />생성
              </button>
            </div>
            <div className="flex items-end gap-2">
              {reportData && (
                <>
                  <button onClick={() => setIsEditingComments(!isEditingComments)} className="px-3 py-2 bg-yellow-500 text-white rounded-lg flex items-center gap-1">
                    <Edit3 size={16} />멘트 수정
                  </button>
                  <button onClick={downloadPdf} disabled={isGeneratingPdf} className="px-3 py-2 bg-green-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
                    {isGeneratingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 멘트 수정 영역 */}
          {isEditingComments && reportData && (
            <div className="p-4 bg-yellow-50 rounded-xl space-y-4">
              <h4 className="font-semibold text-yellow-800">📝 멘트 수정</h4>
              <div>
                <label className="block text-sm font-medium mb-1">강점 분석</label>
                <textarea value={strengthComment} onChange={(e) => setStrengthComment(e.target.value)} className="w-full px-3 py-2 border rounded-lg h-20" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">약점 및 제언</label>
                <textarea value={weaknessComment} onChange={(e) => setWeaknessComment(e.target.value)} className="w-full px-3 py-2 border rounded-lg h-20" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">변화 분석</label>
                <textarea value={changeComment} onChange={(e) => setChangeComment(e.target.value)} className="w-full px-3 py-2 border rounded-lg h-20" />
              </div>
            </div>
          )}

          {/* 성적표 미리보기 */}
          {reportData && (
            <div ref={reportRef} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden" style={{ maxWidth: '700px', margin: '0 auto' }}>
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 flex justify-between items-center">
                <div>
                  <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">PERSONAL DIAGNOSIS</span>
                  <span className="text-xs ml-2 opacity-80">ID: {reportData.student.id?.slice(0,4)}-{new Date().getFullYear()}{String(new Date().getMonth()+1).padStart(2,'0')}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs opacity-80">MY TOTAL SCORE</div>
                  <div className="text-2xl font-bold">{reportData.examResult.totalScore}<span className="text-sm opacity-80">/{reportData.examResult.maxScore}</span></div>
                </div>
              </div>

              {/* 제목 */}
              <div className="px-4 py-2 border-b">
                <h1 className="text-lg font-bold text-gray-800">국어 성취도 분석 리포트</h1>
                <p className="text-xs text-gray-500">{reportData.student.name} 학생 | {reportData.exam.date} {reportData.exam.title}</p>
              </div>

              <div className="p-4 space-y-4">
                {/* 영역별 분석 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 레이더 차트 */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      영역별 밸런스 분석
                    </h3>
                    <div className="w-40 h-40 mx-auto">
                      <RadarChart data={reportData.typeScores} />
                    </div>
                  </div>

                  {/* 영역별 성취도 */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      상세 영역별 성취도
                    </h3>
                    <div className="space-y-1">
                      {Object.entries(reportData.typeScores)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, rate]) => (
                          <div key={type} className={`flex justify-between items-center px-2 py-1 rounded text-xs ${rate < 70 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
                            <span>{type}</span>
                            <span className={`font-bold ${rate >= 80 ? 'text-blue-600' : rate >= 70 ? 'text-gray-700' : 'text-orange-600'}`}>{rate}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* 문항 채점표 */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    문항 채점표
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map(col => (
                      <table key={col} className="w-full border-collapse" style={{fontSize: '10px'}}>
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-1 py-0.5 w-8">문항</th>
                            <th className="border px-1 py-0.5">영역</th>
                            <th className="border px-1 py-0.5 w-8">배점</th>
                            <th className="border px-1 py-0.5 w-8">정답</th>
                            <th className="border px-1 py-0.5 w-8">채점</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.examResult.results
                            ?.slice(col * Math.ceil(reportData.examResult.results.length / 2), (col + 1) * Math.ceil(reportData.examResult.results.length / 2))
                            .map((r, i) => (
                              <tr key={i} className={!r.isCorrect ? 'bg-red-50' : ''}>
                                <td className="border px-1 py-0 text-center">{r.questionNum}</td>
                                <td className="border px-1 py-0 truncate" style={{maxWidth: '80px'}}>{r.type}</td>
                                <td className="border px-1 py-0 text-center">{r.score}</td>
                                <td className="border px-1 py-0 text-center">{r.correct}</td>
                                <td className="border px-1 py-0 text-center">{r.isCorrect ? <span className="text-blue-600">○</span> : <span className="text-red-600 font-bold">✗</span>}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    ))}
                  </div>
                </div>

                {/* 퍼스널 진단 */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3">
                  <h3 className="font-bold text-gray-800 mb-2 text-sm flex items-center gap-2">
                    ✨ 오늘의 국어_퍼스널 진단
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <h4 className="font-semibold text-blue-700 mb-1 text-xs">학습 강점 및 분석</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{strengthComment}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-orange-400">
                      <h4 className="font-semibold text-orange-700 mb-1 text-xs">학습 약점 및 제언</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{weaknessComment}</p>
                    </div>
                  </div>
                </div>

                {/* 학습 변화 (이전 시험이 있는 경우) */}
                {reportData.previousExams.length > 0 && (
                  <div className="border-t pt-3">
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      학습 변화 추이
                    </h3>
                    
                    {/* 간단한 점수 변화 표시 */}
                    <div className="flex items-center gap-3 mb-2">
                      {[...reportData.previousExams].reverse().slice(-3).map((prev, i) => (
                        <div key={i} className="text-center">
                          <div className="text-xs text-gray-500">{prev.date?.slice(5)}</div>
                          <div className="text-sm font-bold text-gray-400">{prev.totalScore}</div>
                        </div>
                      ))}
                      <div className="text-lg text-gray-300">→</div>
                      <div className="text-center">
                        <div className="text-xs text-blue-600 font-medium">현재</div>
                        <div className="text-lg font-bold text-blue-600">{reportData.examResult.totalScore}</div>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-2">
                      <h4 className="font-semibold text-blue-700 mb-1 text-xs">📈 변화 분석</h4>
                      <p className="text-xs text-gray-600">{changeComment}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 푸터 */}
              <div className="bg-gray-100 px-4 py-2 text-center text-xs text-gray-500">
                오늘의 국어 연구소 | {new Date().toLocaleDateString('ko-KR')} 생성
              </div>
            </div>
          )}
        </div>
      )}

      {/* ★ 퍼스널 성취도 탭 */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {/* 저장된 목록 */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-blue-800 flex items-center gap-2">
                <List size={18} />
                저장된 퍼스널 성취도
              </h3>
              <button
                onClick={resetPersonalForm}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                + 새로 작성
              </button>
            </div>
            
            {isLoadingPersonalReports ? (
              <div className="text-center py-4">
                <Loader2 className="animate-spin mx-auto text-blue-600" />
              </div>
            ) : savedPersonalReports.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">저장된 기록이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {savedPersonalReports.map(report => (
                  <div
                    key={report.id}
                    className={`p-2 rounded-lg cursor-pointer transition text-sm ${
                      selectedPersonalReportId === report.id 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white hover:bg-blue-100'
                    }`}
                  >
                    <div 
                      onClick={() => loadPersonalReport(report)}
                      className="font-medium"
                    >
                      {report.studentName}
                    </div>
                    <div className={`text-xs ${selectedPersonalReportId === report.id ? 'text-blue-200' : 'text-gray-500'}`}>
                      {report.reportDate || '날짜 없음'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePersonalReport(report.id);
                      }}
                      className={`text-xs mt-1 ${selectedPersonalReportId === report.id ? 'text-red-200 hover:text-red-100' : 'text-red-500 hover:text-red-700'}`}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 입력 폼 */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                📋 퍼스널 성취도 {selectedPersonalReportId ? '수정' : '입력'}
              </h3>
              {selectedPersonalReportId && (
                <span className="text-sm text-blue-600">수정 중...</span>
              )}
            </div>
            
            {/* 기본 정보 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">학생 이름</label>
                <input
                  type="text"
                  value={personalData.studentName}
                  onChange={(e) => setPersonalData({...personalData, studentName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="학생 이름"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">날짜</label>
                <input
                  type="text"
                  value={personalData.reportDate}
                  onChange={(e) => setPersonalData({...personalData, reportDate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 2025.01.06"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">총점</label>
                <input
                  type="text"
                  value={personalData.totalScore}
                  onChange={(e) => setPersonalData({...personalData, totalScore: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="예: 85/100"
                />
              </div>
            </div>

            {/* 영역별 밸런스 점수 (4가지) */}
            <div>
              <label className="block text-sm font-medium mb-2">영역별 밸런스 (0~100)</label>
              <div className="grid grid-cols-4 gap-4">
                {Object.keys(personalData.balanceScores).map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-600 mb-1">{key}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={personalData.balanceScores[key]}
                      onChange={(e) => setPersonalData({
                        ...personalData,
                        balanceScores: {...personalData.balanceScores, [key]: Number(e.target.value)}
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 상세 영역별 내용 (4가지) */}
            <div>
              <label className="block text-sm font-medium mb-2">상세 영역별 성취도</label>
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(personalData.detailContents).map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-600 mb-1">{key}</label>
                    <textarea
                      value={personalData.detailContents[key]}
                      onChange={(e) => setPersonalData({
                        ...personalData,
                        detailContents: {...personalData.detailContents, [key]: e.target.value}
                      })}
                      className="w-full px-3 py-2 border rounded-lg h-20"
                      placeholder={`${key} 내용 입력`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 자기 점검 (2단 박스) */}
            <div>
              <label className="block text-sm font-medium mb-2">자기 점검</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    value={personalData.selfCheck1Title}
                    onChange={(e) => setPersonalData({...personalData, selfCheck1Title: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg mb-2"
                    placeholder="제목 1"
                  />
                  <textarea
                    value={personalData.selfCheck1Content}
                    onChange={(e) => setPersonalData({...personalData, selfCheck1Content: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg h-24"
                    placeholder="내용 입력"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={personalData.selfCheck2Title}
                    onChange={(e) => setPersonalData({...personalData, selfCheck2Title: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg mb-2"
                    placeholder="제목 2"
                  />
                  <textarea
                    value={personalData.selfCheck2Content}
                    onChange={(e) => setPersonalData({...personalData, selfCheck2Content: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg h-24"
                    placeholder="내용 입력"
                  />
                </div>
              </div>
            </div>

            {/* 진단 메모 */}
            <div>
              <label className="block text-sm font-medium mb-2">진단 메모</label>
              <textarea
                value={personalData.diagnosisMemo}
                onChange={(e) => setPersonalData({...personalData, diagnosisMemo: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg h-32"
                placeholder="진단 메모 입력"
              />
            </div>

            {/* 저장 및 PDF 다운로드 버튼 */}
            <div className="flex justify-end gap-3">
              <button
                onClick={savePersonalReport}
                disabled={isSavingPersonal}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700"
              >
                {isSavingPersonal ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {selectedPersonalReportId ? '수정 저장' : '저장'}
              </button>
              <button
                onClick={downloadPersonalPdf}
                disabled={isGeneratingPersonalPdf}
                className="px-6 py-3 bg-green-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 hover:bg-green-700"
              >
                {isGeneratingPersonalPdf ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                PDF 다운로드
              </button>
            </div>
          </div>

          {/* 미리보기 */}
          <div ref={personalReportRef} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden" style={{ maxWidth: '700px', margin: '0 auto' }}>
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 flex justify-between items-center">
              <div>
                <span className="text-sm font-bold">오늘의 국어</span>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-80">퍼스널 성취도</div>
                <div className="text-2xl font-bold">{personalData.totalScore || '-'}</div>
              </div>
            </div>

            {/* 제목 */}
            <div className="px-4 py-2 border-b">
              <h1 className="text-lg font-bold text-gray-800">국어 컨설팅 분석 리포트</h1>
              <p className="text-xs text-gray-500">{personalData.studentName || '학생 이름'} 학생 | {personalData.reportDate || '날짜'}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* 영역별 분석 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 레이더 차트 */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    영역별 밸런스 분석
                  </h3>
                  <div className="w-40 h-40 mx-auto">
                    <PersonalRadarChart data={personalData.balanceScores} />
                  </div>
                </div>

                {/* 영역별 성취도 */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    상세 영역별 성취도
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(personalData.detailContents).map(([key, content]) => (
                      <div key={key} className="bg-gray-50 rounded p-2">
                        <div className="font-medium text-xs text-indigo-700 mb-1">{key}</div>
                        <p className="text-xs text-gray-600" style={{ whiteSpace: 'pre-wrap' }}>{content || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 자기 점검 (2단 박스) */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-2 text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                  자기 점검
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-1 text-xs font-medium">{personalData.selfCheck1Title || '제목 1'}</div>
                    <div className="px-3 py-2 min-h-[80px] text-xs" style={{ whiteSpace: 'pre-wrap' }}>{personalData.selfCheck1Content || ''}</div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-3 py-1 text-xs font-medium">{personalData.selfCheck2Title || '제목 2'}</div>
                    <div className="px-3 py-2 min-h-[80px] text-xs" style={{ whiteSpace: 'pre-wrap' }}>{personalData.selfCheck2Content || ''}</div>
                  </div>
                </div>
              </div>

              {/* 진단 메모 */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3">
                <h3 className="font-bold text-gray-800 mb-2 text-sm flex items-center gap-2">
                  ✨ 오늘의 국어_퍼스널 진단
                </h3>
                <div className="bg-white rounded-lg p-3 min-h-[100px] text-xs" style={{ whiteSpace: 'pre-wrap' }}>
                  {personalData.diagnosisMemo || ''}
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="bg-gray-100 px-4 py-2 text-center text-xs text-gray-500">
              오늘의 국어 연구소 | {new Date().toLocaleDateString('ko-KR')} 생성
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
