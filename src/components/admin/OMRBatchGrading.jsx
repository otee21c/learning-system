import React, { useState } from 'react';
import { Upload, FileText, Trash2, Edit3, Save } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getTodayMonthWeek } from '../../utils/dateUtils';

export default function OMRBatchGrading({ exams, students }) {
  // 월/주차 선택 (기본값: 현재 월/주차)
  const todayMonthWeek = getTodayMonthWeek();
  const [selectedMonth, setSelectedMonth] = useState(todayMonthWeek.month);
  const [selectedWeek, setSelectedWeek] = useState(todayMonthWeek.week);
  
  // 선택한 월/주차에 해당하는 시험만 필터링
  const filteredExams = exams.filter(exam => 
    exam.month === selectedMonth && exam.week === selectedWeek
  );
  
  const [batchGrading, setBatchGrading] = useState({
    selectedExam: null,
    omrList: []
  });

  // 수동 성적 기록용 state
  const [manualScore, setManualScore] = useState({
    studentId: '',
    examId: '',
    score: ''
  });

  // 수동 성적 기록 저장
  const handleManualScoreSave = async () => {
    if (!manualScore.studentId || !manualScore.examId || !manualScore.score) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    const exam = exams.find(e => e.id === manualScore.examId);
    if (!exam) {
      alert('시험을 찾을 수 없습니다.');
      return;
    }

    const score = parseInt(manualScore.score);
    const maxScore = exam.scores.reduce((a, b) => a + b, 0);

    if (score < 0 || score > maxScore) {
      alert(`점수는 0점에서 ${maxScore}점 사이여야 합니다.`);
      return;
    }

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === manualScore.studentId);
      
      if (studentDoc) {
        const studentData = studentDoc.data();
        
        // 간단한 결과 객체 생성 (수동 입력이므로 상세 분석 없음)
        const result = {
          examId: exam.id,
          examTitle: exam.title,
          date: new Date().toISOString().split('T')[0],
          totalScore: score,
          maxScore: maxScore,
          percentage: ((score / maxScore) * 100).toFixed(1),
          results: [], // 수동 입력이므로 문항별 결과 없음
          typeStats: {},
          weakTypes: [],
          feedback: '수동으로 입력된 성적입니다.',
          manualEntry: true // 수동 입력 표시
        };
        
        const updatedExams = [...(studentData.exams || []), result];
        
        await updateDoc(doc(db, 'students', studentDoc.id), {
          exams: updatedExams
        });
        
        setManualScore({ studentId: '', examId: '', score: '' });
        alert('성적이 기록되었습니다!');
      } else {
        alert('학생을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('성적 기록 실패:', error);
      alert('성적 기록에 실패했습니다: ' + error.message);
    }
  };

  // 피드백 생성
  const generateFeedback = (weakTypes) => {
    if (weakTypes.length === 0) {
      return "모든 영역에서 우수한 성적을 보였습니다! 현재 수준을 유지하세요.";
    }

    const feedbackMap = {
      '사실적 이해': '지문에 직접 제시된 내용을 정확히 파악하는 연습이 필요합니다.',
      '추론적 이해': '글의 숨은 의미와 작가의 의도를 파악하는 능력이 부족합니다.',
      '비판적 이해': '글의 논리와 주장을 평가하는 능력을 키워야 합니다.',
      '어휘/문법': '어휘력과 문법 지식이 부족합니다.',
      '문학 감상': '작품의 정서와 분위기를 이해하는 능력이 필요합니다.',
      '작품 분석': '작품의 표현 기법과 구조를 분석하는 연습이 필요합니다.'
    };

    let feedback = "약점 영역 분석\n\n";
    
    weakTypes.forEach((stat, index) => {
      feedback += `${index + 1}. ${stat.type} (정답률 ${stat.correctRate}%)\n`;
      feedback += `   - ${feedbackMap[stat.type]}\n\n`;
    });

    return feedback;
  };

  // OMR 이미지 업로드
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const exam = exams.find(e => e.id === batchGrading.selectedExam);
    if (!exam) return;

    const newOMRs = [];

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileName = file.name.replace(/\.(jpg|jpeg|png|gif)$/i, '');
        
        let matchedStudent = null;
        
        // 이름_생년월일 패턴으로 매칭
        const nameBirthPattern = /(.+)_(\d{4})/;
        const match = fileName.match(nameBirthPattern);
        
        if (match) {
          const [, name, birthDate] = match;
          matchedStudent = students.find(s => 
            s.name.toLowerCase().includes(name.toLowerCase()) && 
            s.birthDate === birthDate
          );
        }
        
        // 매칭 실패 시 이름이나 ID로 재시도
        if (!matchedStudent) {
          matchedStudent = students.find(s => 
            fileName.toLowerCase().includes(s.id.toLowerCase()) ||
            fileName.toLowerCase().includes(s.name.toLowerCase())
          );
        }

        const omr = {
          id: Date.now() + index,
          studentId: matchedStudent?.id || '',
          studentName: matchedStudent?.name || '미매칭',
          studentBirthDate: matchedStudent?.birthDate || '',
          imagePreview: reader.result,
          fileName: file.name,
          answers: Array(exam.totalQuestions).fill(''),
          autoMatched: !!matchedStudent
        };

        newOMRs.push(omr);

        if (newOMRs.length === files.length) {
          setBatchGrading({
            ...batchGrading,
            omrList: [...batchGrading.omrList, ...newOMRs]
          });
          alert(`${files.length}개의 OMR이 업로드되었습니다.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // OMR 학생 매칭 변경
  const updateOMRStudent = (omrId, studentId) => {
    const student = students.find(s => s.id === studentId);
    setBatchGrading({
      ...batchGrading,
      omrList: batchGrading.omrList.map(omr => 
        omr.id === omrId ? { 
          ...omr, 
          studentId, 
          studentName: student?.name || '미매칭', 
          studentBirthDate: student?.birthDate || '' 
        } : omr
      )
    });
  };

  // OMR 답안 업데이트
  const updateOMRAnswers = (omrId, answers) => {
    setBatchGrading({
      ...batchGrading,
      omrList: batchGrading.omrList.map(omr => 
        omr.id === omrId ? { ...omr, answers } : omr
      )
    });
  };

  // OMR 삭제
  const removeOMR = (omrId) => {
    setBatchGrading({
      ...batchGrading,
      omrList: batchGrading.omrList.filter(omr => omr.id !== omrId)
    });
  };

  // 일괄 채점
  const handleBatchGrade = async () => {
    if (batchGrading.omrList.length === 0) {
      alert('채점할 OMR이 없습니다.');
      return;
    }

    const exam = exams.find(e => e.id === batchGrading.selectedExam);
    if (!exam) return;

    let gradedCount = 0;

    // 각 학생별로 채점
    for (const omr of batchGrading.omrList) {
      if (!omr.studentId) continue;

      let totalScore = 0;
      const results = [];
      const typeStats = {};

      for (let i = 0; i < exam.totalQuestions; i++) {
        const isCorrect = omr.answers[i] === exam.answers[i];
        const questionType = exam.types[i];
        
        if (isCorrect) {
          totalScore += exam.scores[i];
        }
        
        results.push({
          questionNum: i + 1,
          studentAnswer: omr.answers[i],
          correctAnswer: exam.answers[i],
          isCorrect,
          score: isCorrect ? exam.scores[i] : 0,
          type: questionType
        });

        if (!typeStats[questionType]) {
          typeStats[questionType] = { total: 0, correct: 0, incorrect: 0 };
        }
        typeStats[questionType].total++;
        if (isCorrect) {
          typeStats[questionType].correct++;
        } else {
          typeStats[questionType].incorrect++;
        }
      }

      const weakTypes = Object.entries(typeStats)
        .map(([type, stats]) => ({
          type,
          correctRate: (stats.correct / stats.total * 100).toFixed(1),
          ...stats
        }))
        .filter(stat => stat.correctRate < 70)
        .sort((a, b) => a.correctRate - b.correctRate);

      const feedback = generateFeedback(weakTypes);

      const maxScore = exam.scores.reduce((a, b) => a + b, 0);
      const result = {
        examId: exam.id,
        examTitle: exam.title,
        date: new Date().toISOString().split('T')[0],
        totalScore,
        maxScore,
        percentage: ((totalScore / maxScore) * 100).toFixed(1),
        results,
        typeStats,
        weakTypes,
        feedback
      };

      // Firestore에 저장
      try {
        const studentsRef = collection(db, 'students');
        const snapshot = await getDocs(studentsRef);
        const studentDoc = snapshot.docs.find(doc => doc.data().id === omr.studentId);
        
        if (studentDoc) {
          const studentData = studentDoc.data();
          const updatedExams = [...(studentData.exams || []), result];
          
          await updateDoc(doc(db, 'students', studentDoc.id), {
            exams: updatedExams
          });
          
          gradedCount++;
        }
      } catch (error) {
        console.error('채점 결과 저장 실패:', error);
      }
    }

    setBatchGrading({
      selectedExam: null,
      omrList: []
    });

    alert(`총 ${gradedCount}명의 학생이 채점되었습니다!`);
  };

  return (
    <div className="space-y-6">
      {/* 수동 성적 기록 섹션 */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-purple-200">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
          <Edit3 size={24} />
          수동 성적 기록
        </h2>
        <p className="text-gray-600 mb-6 text-sm">
          학생과 시험을 선택하고 점수를 직접 입력하세요
        </p>

        {/* 월/주차 선택 */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl">
          <h3 className="font-semibold text-sm mb-3 text-gray-700">조회 기간 선택</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">월 선택</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">주차 선택</label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {[1, 2, 3, 4, 5].map(week => (
                  <option key={week} value={week}>{week}주차</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded-lg">
            💡 선택: <span className="font-semibold text-indigo-600">{selectedMonth}월 {selectedWeek}주차</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 학생 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              학생 선택 *
            </label>
            <select
              value={manualScore.studentId}
              onChange={(e) => setManualScore({ ...manualScore, studentId: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">학생을 선택하세요</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.grade})
                </option>
              ))}
            </select>
          </div>

          {/* 시험 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시험 선택 *
            </label>
            <select
              value={manualScore.examId}
              onChange={(e) => setManualScore({ ...manualScore, examId: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">시험을 선택하세요</option>
              {filteredExams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.date}) [{exam.month}월 {exam.week}주차]
                </option>
              ))}
            </select>
          </div>

          {/* 점수 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              점수 입력 *
              {manualScore.examId && (
                <span className="text-xs text-gray-500 ml-1">
                  (최대 {exams.find(e => e.id === manualScore.examId)?.scores.reduce((a, b) => a + b, 0) || 0}점)
                </span>
              )}
            </label>
            <input
              type="number"
              value={manualScore.score}
              onChange={(e) => setManualScore({ ...manualScore, score: e.target.value })}
              placeholder="점수를 입력하세요"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="0"
              max={manualScore.examId ? exams.find(e => e.id === manualScore.examId)?.scores.reduce((a, b) => a + b, 0) : 100}
            />
          </div>
        </div>

        <button
          onClick={handleManualScoreSave}
          disabled={!manualScore.studentId || !manualScore.examId || !manualScore.score}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg hover:shadow-lg transition-all font-semibold disabled:from-gray-300 disabled:to-gray-400 flex items-center justify-center gap-2"
        >
          <Save size={20} />
          성적 기록하기
        </button>
      </div>

      {/* 기존 OMR 일괄 채점 섹션 */}
      {!batchGrading.selectedExam ? (
        // 시험 선택
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            OMR 일괄 채점
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
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">채점할 시험을 선택하세요</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => setBatchGrading({ ...batchGrading, selectedExam: exam.id })}
                className="text-left p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all bg-gradient-to-r from-gray-50 to-green-50"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl">
                    <FileText className="text-white" size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg">{exam.title}</p>
                      {exam.month && exam.week && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                          {exam.month}월 {exam.week}주차
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{exam.subject} | {exam.date}</p>
                    <p className="text-xs text-gray-500 mt-1">총 {exam.totalQuestions}문항</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {filteredExams.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                <FileText className="text-gray-400" size={48} />
              </div>
              <p className="text-gray-500 text-lg">{selectedMonth}월 {selectedWeek}주차에 등록된 시험이 없습니다.</p>
              <p className="text-gray-400 text-sm mt-2">다른 월/주차를 선택해보세요.</p>
            </div>
          )}
        </div>
      ) : (
        // OMR 업로드 및 채점
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {exams.find(e => e.id === batchGrading.selectedExam)?.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">OMR 답안지를 업로드하세요</p>
              </div>
              <button
                onClick={() => setBatchGrading({ selectedExam: null, omrList: [] })}
                className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition text-sm font-medium"
              >
                ← 시험 선택으로
              </button>
            </div>

            <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-8 bg-gradient-to-br from-blue-50 to-indigo-50 text-center">
              <Upload className="mx-auto text-indigo-600 mb-4" size={64} />
              <h3 className="font-bold text-xl mb-2 text-gray-800">OMR 이미지 업로드</h3>
              <p className="text-sm text-gray-600 mb-4">
                한 번에 여러 장 선택 가능 (파일명: 이름_생년월일.jpg)
              </p>
              <label className="inline-block cursor-pointer bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all font-medium">
                파일 선택
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {batchGrading.omrList.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                업로드된 OMR ({batchGrading.omrList.length}명)
              </h3>
              
              <div className="space-y-4">
                {batchGrading.omrList.map((omr) => (
                  <div key={omr.id} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-r from-gray-50 to-blue-50">
                    <div className="flex items-start gap-4">
                      <img 
                        src={omr.imagePreview} 
                        alt="OMR"
                        className="w-24 h-24 object-contain border-2 border-gray-300 rounded-lg bg-white shadow-sm"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-2 font-medium">{omr.fileName}</p>
                        <select
                          value={omr.studentId}
                          onChange={(e) => updateOMRStudent(omr.id, e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="">학생 선택</option>
                          {students.map(student => (
                            <option key={student.id} value={student.id}>
                              {student.name} ({student.birthDate})
                            </option>
                          ))}
                        </select>
                        
                        <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                          <p className="text-xs font-semibold mb-2 text-gray-700">답안 입력</p>
                          <div className="grid grid-cols-8 gap-1 max-h-24 overflow-y-auto">
                            {[...Array(exams.find(e => e.id === batchGrading.selectedExam)?.totalQuestions || 0)].map((_, i) => (
                              <select
                                key={i}
                                value={omr.answers[i] || ''}
                                onChange={(e) => {
                                  const newAnswers = [...omr.answers];
                                  newAnswers[i] = e.target.value;
                                  updateOMRAnswers(omr.id, newAnswers);
                                }}
                                className="px-1 py-1 border rounded text-xs"
                              >
                                <option value="">{i + 1}</option>
                                <option value="1">①</option>
                                <option value="2">②</option>
                                <option value="3">③</option>
                                <option value="4">④</option>
                                <option value="5">⑤</option>
                              </select>
                            ))}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => removeOMR(omr.id)}
                          className="mt-3 flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition text-sm font-medium"
                        >
                          <Trash2 size={14} />
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleBatchGrade}
                disabled={batchGrading.omrList.some(omr => !omr.studentId)}
                className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 transition-all font-bold text-lg"
              >
                전체 일괄 채점 ({batchGrading.omrList.filter(omr => omr.studentId).length}명)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
