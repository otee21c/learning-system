import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, Trash2, Edit3, Save, X, Check, 
  ChevronDown, ChevronUp, Camera, AlertCircle, Loader2,
  Download, RefreshCw, Users, CheckCircle, File, Printer,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getTodayMonthWeek, getMonthWeek } from '../../utils/dateUtils';

export default function OMRBatchGrading({ exams, students, branch }) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual' | 'report'
  
  // 시험 선택
  const [selectedExamId, setSelectedExamId] = useState('');
  const selectedExam = exams.find(e => e.id === selectedExamId);
  
  // PDF 및 인식 결과
  const [pdfPages, setPdfPages] = useState([]);
  const [scanResults, setScanResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  
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

  // PDF 파일 업로드 및 이미지 변환
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
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        
        pages.push({
          pageNum: i,
          preview: imageData,
          base64: imageData.split(',')[1]
        });
      }

      setPdfPages(pages);
      alert(`PDF에서 ${pages.length}장의 OMR을 추출했습니다.`);
    } catch (error) {
      console.error('PDF 처리 오류:', error);
      alert('PDF 처리 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // 페이지 제거
  const removePage = (index) => {
    setPdfPages(prev => prev.filter((_, i) => i !== index));
    setScanResults(prev => prev.filter((_, i) => i !== index));
  };

  // Claude Vision으로 OMR 인식
  const scanOMRWithVision = async () => {
    if (!selectedExam) {
      alert('먼저 시험을 선택해주세요.');
      return;
    }
    
    if (pdfPages.length === 0) {
      alert('PDF를 업로드해주세요.');
      return;
    }

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
          matchedStudentId: findMatchingStudent(result.studentName, result.birthDate)
        });
      } catch (error) {
        console.error(`페이지 ${i + 1} 분석 실패:`, error);
        results.push({
          error: true,
          errorMessage: error.message,
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

  // 학생 매칭 함수
  const findMatchingStudent = (name, birthDate) => {
    if (!name) return '';
    
    let match = students.find(s => s.name === name);
    if (match) return match.id;
    
    match = students.find(s => s.name.includes(name) || name.includes(s.name));
    if (match) return match.id;
    
    if (birthDate) {
      match = students.find(s => {
        const studentBirth = s.birthDate?.replace(/-/g, '').slice(-4) || '';
        return s.name.includes(name) && studentBirth.includes(birthDate);
      });
      if (match) return match.id;
    }
    
    return '';
  };

  // Claude Vision API 호출
  const analyzeOMRImage = async (base64Image, exam) => {
    const prompt = `이 OMR 답안지 이미지를 분석해주세요.

## 분석 대상
1. 학생 이름: 왼쪽 상단 "성 명" 영역의 한글 마킹
2. 생년월일: "생 일" 영역의 숫자 마킹 (4자리, MMDD 형식)
3. 선택과목: 오른쪽 상단 체크 표시 (화법과 작문 / 언어와 매체)
4. 답안: 1번부터 ${exam.totalQuestions}번까지 마킹된 번호 (1~5)

## 응답 형식 (JSON만 출력)
{
  "studentName": "홍길동",
  "birthDate": "0315",
  "selectedSubject": "화작",
  "answers": [2, 5, 3, 1, 4, ...]
}

주의: 마킹 없으면 0, answers는 ${exam.totalQuestions}개, JSON만 출력`;

    const response = await fetch('/api/analyze-omr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, prompt: prompt })
    });

    if (!response.ok) throw new Error('OMR 분석 실패');

    const data = await response.json();
    
    try {
      const jsonMatch = data.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        while (parsed.answers.length < exam.totalQuestions) {
          parsed.answers.push(0);
        }
        return parsed;
      }
    } catch (e) {
      console.error('JSON 파싱 오류:', e);
    }
    
    return {
      studentName: '',
      birthDate: '',
      selectedSubject: '화작',
      answers: Array(exam.totalQuestions).fill(0)
    };
  };

  // 인식 결과 수정
  const updateScanResult = (index, field, value) => {
    setScanResults(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  // 개별 답안 수정
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
    if (!selectedExam) {
      alert('시험을 선택해주세요.');
      return;
    }

    if (scanResults.length === 0) {
      alert('저장할 결과가 없습니다.');
      return;
    }

    setIsSaving(true);
    const saved = [];

    for (const result of scanResults) {
      if (result.error) {
        saved.push({ ...result, saveStatus: 'error', message: '인식 실패' });
        continue;
      }

      const studentId = result.matchedStudentId;
      
      if (!studentId) {
        saved.push({ ...result, saveStatus: 'not_found', message: '학생을 선택해주세요' });
        continue;
      }

      try {
        const student = students.find(s => s.id === studentId);
        if (!student) {
          saved.push({ ...result, saveStatus: 'not_found', message: '학생을 찾을 수 없음' });
          continue;
        }

        const gradingResult = gradeAnswers(result.answers, selectedExam);
        
        const studentsRef = collection(db, 'students');
        const snapshot = await getDocs(studentsRef);
        const studentDoc = snapshot.docs.find(doc => doc.data().id === studentId);

        if (studentDoc) {
          const studentData = studentDoc.data();
          const { month, week } = getMonthWeek(selectedExam.date);
          
          const examResult = {
            examId: selectedExam.id,
            examTitle: selectedExam.title,
            date: selectedExam.date,
            month: month,
            week: week,
            totalScore: gradingResult.totalScore,
            maxScore: gradingResult.maxScore,
            percentage: gradingResult.percentage,
            answers: result.answers,
            results: gradingResult.results,
            typeStats: gradingResult.typeStats,
            weakTypes: gradingResult.weakTypes,
            selectedSubject: result.selectedSubject || '화작',
            feedback: generateFeedback(gradingResult.weakTypes)
          };

          const updatedExams = [...(studentData.exams || []), examResult];
          
          await updateDoc(doc(db, 'students', studentDoc.id), {
            exams: updatedExams
          });

          saved.push({ 
            ...result, 
            saveStatus: 'success', 
            score: gradingResult.totalScore,
            maxScore: gradingResult.maxScore
          });
        }
      } catch (error) {
        saved.push({ ...result, saveStatus: 'error', message: error.message });
      }
    }

    setSavedResults(saved);
    setIsSaving(false);
    alert(`${saved.filter(s => s.saveStatus === 'success').length}명의 성적이 저장되었습니다.`);
  };

  // 채점 함수
  const gradeAnswers = (studentAnswers, exam) => {
    const results = [];
    let totalScore = 0;
    let maxScore = 0;
    const typeStats = {};

    exam.answers.forEach((correctAnswer, index) => {
      const studentAnswer = studentAnswers[index] || 0;
      const isCorrect = studentAnswer === parseInt(correctAnswer);
      const score = exam.scores?.[index] || 2;
      const type = exam.types?.[index] || '독서_정보 독해';

      maxScore += score;
      if (isCorrect) totalScore += score;

      if (!typeStats[type]) {
        typeStats[type] = { total: 0, correct: 0, totalScore: 0, earnedScore: 0 };
      }
      typeStats[type].total++;
      typeStats[type].totalScore += score;
      if (isCorrect) {
        typeStats[type].correct++;
        typeStats[type].earnedScore += score;
      }

      results.push({
        questionNum: index + 1,
        correct: correctAnswer,
        student: studentAnswer,
        isCorrect: isCorrect,
        score: score,
        type: type
      });
    });

    const weakTypes = Object.entries(typeStats)
      .map(([type, stats]) => ({
        type,
        correctRate: Math.round((stats.correct / stats.total) * 100),
        total: stats.total,
        correct: stats.correct
      }))
      .filter(stat => stat.correctRate < 70)
      .sort((a, b) => a.correctRate - b.correctRate);

    return { totalScore, maxScore, percentage: ((totalScore / maxScore) * 100).toFixed(1), results, typeStats, weakTypes };
  };

  // 피드백 생성
  const generateFeedback = (weakTypes) => {
    if (weakTypes.length === 0) return "모든 영역에서 우수한 성적을 보였습니다!";
    return weakTypes.map((s, i) => `${i + 1}. ${s.type}: 정답률 ${s.correctRate}%`).join('\n');
  };

  // 수동 성적 저장
  const handleManualScoreSave = async () => {
    if (!manualScore.studentId || !selectedExamId) {
      alert('학생과 시험을 선택해주세요.');
      return;
    }

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === manualScore.studentId);

      if (studentDoc) {
        const studentData = studentDoc.data();
        const { month, week } = getMonthWeek(selectedExam.date);
        
        const hasScore = manualScore.score && manualScore.score.trim() !== '';
        const score = hasScore ? parseInt(manualScore.score) : null;

        const result = {
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          date: selectedExam.date,
          month, week,
          totalScore: score,
          maxScore: parseInt(manualScore.maxScore),
          percentage: hasScore ? ((score / parseInt(manualScore.maxScore)) * 100).toFixed(1) : null,
          note: manualScore.note,
          manualEntry: true
        };

        const updatedExams = [...(studentData.exams || []), result];
        await updateDoc(doc(db, 'students', studentDoc.id), { exams: updatedExams });

        setManualScore({ studentId: '', score: '', maxScore: 100, note: '' });
        alert('성적이 저장되었습니다.');
      }
    } catch (error) {
      alert('저장 실패: ' + error.message);
    }
  };

  // ===== 성적표 생성 관련 함수 =====
  
  // 성적표 데이터 생성
  const generateReport = () => {
    if (!reportStudentId || !reportExamId) {
      alert('학생과 시험을 선택해주세요.');
      return;
    }

    const student = students.find(s => s.id === reportStudentId);
    const exam = exams.find(e => e.id === reportExamId);
    
    if (!student || !exam) {
      alert('학생 또는 시험 정보를 찾을 수 없습니다.');
      return;
    }

    // 해당 시험 결과 찾기
    const examResult = student.exams?.find(e => e.examId === reportExamId);
    
    if (!examResult) {
      alert('해당 학생의 시험 결과가 없습니다.');
      return;
    }

    // 전체 학생의 평균 계산
    let totalStudents = 0;
    let totalScoreSum = 0;
    
    students.forEach(s => {
      const result = s.exams?.find(e => e.examId === reportExamId);
      if (result && result.totalScore !== null) {
        totalStudents++;
        totalScoreSum += result.totalScore;
      }
    });
    
    const classAverage = totalStudents > 0 ? (totalScoreSum / totalStudents).toFixed(1) : 0;

    // 영역별 통계 계산 (전체 평균)
    const typeAverages = {};
    if (examResult.typeStats) {
      Object.keys(examResult.typeStats).forEach(type => {
        let typeTotal = 0;
        let typeCount = 0;
        
        students.forEach(s => {
          const result = s.exams?.find(e => e.examId === reportExamId);
          if (result?.typeStats?.[type]) {
            typeTotal += result.typeStats[type].earnedScore;
            typeCount++;
          }
        });
        
        typeAverages[type] = typeCount > 0 ? (typeTotal / typeCount).toFixed(1) : 0;
      });
    }

    // 이전 시험들과 비교 (누적 변화)
    const previousExams = (student.exams || [])
      .filter(e => e.examId !== reportExamId && e.typeStats)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    // 약점 변화 분석
    const weaknessChange = analyzeWeaknessChange(examResult, previousExams);

    setReportData({
      student,
      exam,
      examResult,
      classAverage,
      typeAverages,
      previousExams,
      weaknessChange
    });
  };

  // 약점 변화 분석
  const analyzeWeaknessChange = (currentResult, previousExams) => {
    const changes = [];
    
    if (!currentResult.typeStats || previousExams.length === 0) {
      return { changes: [], summary: '첫 시험 결과입니다.' };
    }

    const currentStats = currentResult.typeStats;
    const prevResult = previousExams[0];
    const prevStats = prevResult?.typeStats || {};

    Object.keys(currentStats).forEach(type => {
      const current = currentStats[type];
      const prev = prevStats[type];
      
      const currentRate = Math.round((current.correct / current.total) * 100);
      
      if (prev) {
        const prevRate = Math.round((prev.correct / prev.total) * 100);
        const diff = currentRate - prevRate;
        
        changes.push({
          type,
          currentRate,
          prevRate,
          diff,
          trend: diff > 5 ? 'up' : diff < -5 ? 'down' : 'same'
        });
      } else {
        changes.push({
          type,
          currentRate,
          prevRate: null,
          diff: null,
          trend: 'new'
        });
      }
    });

    // 요약 생성
    const improved = changes.filter(c => c.trend === 'up');
    const declined = changes.filter(c => c.trend === 'down');
    const weak = changes.filter(c => c.currentRate < 70);

    let summary = '';
    if (improved.length > 0) {
      summary += `✅ 개선된 영역: ${improved.map(c => `${c.type}(+${c.diff}%p)`).join(', ')}\n`;
    }
    if (declined.length > 0) {
      summary += `⚠️ 하락한 영역: ${declined.map(c => `${c.type}(${c.diff}%p)`).join(', ')}\n`;
    }
    if (weak.length > 0) {
      summary += `📌 집중 필요: ${weak.map(c => `${c.type}(${c.currentRate}%)`).join(', ')}`;
    }
    if (!summary) {
      summary = '전반적으로 안정적인 성적을 유지하고 있습니다.';
    }

    return { changes, summary };
  };

  // 인쇄 함수
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Camera className="text-indigo-600" />
        OMR 일괄 채점
      </h2>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 mb-6 border-b print:hidden">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-4 py-2 font-medium transition ${activeTab === 'scan' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
        >
          📷 OMR 스캔 채점
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 font-medium transition ${activeTab === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
        >
          ✏️ 수동 입력
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2 font-medium transition ${activeTab === 'report' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
        >
          📄 성적표 생성
        </button>
      </div>

      {/* 시험 선택 (스캔/수동 탭) */}
      {(activeTab === 'scan' || activeTab === 'manual') && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl print:hidden">
          <label className="block text-sm font-medium text-gray-700 mb-2">시험 선택</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">-- 시험을 선택하세요 --</option>
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.date}) - {exam.totalQuestions}문항
              </option>
            ))}
          </select>
          {selectedExam && (
            <div className="mt-2 text-sm text-gray-600">
              ✅ {selectedExam.title} | {selectedExam.totalQuestions}문항 | {selectedExam.scores?.reduce((a, b) => a + b, 0)}점
            </div>
          )}
        </div>
      )}

      {/* OMR 스캔 탭 */}
      {activeTab === 'scan' && (
        <div className="space-y-6 print:hidden">
          {/* PDF 업로드 */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
            <input type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" id="pdf-upload" />
            <label htmlFor="pdf-upload" className="cursor-pointer">
              {isLoadingPdf ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 text-indigo-500 animate-spin mb-3" />
                  <p className="text-indigo-600 font-medium">PDF 처리 중...</p>
                </>
              ) : (
                <>
                  <File className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-600"><span className="font-medium text-indigo-600">PDF 파일</span>을 클릭하여 업로드</p>
                  <p className="text-sm text-gray-400 mt-1">스캔된 OMR PDF 파일</p>
                </>
              )}
            </label>
          </div>

          {/* 페이지 미리보기 */}
          {pdfPages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">추출된 OMR ({pdfPages.length}장)</h3>
                <button
                  onClick={scanOMRWithVision}
                  disabled={isScanning || !selectedExam}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {isScanning ? <><Loader2 className="animate-spin" size={18} />인식 중... ({scanProgress.current}/{scanProgress.total})</> : <><Camera size={18} />AI로 일괄 인식</>}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {pdfPages.map((page, index) => (
                  <div key={index} className="relative group">
                    <img src={page.preview} alt={`OMR ${page.pageNum}`} className="w-full h-40 object-contain rounded-lg border bg-gray-100" />
                    <button onClick={() => removePage(index)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"><X size={14} /></button>
                    <p className="text-xs text-gray-500 mt-1 text-center">{page.pageNum}페이지</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 인식 결과 */}
          {scanResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">인식 결과 ({scanResults.length}명)</h3>
                <button onClick={saveAllResults} disabled={isSaving} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <><Loader2 className="animate-spin" size={18} />저장 중...</> : <><Save size={18} />일괄 저장</>}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left">상태</th>
                      <th className="px-3 py-2 text-left">인식 이름</th>
                      <th className="px-3 py-2 text-left">학생 선택</th>
                      <th className="px-3 py-2 text-left">생일</th>
                      <th className="px-3 py-2 text-left">선택과목</th>
                      <th className="px-3 py-2 text-left">답안</th>
                      <th className="px-3 py-2 text-center">수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.map((result, index) => {
                      const saved = savedResults.find(s => s.pageIndex === index);
                      return (
                        <React.Fragment key={index}>
                          <tr className={`border-b hover:bg-gray-50 ${result.error ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2">
                              {saved?.saveStatus === 'success' ? <span className="text-green-600 flex items-center gap-1"><CheckCircle size={16} />{saved.score}/{saved.maxScore}</span>
                                : saved?.saveStatus === 'not_found' ? <span className="text-yellow-600 flex items-center gap-1"><AlertCircle size={16} />선택 필요</span>
                                : result.error ? <span className="text-red-600"><AlertCircle size={16} /></span>
                                : <span className="text-gray-400">대기</span>}
                            </td>
                            <td className="px-3 py-2">{result.studentName || '(미인식)'}</td>
                            <td className="px-3 py-2">
                              <select value={result.matchedStudentId || ''} onChange={(e) => updateScanResult(index, 'matchedStudentId', e.target.value)} className="w-28 px-2 py-1 border rounded">
                                <option value="">-- 선택 --</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2"><input type="text" value={result.birthDate || ''} onChange={(e) => updateScanResult(index, 'birthDate', e.target.value)} className="w-14 px-1 py-1 border rounded" /></td>
                            <td className="px-3 py-2">
                              <select value={result.selectedSubject || '화작'} onChange={(e) => updateScanResult(index, 'selectedSubject', e.target.value)} className="px-1 py-1 border rounded">
                                <option value="화작">화작</option>
                                <option value="언매">언매</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{result.answers?.slice(0, 8).join(', ')}...</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => setEditingIndex(editingIndex === index ? null : index)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                                {editingIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            </td>
                          </tr>
                          {editingIndex === index && (
                            <tr><td colSpan={7} className="px-3 py-4 bg-gray-50">
                              <div className="grid grid-cols-5 md:grid-cols-9 gap-2">
                                {result.answers?.map((ans, ansIdx) => (
                                  <div key={ansIdx} className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500 w-5">{ansIdx + 1}.</span>
                                    <select value={ans || 0} onChange={(e) => updateAnswer(index, ansIdx, e.target.value)} className={`w-12 px-1 py-1 border rounded ${ans === 0 ? 'border-red-300 bg-red-50' : ''}`}>
                                      <option value={0}>-</option>
                                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{['①','②','③','④','⑤'][n-1]}</option>)}
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
            </div>
          )}
        </div>
      )}

      {/* 수동 입력 탭 */}
      {activeTab === 'manual' && (
        <div className="space-y-4 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">학생</label>
              <select value={manualScore.studentId} onChange={(e) => setManualScore({ ...manualScore, studentId: e.target.value })} className="w-full px-4 py-2 border rounded-lg">
                <option value="">-- 학생 선택 --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">점수</label>
              <div className="flex gap-2">
                <input type="number" value={manualScore.score} onChange={(e) => setManualScore({ ...manualScore, score: e.target.value })} className="flex-1 px-4 py-2 border rounded-lg" placeholder="점수" />
                <span className="flex items-center">/</span>
                <input type="number" value={manualScore.maxScore} onChange={(e) => setManualScore({ ...manualScore, maxScore: e.target.value })} className="w-20 px-4 py-2 border rounded-lg" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">비고</label>
            <input type="text" value={manualScore.note} onChange={(e) => setManualScore({ ...manualScore, note: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="결석 등" />
          </div>
          <button onClick={handleManualScoreSave} disabled={!selectedExamId} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">저장</button>
        </div>
      )}

      {/* 성적표 생성 탭 */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* 선택 영역 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl print:hidden">
            <div>
              <label className="block text-sm font-medium mb-1">학생 선택</label>
              <select value={reportStudentId} onChange={(e) => setReportStudentId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                <option value="">-- 학생 --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">시험 선택</label>
              <select value={reportExamId} onChange={(e) => setReportExamId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                <option value="">-- 시험 --</option>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title} ({e.date})</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={generateReport} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2">
                <FileText size={18} />성적표 생성
              </button>
              {reportData && (
                <button onClick={handlePrint} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2">
                  <Printer size={18} />인쇄/PDF
                </button>
              )}
            </div>
          </div>

          {/* 성적표 미리보기 */}
          {reportData && (
            <div ref={reportRef} className="bg-white border rounded-xl overflow-hidden print:border-0 print:shadow-none">
              {/* 헤더 */}
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">{reportData.exam.title}</h1>
                <span className="text-blue-100">오늘의국어학원</span>
              </div>

              <div className="p-6 space-y-6">
                {/* 학생 정보 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 font-semibold text-blue-800 flex items-center gap-2">
                    <CheckCircle size={18} />학생 정보
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="px-4 py-2 bg-gray-50 font-medium w-24">성 명</td>
                        <td className="px-4 py-2">{reportData.student.name}</td>
                        <td className="px-4 py-2 bg-gray-50 font-medium w-24">학 교</td>
                        <td className="px-4 py-2">{reportData.student.school || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 bg-gray-50 font-medium">시험일</td>
                        <td className="px-4 py-2">{reportData.exam.date}</td>
                        <td className="px-4 py-2 bg-gray-50 font-medium">시험명</td>
                        <td className="px-4 py-2">{reportData.exam.title}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 성적 요약 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 font-semibold text-blue-800 flex items-center gap-2">
                    <CheckCircle size={18} />성적 요약
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 border-r">내점수/만점</th>
                        <th className="px-4 py-2">전체 평균</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 text-center text-lg font-bold text-blue-600 border-r">
                          {reportData.examResult.totalScore}/{reportData.examResult.maxScore}
                        </td>
                        <td className="px-4 py-3 text-center text-lg">{reportData.classAverage}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 영역별 점수 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 font-semibold text-blue-800 flex items-center gap-2">
                    <CheckCircle size={18} />영역별 점수
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left">영 역</th>
                        <th className="px-3 py-2 text-center">문항수</th>
                        <th className="px-3 py-2 text-center">정답수</th>
                        <th className="px-3 py-2 text-center">내점수</th>
                        <th className="px-3 py-2 text-center">평 균</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.examResult.typeStats && Object.entries(reportData.examResult.typeStats).map(([type, stats]) => (
                        <tr key={type} className="border-t">
                          <td className="px-3 py-2">{type}</td>
                          <td className="px-3 py-2 text-center">{stats.total}</td>
                          <td className="px-3 py-2 text-center">{stats.correct}</td>
                          <td className="px-3 py-2 text-center font-medium">{stats.earnedScore}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{reportData.typeAverages[type]}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-gray-50 font-semibold">
                        <td className="px-3 py-2">합 계</td>
                        <td className="px-3 py-2 text-center">{reportData.exam.totalQuestions}</td>
                        <td className="px-3 py-2 text-center">{reportData.examResult.results?.filter(r => r.isCorrect).length || 0}</td>
                        <td className="px-3 py-2 text-center text-blue-600">{reportData.examResult.totalScore}</td>
                        <td className="px-3 py-2 text-center">{reportData.classAverage}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 약점 진단 멘트 */}
                <div className="border rounded-lg overflow-hidden bg-orange-50">
                  <div className="px-4 py-2 font-semibold text-orange-800 flex items-center gap-2">
                    📊 약점 진단
                  </div>
                  <div className="px-4 py-3 text-sm">
                    {reportData.examResult.weakTypes?.length > 0 ? (
                      <ul className="space-y-1">
                        {reportData.examResult.weakTypes.map((w, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-orange-600">•</span>
                            <span className="font-medium">{w.type}</span>: 정답률 {w.correctRate}% ({w.correct}/{w.total}문항)
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-green-700">✅ 모든 영역에서 우수한 성적을 보였습니다!</p>
                    )}
                  </div>
                </div>

                {/* 누적 변화 멘트 */}
                {reportData.previousExams.length > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-blue-50">
                    <div className="px-4 py-2 font-semibold text-blue-800 flex items-center gap-2">
                      📈 학습 변화 분석
                    </div>
                    <div className="px-4 py-3 text-sm whitespace-pre-wrap">
                      {reportData.weaknessChange.summary}
                    </div>
                  </div>
                )}

                {/* 문항 채점표 */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2 font-semibold text-blue-800 flex items-center gap-2">
                    <CheckCircle size={18} />문항 채점표
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-center w-12">문항</th>
                          <th className="px-2 py-1 text-left">영역/유형</th>
                          <th className="px-2 py-1 text-center w-12">배점</th>
                          <th className="px-2 py-1 text-center w-12">정답</th>
                          <th className="px-2 py-1 text-center w-12">채점</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.examResult.results?.map((r, i) => (
                          <tr key={i} className={`border-t ${!r.isCorrect ? 'bg-red-50' : ''}`}>
                            <td className="px-2 py-1 text-center">{r.questionNum}</td>
                            <td className="px-2 py-1 text-xs">{r.type}</td>
                            <td className="px-2 py-1 text-center">{r.score}</td>
                            <td className="px-2 py-1 text-center">{r.correct}</td>
                            <td className="px-2 py-1 text-center">
                              {r.isCorrect ? <span className="text-blue-600">○</span> : <span className="text-red-600 font-bold">✗</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 성적 현황 (이전 시험 이력) */}
                {reportData.previousExams.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-4 py-2 font-semibold text-blue-800 flex items-center gap-2">
                      <CheckCircle size={18} />성적 현황
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2">순번</th>
                          <th className="px-3 py-2 text-left">시험명</th>
                          <th className="px-3 py-2">채점일</th>
                          <th className="px-3 py-2">내점수/만점</th>
                          <th className="px-3 py-2">백분위</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t bg-blue-50">
                          <td className="px-3 py-2 text-center font-bold">현재</td>
                          <td className="px-3 py-2 font-medium">{reportData.exam.title}</td>
                          <td className="px-3 py-2 text-center">{reportData.exam.date}</td>
                          <td className="px-3 py-2 text-center font-bold text-blue-600">
                            {reportData.examResult.totalScore}/{reportData.examResult.maxScore}
                          </td>
                          <td className="px-3 py-2 text-center">{reportData.examResult.percentage}%</td>
                        </tr>
                        {reportData.previousExams.map((prev, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2 text-center">{i + 1}</td>
                            <td className="px-3 py-2">{prev.examTitle}</td>
                            <td className="px-3 py-2 text-center">{prev.date}</td>
                            <td className="px-3 py-2 text-center">{prev.totalScore}/{prev.maxScore}</td>
                            <td className="px-3 py-2 text-center">{prev.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 푸터 */}
              <div className="bg-gray-100 px-6 py-3 text-center text-sm text-gray-500">
                오늘의 국어 연구소 | {new Date().toLocaleDateString('ko-KR')} 생성
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
