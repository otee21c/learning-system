import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, BookOpen, Save, Clock, RotateCcw } from 'lucide-react';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export default function ExamTaking({ currentUser, exams }) {
  // 모드: 'select' | 'exam' | 'workbook'
  const [mode, setMode] = useState('select');
  
  // 시험 관련
  const [selectedExam, setSelectedExam] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [examResult, setExamResult] = useState(null);
  
  // 교재 학습 관련
  const [workbooks, setWorkbooks] = useState([]);
  const [selectedWorkbook, setSelectedWorkbook] = useState(null);
  const [workbookAnswers, setWorkbookAnswers] = useState([]);
  const [workbookResult, setWorkbookResult] = useState(null);
  const [savedDraft, setSavedDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [studentSelection, setStudentSelection] = useState('화작'); // 선택과목

  // 교재 목록 로드
  useEffect(() => {
    loadWorkbooks();
    loadDraft();
  }, [currentUser]);

  const loadWorkbooks = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'workbooks'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 학생 지점에 맞는 교재만
      const studentBranch = currentUser.branch || 'gwangjin';
      const filtered = data.filter(w => {
        if (studentBranch === 'baegot') return w.branch === 'baegot';
        return !w.branch || w.branch === '' || w.branch === 'gwangjin';
      });
      setWorkbooks(filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      console.error('교재 로드 실패:', err);
    }
  };

  // 임시저장 불러오기
  const loadDraft = async () => {
    try {
      const q = query(
        collection(db, 'workbookDrafts'),
        where('studentId', '==', currentUser.id)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const draft = snapshot.docs[0];
        setSavedDraft({ id: draft.id, ...draft.data() });
      }
    } catch (err) {
      console.error('임시저장 불러오기 실패:', err);
    }
  };

  // 시험 선택
  const handleExamSelect = (examId) => {
    const exam = exams.find(e => e.id === examId);
    if (exam) {
      setSelectedExam(exam);
      setStudentAnswers(Array(exam.totalQuestions).fill(0));
      setExamResult(null);
      setMode('exam');
    }
  };

  // 교재 선택
  const handleWorkbookSelect = (workbookId) => {
    const workbook = workbooks.find(w => w.id === workbookId);
    if (workbook) {
      setSelectedWorkbook(workbook);
      // 임시저장 데이터가 있으면 복원
      if (savedDraft && savedDraft.workbookId === workbookId) {
        setWorkbookAnswers(savedDraft.answers || Array(workbook.totalQuestions).fill(0));
        setStudentSelection(savedDraft.selection || '화작');
      } else {
        setWorkbookAnswers(Array(workbook.totalQuestions).fill(0));
      }
      setWorkbookResult(null);
      setMode('workbook');
    }
  };

  // 임시저장된 교재 이어하기
  const handleResumeDraft = () => {
    if (savedDraft) {
      const workbook = workbooks.find(w => w.id === savedDraft.workbookId);
      if (workbook) {
        setSelectedWorkbook(workbook);
        setWorkbookAnswers(savedDraft.answers || Array(workbook.totalQuestions).fill(0));
        setStudentSelection(savedDraft.selection || '화작');
        setWorkbookResult(null);
        setMode('workbook');
      }
    }
  };

  // 임시저장
  const handleSaveDraft = async () => {
    if (!selectedWorkbook) return;
    setIsSaving(true);
    try {
      const draftData = {
        studentId: currentUser.id,
        studentName: currentUser.name,
        workbookId: selectedWorkbook.id,
        workbookName: selectedWorkbook.name,
        answers: workbookAnswers,
        selection: studentSelection,
        savedAt: serverTimestamp(),
        branch: currentUser.branch || 'gwangjin'
      };

      if (savedDraft?.id) {
        await updateDoc(doc(db, 'workbookDrafts', savedDraft.id), draftData);
      } else {
        const docRef = await addDoc(collection(db, 'workbookDrafts'), draftData);
        setSavedDraft({ id: docRef.id, ...draftData });
      }
      alert('임시저장되었습니다!');
    } catch (err) {
      console.error('임시저장 실패:', err);
      alert('임시저장 실패: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 교재 채점
  const handleGradeWorkbook = async () => {
    if (!selectedWorkbook) return;

    const workbook = selectedWorkbook;
    const questions = workbook.questions || {};
    
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalAnswered = 0;
    const wrongQuestions = [];
    const analyzedTypes = {};

    // 공통 문제 (1-34)
    for (let i = 1; i <= 34; i++) {
      const question = questions[i] || questions[String(i)];
      const studentAns = workbookAnswers[i - 1];
      const correctAns = question?.answer;

      if (studentAns && studentAns !== 0) {
        totalAnswered++;
        if (correctAns) {
          if (studentAns === correctAns) {
            totalCorrect++;
          } else {
            totalWrong++;
            wrongQuestions.push(i);
            const type = question.type || '미분류';
            const fullType = question.subType ? `${question.type}-${question.subType}` : type;
            analyzedTypes[fullType] = (analyzedTypes[fullType] || 0) + 1;
          }
        }
      }
    }

    // 선택과목 문제 (35-45)
    if (workbook.hasSelection) {
      for (let i = 35; i <= workbook.totalQuestions; i++) {
        // 선택과목 키로 찾기 (예: "35_화작", "35_언매")
        const selectionKey = `${i}_${studentSelection}`;
        const question = questions[selectionKey] || questions[String(selectionKey)];
        
        if (!question) continue;

        const studentAns = workbookAnswers[i - 1];
        const correctAns = question.answer;

        if (studentAns && studentAns !== 0) {
          totalAnswered++;
          if (correctAns) {
            if (studentAns === correctAns) {
              totalCorrect++;
            } else {
              totalWrong++;
              wrongQuestions.push(i);
              const type = studentSelection; // 화작 또는 언매
              const fullType = question.subType ? `${type}-${question.subType}` : type;
              analyzedTypes[fullType] = (analyzedTypes[fullType] || 0) + 1;
            }
          }
        }
      }
    } else {
      // 선택과목 분리 안 된 경우
      for (let i = 35; i <= workbook.totalQuestions; i++) {
        const question = questions[i] || questions[String(i)];
        if (!question) continue;

        const studentAns = workbookAnswers[i - 1];
        const correctAns = question.answer;

        if (studentAns && studentAns !== 0) {
          totalAnswered++;
          if (correctAns) {
            if (studentAns === correctAns) {
              totalCorrect++;
            } else {
              totalWrong++;
              wrongQuestions.push(i);
              const type = question.type || '미분류';
              const fullType = question.subType ? `${question.type}-${question.subType}` : type;
              analyzedTypes[fullType] = (analyzedTypes[fullType] || 0) + 1;
            }
          }
        }
      }
    }

    const result = {
      workbookId: workbook.id,
      workbookName: workbook.name,
      totalCorrect,
      totalWrong,
      totalAnswered,
      wrongQuestions,
      analyzedTypes,
      selection: studentSelection,
      date: new Date().toISOString().split('T')[0]
    };

    setWorkbookResult(result);

    // Firestore에 오답 기록 저장 (약점 분석용)
    try {
      if (wrongQuestions.length > 0) {
        await addDoc(collection(db, 'wrongAnswers'), {
          studentId: currentUser.id,
          studentName: currentUser.name,
          workbookId: workbook.id,
          workbookName: workbook.name,
          wrongQuestions,
          analyzedTypes,
          selection: studentSelection,
          date: result.date,
          branch: currentUser.branch || 'gwangjin',
          createdAt: serverTimestamp()
        });
      }

      // 임시저장 삭제
      if (savedDraft?.id) {
        await deleteDoc(doc(db, 'workbookDrafts', savedDraft.id));
        setSavedDraft(null);
      }

      alert('채점이 완료되었습니다!');
    } catch (err) {
      console.error('채점 결과 저장 실패:', err);
    }
  };

  // 시험 채점 (기존 로직)
  const handleGradeExam = async () => {
    const exam = selectedExam;
    if (!exam) return;

    let totalScore = 0;
    const results = [];
    const typeStats = {};

    for (let i = 0; i < exam.totalQuestions; i++) {
      const isCorrect = studentAnswers[i] === exam.answers[i];
      const questionType = exam.types?.[i] || '미분류';
      
      if (isCorrect) {
        totalScore += (exam.scores?.[i] || 2);
      }
      
      results.push({
        questionNum: i + 1,
        studentAnswer: studentAnswers[i],
        correctAnswer: exam.answers[i],
        isCorrect,
        score: isCorrect ? (exam.scores?.[i] || 2) : 0,
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

    const maxScore = (exam.scores || []).reduce((a, b) => a + b, 0) || exam.totalQuestions * 2;
    const result = {
      examId: exam.id,
      examTitle: exam.title,
      date: new Date().toISOString().split('T')[0],
      totalScore,
      maxScore,
      percentage: ((totalScore / maxScore) * 100).toFixed(1),
      results,
      typeStats
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
    }
  };

  // 초기화
  const handleReset = () => {
    setMode('select');
    setSelectedExam(null);
    setSelectedWorkbook(null);
    setStudentAnswers([]);
    setWorkbookAnswers([]);
    setExamResult(null);
    setWorkbookResult(null);
  };

  // 선택 화면
  if (mode === 'select') {
    return (
      <div className="space-y-6">
        {/* 임시저장 알림 */}
        {savedDraft && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="text-yellow-600" size={24} />
                <div>
                  <p className="font-medium text-yellow-800">임시저장된 학습이 있습니다</p>
                  <p className="text-sm text-yellow-600">{savedDraft.workbookName}</p>
                </div>
              </div>
              <button
                onClick={handleResumeDraft}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
              >
                이어하기
              </button>
            </div>
          </div>
        )}

        {/* 시험 보기 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="text-indigo-600" />
            시험 보기
          </h2>
          {exams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  onClick={() => handleExamSelect(exam.id)}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer"
                >
                  <p className="font-bold">{exam.title}</p>
                  <p className="text-sm text-gray-600">{exam.date} | {exam.totalQuestions}문항</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">등록된 시험이 없습니다.</p>
          )}
        </div>

        {/* 교재 학습 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BookOpen className="text-amber-600" />
            교재 학습 (자기 채점)
          </h2>
          {workbooks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workbooks.map((workbook) => (
                <div
                  key={workbook.id}
                  onClick={() => handleWorkbookSelect(workbook.id)}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer"
                >
                  <p className="font-bold">{workbook.name}</p>
                  <p className="text-sm text-gray-600">{workbook.grade} | {workbook.totalQuestions}문항</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">등록된 교재가 없습니다.</p>
          )}
        </div>
      </div>
    );
  }

  // 교재 학습 모드
  if (mode === 'workbook' && selectedWorkbook) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{selectedWorkbook.name}</h2>
            <p className="text-gray-600">{selectedWorkbook.totalQuestions}문항</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? '저장 중...' : '임시저장'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <RotateCcw size={18} />
              돌아가기
            </button>
          </div>
        </div>

        {/* 선택과목 */}
        {selectedWorkbook.hasSelection && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <label className="block text-sm font-medium mb-2">선택과목</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="화작"
                  checked={studentSelection === '화작'}
                  onChange={(e) => setStudentSelection(e.target.value)}
                  className="w-4 h-4"
                />
                <span>화법과 작문</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="언매"
                  checked={studentSelection === '언매'}
                  onChange={(e) => setStudentSelection(e.target.value)}
                  className="w-4 h-4"
                />
                <span>언어와 매체</span>
              </label>
            </div>
          </div>
        )}

        {/* 답안 입력 */}
        {!workbookResult ? (
          <>
            <div className="grid grid-cols-5 md:grid-cols-9 gap-2 mb-6">
              {Array.from({ length: selectedWorkbook.totalQuestions }, (_, i) => i + 1).map((num) => (
                <div key={num} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{num}</span>
                  <select
                    value={workbookAnswers[num - 1] || 0}
                    onChange={(e) => {
                      const newAnswers = [...workbookAnswers];
                      newAnswers[num - 1] = parseInt(e.target.value);
                      setWorkbookAnswers(newAnswers);
                    }}
                    className={`w-12 h-10 text-center border-2 rounded-lg ${
                      workbookAnswers[num - 1] ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                    }`}
                  >
                    <option value={0}>-</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={handleGradeWorkbook}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition"
            >
              채점하기
            </button>
          </>
        ) : (
          // 채점 결과
          <div className="space-y-6">
            {workbookResult.totalAnswered === 0 ? (
              <div className="p-6 bg-yellow-50 rounded-xl text-center">
                <p className="text-lg font-bold text-yellow-800 mb-2">⚠️ 채점할 수 없습니다</p>
                <p className="text-yellow-700">교재에 정답이 등록되지 않았거나, 답을 입력하지 않았습니다.</p>
                <p className="text-sm text-yellow-600 mt-2">관리자에게 문의하세요.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-green-600">{workbookResult.totalCorrect}</p>
                    <p className="text-sm text-green-700">정답</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-red-600">{workbookResult.totalWrong}</p>
                    <p className="text-sm text-red-700">오답</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {workbookResult.totalCorrect + workbookResult.totalWrong > 0 
                        ? ((workbookResult.totalCorrect / (workbookResult.totalCorrect + workbookResult.totalWrong)) * 100).toFixed(0) 
                        : 0}%
                    </p>
                    <p className="text-sm text-blue-700">정답률</p>
                  </div>
                </div>

                {workbookResult.wrongQuestions.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-xl">
                    <h4 className="font-bold text-red-800 mb-2">틀린 문제</h4>
                    <p className="text-red-700">{workbookResult.wrongQuestions.join(', ')}번</p>
                  </div>
                )}

                {Object.keys(workbookResult.analyzedTypes).length > 0 && (
                  <div className="p-4 bg-orange-50 rounded-xl">
                    <h4 className="font-bold text-orange-800 mb-2">유형별 오답</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(workbookResult.analyzedTypes).map(([type, count]) => (
                        <span key={type} className="px-3 py-1 bg-orange-200 text-orange-800 rounded-full text-sm">
                          {type}: {count}개
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleReset}
              className="w-full py-3 bg-gray-500 text-white rounded-xl font-bold hover:bg-gray-600 transition"
            >
              다른 교재 선택
            </button>
          </div>
        )}
      </div>
    );
  }

  // 시험 보기 모드 (기존 로직)
  if (mode === 'exam' && selectedExam) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{selectedExam.title}</h2>
            <p className="text-gray-600">{selectedExam.date} | {selectedExam.totalQuestions}문항</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <RotateCcw size={18} />
            돌아가기
          </button>
        </div>

        {!examResult ? (
          <>
            <div className="grid grid-cols-5 md:grid-cols-9 gap-2 mb-6">
              {Array.from({ length: selectedExam.totalQuestions }, (_, i) => i + 1).map((num) => (
                <div key={num} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{num}</span>
                  <select
                    value={studentAnswers[num - 1] || 0}
                    onChange={(e) => {
                      const newAnswers = [...studentAnswers];
                      newAnswers[num - 1] = parseInt(e.target.value);
                      setStudentAnswers(newAnswers);
                    }}
                    className={`w-12 h-10 text-center border-2 rounded-lg ${
                      studentAnswers[num - 1] ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}
                  >
                    <option value={0}>-</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={handleGradeExam}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold hover:shadow-lg transition"
            >
              채점하기
            </button>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-center p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl">
              <p className="text-5xl font-bold text-indigo-600">{examResult.totalScore}</p>
              <p className="text-gray-600">/ {examResult.maxScore}점 ({examResult.percentage}%)</p>
            </div>

            <div className="grid grid-cols-5 md:grid-cols-9 gap-2">
              {examResult.results.map((r) => (
                <div
                  key={r.questionNum}
                  className={`p-2 rounded-lg text-center ${
                    r.isCorrect ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <span className="text-xs text-gray-500">{r.questionNum}</span>
                  <div className="flex justify-center">
                    {r.isCorrect ? (
                      <CheckCircle className="text-green-600" size={20} />
                    ) : (
                      <XCircle className="text-red-600" size={20} />
                    )}
                  </div>
                  {!r.isCorrect && (
                    <p className="text-xs text-red-600">정답: {r.correctAnswer}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 bg-gray-500 text-white rounded-xl font-bold hover:bg-gray-600 transition"
            >
              다른 시험 선택
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
