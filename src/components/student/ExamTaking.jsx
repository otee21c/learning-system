import React, { useState } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function ExamTaking({ currentUser, exams }) {
  const [selectedExam, setSelectedExam] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [examResult, setExamResult] = useState(null);

  // 시험 선택 시 답안 배열 초기화
  const handleExamSelect = (examId) => {
    const exam = exams.find(e => e.id === examId);
    if (exam) {
      setSelectedExam(examId);
      setStudentAnswers(Array(exam.totalQuestions).fill(''));
      setExamResult(null);
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

  // 채점하기
  const handleGradeExam = async () => {
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;

    let totalScore = 0;
    const results = [];
    const typeStats = {};

    for (let i = 0; i < exam.totalQuestions; i++) {
      const isCorrect = studentAnswers[i] === exam.answers[i];
      const questionType = exam.types[i];
      
      if (isCorrect) {
        totalScore += exam.scores[i];
      }
      
      results.push({
        questionNum: i + 1,
        studentAnswer: studentAnswers[i],
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

    setExamResult(result);

    // Firestore에 결과 저장
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === currentUser.id);
      
      if (studentDoc) {
        const studentData = studentDoc.data();
        const updatedExams = [...(studentData.exams || []), result];
        
        await updateDoc(doc(db, 'students', studentDoc.id), {
          exams: updatedExams
        });
      }
    } catch (error) {
      console.error('채점 결과 저장 실패:', error);
      alert('채점 결과 저장에 실패했습니다.');
    }
  };

  return (
    <div>
      {!selectedExam ? (
        // 시험 목록
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            시험 선택
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                onClick={() => handleExamSelect(exam.id)}
                className="p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-r from-gray-50 to-indigo-50"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
                    <FileText className="text-white" size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{exam.title}</p>
                    <p className="text-sm text-gray-600">{exam.date}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white p-2 rounded-lg">
                    <p className="text-xs text-gray-600">과목</p>
                    <p className="font-semibold">{exam.subject}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg">
                    <p className="text-xs text-gray-600">문항 수</p>
                    <p className="font-semibold">{exam.totalQuestions}개</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {exams.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                <FileText className="text-gray-400" size={48} />
              </div>
              <p className="text-gray-500 text-lg">등록된 시험이 없습니다.</p>
            </div>
          )}
        </div>
      ) : examResult ? (
        // 채점 결과
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            채점 결과
          </h2>

          <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-8 mb-6">
            <div className="text-center mb-6">
              <p className="text-6xl font-bold text-indigo-600 mb-2">
                {examResult.totalScore}점
              </p>
              <p className="text-2xl text-gray-700">
                {examResult.maxScore}점 만점 ({examResult.percentage}%)
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-6 text-center">
                <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-600">
                  {examResult.results.filter(r => r.isCorrect).length}
                </p>
                <p className="text-gray-600 mt-1">정답</p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center">
                <XCircle size={32} className="text-red-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-red-600">
                  {examResult.results.filter(r => !r.isCorrect).length}
                </p>
                <p className="text-gray-600 mt-1">오답</p>
              </div>
            </div>
          </div>

          {examResult.typeStats && (
            <div className="mb-6">
              <h3 className="font-bold text-xl mb-4">유형별 분석</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(examResult.typeStats).map(([type, stats]) => {
                  const rate = ((stats.correct / stats.total) * 100).toFixed(1);
                  return (
                    <div key={type} className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                      <p className="font-semibold text-sm mb-2">{type}</p>
                      <p className="text-2xl font-bold text-indigo-600">{rate}%</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {stats.correct}/{stats.total} 정답
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h3 className="font-bold text-xl mb-4">문항별 결과</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
            {examResult.results.map((result) => (
              <div
                key={result.questionNum}
                className={`p-3 rounded-xl border-2 transition-all ${
                  result.isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  {result.isCorrect ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-red-600" />
                  )}
                  <span className="font-bold text-sm">{result.questionNum}번</span>
                </div>
                <p className="text-xs">내 답: {result.studentAnswer || '-'}</p>
                <p className="text-xs">정답: {result.correctAnswer}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setSelectedExam(null);
              setExamResult(null);
              setStudentAnswers([]);
            }}
            className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
          >
            다른 시험 보기
          </button>
        </div>
      ) : (
        // 답안 입력
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <button
              onClick={() => setSelectedExam(null)}
              className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition mb-3 font-medium"
            >
              ← 시험 목록으로
            </button>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {exams.find(e => e.id === selectedExam)?.title}
            </h2>
          </div>

          <div className="border-2 border-gray-200 rounded-xl p-6 mb-6 bg-gray-50">
            <h3 className="font-semibold text-lg mb-4">답안 입력</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
              {studentAnswers.map((_, i) => (
                <div key={i}>
                  <label className="text-xs text-gray-600 font-medium block mb-1">{i + 1}번</label>
                  <select
                    value={studentAnswers[i]}
                    onChange={(e) => {
                      const newAnswers = [...studentAnswers];
                      newAnswers[i] = e.target.value;
                      setStudentAnswers(newAnswers);
                    }}
                    className="w-full px-2 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">-</option>
                    <option value="1">①</option>
                    <option value="2">②</option>
                    <option value="3">③</option>
                    <option value="4">④</option>
                    <option value="5">⑤</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleGradeExam}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg disabled:from-gray-300 disabled:to-gray-400"
            disabled={!studentAnswers.some(a => a !== '')}
          >
            채점하기
          </button>
        </div>
      )}
    </div>
  );
}
