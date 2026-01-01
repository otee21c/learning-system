import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, Trash2, Edit3, Save, X, Check, 
  ChevronDown, ChevronUp, Camera, AlertCircle, Loader2,
  Download, RefreshCw, Users, CheckCircle
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
  
  // OMR 이미지 및 인식 결과
  const [omrImages, setOmrImages] = useState([]);
  const [scanResults, setScanResults] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  
  // 수정 모드
  const [editingIndex, setEditingIndex] = useState(null);
  
  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [savedResults, setSavedResults] = useState([]);

  // 수동 성적 입력용
  const todayMonthWeek = getTodayMonthWeek();
  const [manualScore, setManualScore] = useState({
    studentId: '',
    score: '',
    maxScore: 100,
    note: ''
  });

  // 영역별 색상
  const typeColors = {
    '독서_정보 독해': 'bg-blue-100 text-blue-700',
    '독서_의미 독해': 'bg-blue-200 text-blue-800',
    '독서_보기 독해': 'bg-blue-300 text-blue-900',
    '문학_정보 독해': 'bg-purple-100 text-purple-700',
    '문학_의미 독해': 'bg-purple-200 text-purple-800',
    '문학_보기 독해': 'bg-purple-300 text-purple-900',
    '화작 영역': 'bg-green-100 text-green-700',
    '언매 영역': 'bg-yellow-100 text-yellow-700'
  };

  // OMR 이미지 업로드
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newImages = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push({
          file: file,
          name: file.name,
          preview: reader.result,
          base64: reader.result.split(',')[1]
        });
        
        if (newImages.length === files.length) {
          setOmrImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 제거
  const removeImage = (index) => {
    setOmrImages(prev => prev.filter((_, i) => i !== index));
    setScanResults(prev => prev.filter((_, i) => i !== index));
  };

  // Claude Vision으로 OMR 인식
  const scanOMRWithVision = async () => {
    if (!selectedExam) {
      alert('먼저 시험을 선택해주세요.');
      return;
    }
    
    if (omrImages.length === 0) {
      alert('OMR 이미지를 업로드해주세요.');
      return;
    }

    setIsScanning(true);
    setScanProgress({ current: 0, total: omrImages.length });
    
    const results = [];
    
    for (let i = 0; i < omrImages.length; i++) {
      setScanProgress({ current: i + 1, total: omrImages.length });
      
      try {
        const result = await analyzeOMRImage(omrImages[i].base64, selectedExam);
        results.push({
          ...result,
          imageIndex: i,
          imageName: omrImages[i].name
        });
      } catch (error) {
        console.error(`이미지 ${i + 1} 분석 실패:`, error);
        results.push({
          error: true,
          errorMessage: error.message,
          imageIndex: i,
          imageName: omrImages[i].name,
          studentName: '',
          birthDate: '',
          answers: Array(selectedExam.totalQuestions).fill('')
        });
      }
    }
    
    setScanResults(results);
    setIsScanning(false);
  };

  // Claude Vision API 호출
  const analyzeOMRImage = async (base64Image, exam) => {
    const prompt = `이 OMR 카드 이미지를 분석해주세요.

분석할 내용:
1. 학생 이름 (왼쪽 상단 "성 명" 란의 한글 마킹)
2. 생년월일 (오른쪽 "생 일" 란의 숫자 마킹, 4자리 MMDD 형식)
3. 선택과목 표시 (오른쪽 상단 - 화법과 작문 또는 언어와 매체)
4. 1번부터 ${exam.totalQuestions}번까지의 답안 (각 문항당 1~5 중 마킹된 번호)

응답 형식 (JSON만 출력):
{
  "studentName": "홍길동",
  "birthDate": "0315",
  "selectedSubject": "화작" 또는 "언매",
  "answers": [2, 5, 3, 1, 4, ...] 
}

주의사항:
- 마킹이 불분명하면 0으로 표시
- 복수 마킹은 첫 번째 마킹 번호 사용
- answers 배열은 정확히 ${exam.totalQuestions}개여야 함
- JSON만 출력하고 다른 설명은 하지 마세요`;

    const response = await fetch('/api/analyze-omr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        prompt: prompt
      })
    });

    if (!response.ok) {
      throw new Error('OMR 분석 실패');
    }

    const data = await response.json();
    
    // JSON 파싱
    try {
      const jsonMatch = data.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
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
      if (field === 'answers') {
        updated[index].answers = value;
      } else {
        updated[index][field] = value;
      }
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
      if (result.error || !result.studentName) continue;

      try {
        // 학생 찾기 (이름 + 생일로 매칭)
        const student = students.find(s => 
          s.name === result.studentName && 
          (s.birthDate === result.birthDate || s.birthDate?.includes(result.birthDate))
        );

        if (!student) {
          saved.push({ ...result, saveStatus: 'not_found', message: '학생을 찾을 수 없음' });
          continue;
        }

        // 채점
        const gradingResult = gradeAnswers(result.answers, selectedExam);
        
        // 학생 데이터 업데이트
        const studentsRef = collection(db, 'students');
        const snapshot = await getDocs(studentsRef);
        const studentDoc = snapshot.docs.find(doc => doc.data().id === student.id);

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
            selectedSubject: result.selectedSubject,
            feedback: generateFeedback(gradingResult.weakTypes, gradingResult.typeStats)
          };

          const updatedExams = [...(studentData.exams || []), examResult];
          
          await updateDoc(doc(db, 'students', studentDoc.id), {
            exams: updatedExams
          });

          saved.push({ 
            ...result, 
            saveStatus: 'success', 
            message: '저장 완료',
            score: gradingResult.totalScore,
            maxScore: gradingResult.maxScore
          });
        }
      } catch (error) {
        console.error('저장 실패:', error);
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
      const score = exam.scores[index] || 2;
      const type = exam.types[index] || '독서_정보 독해';

      maxScore += score;
      if (isCorrect) totalScore += score;

      // 영역별 통계
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

    // 약점 영역 추출 (정답률 70% 미만)
    const weakTypes = Object.entries(typeStats)
      .map(([type, stats]) => ({
        type,
        correctRate: Math.round((stats.correct / stats.total) * 100),
        scoreRate: Math.round((stats.earnedScore / stats.totalScore) * 100),
        total: stats.total,
        correct: stats.correct
      }))
      .filter(stat => stat.correctRate < 70)
      .sort((a, b) => a.correctRate - b.correctRate);

    return {
      totalScore,
      maxScore,
      percentage: ((totalScore / maxScore) * 100).toFixed(1),
      results,
      typeStats,
      weakTypes
    };
  };

  // 피드백 생성
  const generateFeedback = (weakTypes, typeStats) => {
    if (weakTypes.length === 0) {
      return "모든 영역에서 우수한 성적을 보였습니다!";
    }

    let feedback = "📊 약점 진단\n\n";
    
    weakTypes.forEach((stat, index) => {
      feedback += `${index + 1}. ${stat.type}: 정답률 ${stat.correctRate}% (${stat.correct}/${stat.total}문항)\n`;
    });

    return feedback;
  };

  // 수동 성적 저장
  const handleManualScoreSave = async () => {
    if (!manualScore.studentId || !selectedExamId) {
      alert('학생과 시험을 선택해주세요.');
      return;
    }

    if (!manualScore.score && !manualScore.note) {
      alert('점수 또는 비고를 입력해주세요.');
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
          month: month,
          week: week,
          totalScore: score,
          maxScore: parseInt(manualScore.maxScore),
          percentage: hasScore ? ((score / parseInt(manualScore.maxScore)) * 100).toFixed(1) : null,
          note: manualScore.note,
          manualEntry: true,
          feedback: manualScore.note || '수동 입력'
        };

        const updatedExams = [...(studentData.exams || []), result];
        
        await updateDoc(doc(db, 'students', studentDoc.id), {
          exams: updatedExams
        });

        setManualScore({ studentId: '', score: '', maxScore: 100, note: '' });
        alert('성적이 저장되었습니다.');
      }
    } catch (error) {
      alert('저장 실패: ' + error.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Camera className="text-indigo-600" />
        OMR 일괄 채점
      </h2>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'scan' 
              ? 'text-indigo-600 border-b-2 border-indigo-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📷 OMR 스캔 채점
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'manual' 
              ? 'text-indigo-600 border-b-2 border-indigo-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ✏️ 수동 입력
        </button>
      </div>

      {/* 시험 선택 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          시험 선택
        </label>
        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- 시험을 선택하세요 --</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.title} ({exam.date}) - {exam.totalQuestions}문항
            </option>
          ))}
        </select>
        
        {selectedExam && (
          <div className="mt-3 text-sm text-gray-600">
            ✅ 선택됨: <strong>{selectedExam.title}</strong> | 
            문항 수: {selectedExam.totalQuestions}개 | 
            총점: {selectedExam.scores?.reduce((a, b) => a + b, 0) || 0}점
          </div>
        )}
      </div>

      {/* OMR 스캔 채점 탭 */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          {/* 이미지 업로드 */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              id="omr-upload"
            />
            <label 
              htmlFor="omr-upload"
              className="cursor-pointer"
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600">
                OMR 이미지를 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-gray-400 mt-1">
                여러 장 동시 업로드 가능 (JPG, PNG)
              </p>
            </label>
          </div>

          {/* 업로드된 이미지 미리보기 */}
          {omrImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">
                  업로드된 이미지 ({omrImages.length}장)
                </h3>
                <button
                  onClick={scanOMRWithVision}
                  disabled={isScanning || !selectedExam}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      인식 중... ({scanProgress.current}/{scanProgress.total})
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      AI로 일괄 인식
                    </>
                  )}
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {omrImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.preview}
                      alt={`OMR ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={14} />
                    </button>
                    <p className="text-xs text-gray-500 mt-1 truncate">{img.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 인식 결과 */}
          {scanResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">
                  인식 결과 ({scanResults.length}명)
                </h3>
                <button
                  onClick={saveAllResults}
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      일괄 저장
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-sm font-semibold">상태</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold">이름</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold">생일</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold">선택과목</th>
                      <th className="px-3 py-2 text-left text-sm font-semibold">답안 미리보기</th>
                      <th className="px-3 py-2 text-center text-sm font-semibold">수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.map((result, index) => {
                      const saved = savedResults.find(s => s.imageIndex === index);
                      
                      return (
                        <React.Fragment key={index}>
                          <tr className={`border-b hover:bg-gray-50 ${result.error ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2">
                              {saved?.saveStatus === 'success' ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <CheckCircle size={16} /> 저장됨 ({saved.score}/{saved.maxScore})
                                </span>
                              ) : saved?.saveStatus === 'not_found' ? (
                                <span className="text-yellow-600 flex items-center gap-1">
                                  <AlertCircle size={16} /> 학생 없음
                                </span>
                              ) : saved?.saveStatus === 'error' ? (
                                <span className="text-red-600 flex items-center gap-1">
                                  <AlertCircle size={16} /> 오류
                                </span>
                              ) : result.error ? (
                                <span className="text-red-600 flex items-center gap-1">
                                  <AlertCircle size={16} /> 인식 실패
                                </span>
                              ) : (
                                <span className="text-gray-400">대기</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={result.studentName || ''}
                                onChange={(e) => updateScanResult(index, 'studentName', e.target.value)}
                                className="w-24 px-2 py-1 border rounded text-sm"
                                placeholder="이름"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={result.birthDate || ''}
                                onChange={(e) => updateScanResult(index, 'birthDate', e.target.value)}
                                className="w-20 px-2 py-1 border rounded text-sm"
                                placeholder="MMDD"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={result.selectedSubject || '화작'}
                                onChange={(e) => updateScanResult(index, 'selectedSubject', e.target.value)}
                                className="px-2 py-1 border rounded text-sm"
                              >
                                <option value="화작">화작</option>
                                <option value="언매">언매</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600">
                              {result.answers?.slice(0, 10).join(', ')}...
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                                className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              >
                                {editingIndex === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            </td>
                          </tr>
                          
                          {/* 답안 수정 확장 행 */}
                          {editingIndex === index && (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 bg-gray-50">
                                <div className="grid grid-cols-5 md:grid-cols-9 gap-2">
                                  {result.answers?.map((ans, ansIdx) => (
                                    <div key={ansIdx} className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500 w-6">{ansIdx + 1}.</span>
                                      <select
                                        value={ans || 0}
                                        onChange={(e) => updateAnswer(index, ansIdx, e.target.value)}
                                        className="w-12 px-1 py-1 border rounded text-sm"
                                      >
                                        <option value={0}>-</option>
                                        <option value={1}>①</option>
                                        <option value={2}>②</option>
                                        <option value={3}>③</option>
                                        <option value={4}>④</option>
                                        <option value={5}>⑤</option>
                                      </select>
                                    </div>
                                  ))}
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
            </div>
          )}
        </div>
      )}

      {/* 수동 입력 탭 */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학생</label>
              <select
                value={manualScore.studentId}
                onChange={(e) => setManualScore({ ...manualScore, studentId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">-- 학생 선택 --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.grade})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">점수</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={manualScore.score}
                  onChange={(e) => setManualScore({ ...manualScore, score: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="점수"
                />
                <span className="flex items-center text-gray-500">/</span>
                <input
                  type="number"
                  value={manualScore.maxScore}
                  onChange={(e) => setManualScore({ ...manualScore, maxScore: e.target.value })}
                  className="w-20 px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="만점"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <input
              type="text"
              value={manualScore.note}
              onChange={(e) => setManualScore({ ...manualScore, note: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="결석, 기타 사유 등"
            />
          </div>

          <button
            onClick={handleManualScoreSave}
            disabled={!selectedExamId}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}
