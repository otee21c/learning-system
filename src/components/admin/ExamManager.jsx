import React, { useState } from 'react';
import { FileText, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getMonthWeek } from '../../utils/dateUtils';

export default function ExamManager({ exams, students, branch, schedules = [] }) {
  const [newExam, setNewExam] = useState({
    title: '',
    date: '',
    subject: '국어',
    totalQuestions: 45,
    answers: Array(45).fill(''),
    scores: Array(45).fill(2),
    types: Array(45).fill('독서_정보 독해')
  });

  const [editingExam, setEditingExam] = useState(null);
  const [expandedExamId, setExpandedExamId] = useState(null);

  const questionTypes = [
    '독서_정보 독해', '독서_의미 독해', '독서_보기 독해', 
    '문학_정보 독해', '문학_의미 독해', '문학_보기 독해',
    '화작 영역', '언매 영역'
  ];

  // 문제 수 변경 시 배열 조정
  const updateExamQuestions = (count) => {
    const num = parseInt(count) || 45;
    setNewExam({
      ...newExam,
      totalQuestions: num,
      answers: Array(num).fill(''),
      scores: Array(num).fill(2),
      types: Array(num).fill('독서_정보 독해')
    });
  };

  // 시험 추가
  const handleAddExam = async () => {
    if (!newExam.title || !newExam.date) {
      alert('시험명과 날짜를 입력해주세요.');
      return;
    }

    const allAnswersFilled = newExam.answers.every(answer => answer !== '');
    if (!allAnswersFilled) {
      alert('모든 문제의 정답을 입력해주세요.');
      return;
    }

    try {
      const { month, week } = getMonthWeek(newExam.date);
      
      await addDoc(collection(db, 'exams'), {
        title: newExam.title,
        date: newExam.date,
        month: month,
        round: week,
        subject: newExam.subject,
        totalQuestions: newExam.totalQuestions,
        answers: newExam.answers,
        scores: newExam.scores,
        types: newExam.types
      });

      setNewExam({
        title: '',
        date: '',
        subject: '국어',
        totalQuestions: 45,
        answers: Array(45).fill(''),
        scores: Array(45).fill(2),
        types: Array(45).fill('독서_정보 독해')
      });
      
      alert('시험이 추가되었습니다.');
    } catch (error) {
      alert('시험 추가 실패: ' + error.message);
    }
  };

  // 시험 삭제
  const handleDeleteExam = async (examId) => {
    if (!confirm('정말 이 시험을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'exams', examId));
      alert('시험이 삭제되었습니다.');
    } catch (error) {
      alert('시험 삭제 실패: ' + error.message);
    }
  };

  // 시험 수정 시작
  const startEdit = (exam) => {
    setEditingExam({
      ...exam,
      answers: exam.answers || Array(exam.totalQuestions).fill(''),
      scores: exam.scores || Array(exam.totalQuestions).fill(2),
      types: exam.types || Array(exam.totalQuestions).fill('독서_정보 독해')
    });
    setExpandedExamId(exam.id);
  };

  // 시험 수정 저장
  const handleUpdateExam = async () => {
    if (!editingExam) return;

    try {
      const { month, week } = getMonthWeek(editingExam.date);
      
      await updateDoc(doc(db, 'exams', editingExam.id), {
        title: editingExam.title,
        date: editingExam.date,
        month: month,
        round: week,
        subject: editingExam.subject,
        totalQuestions: editingExam.totalQuestions,
        answers: editingExam.answers,
        scores: editingExam.scores,
        types: editingExam.types
      });
      
      setEditingExam(null);
      alert('시험 정보가 수정되었습니다.');
    } catch (error) {
      alert('시험 수정 실패: ' + error.message);
    }
  };

  // 수정 모드에서 값 변경
  const updateEditingAnswer = (index, value) => {
    const newAnswers = [...editingExam.answers];
    newAnswers[index] = value;
    setEditingExam({ ...editingExam, answers: newAnswers });
  };

  const updateEditingScore = (index, value) => {
    const newScores = [...editingExam.scores];
    newScores[index] = parseInt(value) || 0;
    setEditingExam({ ...editingExam, scores: newScores });
  };

  const updateEditingType = (index, value) => {
    const newTypes = [...editingExam.types];
    newTypes[index] = value;
    setEditingExam({ ...editingExam, types: newTypes });
  };

  // 정답지 테이블 렌더링 (신규 등록용)
  const renderAnswerTable = (examData, isEditing = false) => {
    const answers = examData.answers;
    const scores = examData.scores;
    const types = examData.types;
    const totalQuestions = examData.totalQuestions;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-green-500 text-white">
              <th className="border border-green-600 px-2 py-1 w-12">#</th>
              <th className="border border-green-600 px-2 py-1 w-16">문번</th>
              <th className="border border-green-600 px-2 py-1 w-16">구분</th>
              <th className="border border-green-600 px-2 py-1 w-20">정답</th>
              <th className="border border-green-600 px-2 py-1 w-16">배점</th>
              <th className="border border-green-600 px-2 py-1">영역</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(totalQuestions)].map((_, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1 text-center font-medium">{i + 1}</td>
                <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">객관식</td>
                <td className="border border-gray-300 px-1 py-1">
                  <select
                    value={isEditing ? answers[i] : newExam.answers[i]}
                    onChange={(e) => {
                      if (isEditing) {
                        updateEditingAnswer(i, e.target.value);
                      } else {
                        const newAnswers = [...newExam.answers];
                        newAnswers[i] = e.target.value;
                        setNewExam({ ...newExam, answers: newAnswers });
                      }
                    }}
                    className="w-full px-1 py-1 border-0 bg-transparent focus:ring-1 focus:ring-green-500 rounded"
                  >
                    <option value="">-</option>
                    <option value="1">①</option>
                    <option value="2">②</option>
                    <option value="3">③</option>
                    <option value="4">④</option>
                    <option value="5">⑤</option>
                  </select>
                </td>
                <td className="border border-gray-300 px-1 py-1">
                  <input
                    type="number"
                    value={isEditing ? scores[i] : newExam.scores[i]}
                    onChange={(e) => {
                      if (isEditing) {
                        updateEditingScore(i, e.target.value);
                      } else {
                        const newScores = [...newExam.scores];
                        newScores[i] = parseInt(e.target.value) || 0;
                        setNewExam({ ...newExam, scores: newScores });
                      }
                    }}
                    className="w-full px-1 py-1 border-0 bg-transparent text-center focus:ring-1 focus:ring-green-500 rounded"
                    min="0"
                  />
                </td>
                <td className="border border-gray-300 px-1 py-1">
                  <select
                    value={isEditing ? types[i] : newExam.types[i]}
                    onChange={(e) => {
                      if (isEditing) {
                        updateEditingType(i, e.target.value);
                      } else {
                        const newTypes = [...newExam.types];
                        newTypes[i] = e.target.value;
                        setNewExam({ ...newExam, types: newTypes });
                      }
                    }}
                    className="w-full px-1 py-1 border-0 bg-transparent focus:ring-1 focus:ring-green-500 rounded text-sm"
                  >
                    {questionTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 새 시험 등록 */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
          <Plus size={24} />
          새 시험 등록
        </h2>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="시험 제목"
            value={newExam.title}
            onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="date"
              value={newExam.date}
              onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <select
              value={newExam.subject}
              onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="국어">국어</option>
              <option value="수학">수학</option>
              <option value="영어">영어</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">문제 수:</label>
              <input
                type="number"
                value={newExam.totalQuestions}
                onChange={(e) => updateExamQuestions(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                min="1"
                max="100"
              />
            </div>
          </div>
          
          {/* 정답지 테이블 */}
          <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-700">
              정답지 입력 (총 {newExam.totalQuestions}문항 / 총점: {newExam.scores.reduce((a, b) => a + b, 0)}점)
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {renderAnswerTable(newExam, false)}
            </div>
          </div>
          
          <button 
            onClick={handleAddExam}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            시험 등록
          </button>
        </div>
      </div>

      {/* 시험 목록 */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          등록된 시험 목록
        </h2>
        <div className="space-y-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition"
            >
              {/* 시험 헤더 */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                      <FileText className="text-white" size={20} />
                    </div>
                    <div>
                      {editingExam?.id === exam.id ? (
                        <input
                          type="text"
                          value={editingExam.title}
                          onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                          className="px-2 py-1 border rounded font-bold text-lg"
                        />
                      ) : (
                        <p className="font-bold text-lg">{exam.title}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {editingExam?.id === exam.id ? (
                          <input
                            type="date"
                            value={editingExam.date}
                            onChange={(e) => setEditingExam({ ...editingExam, date: e.target.value })}
                            className="px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">
                            {exam.date} | {exam.subject} | {exam.totalQuestions}문항 | {exam.scores?.reduce((a, b) => a + b, 0) || 0}점
                          </span>
                        )}
                        {exam.month && exam.round && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                            {exam.month}월 {exam.round}차
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingExam?.id === exam.id ? (
                      <>
                        <button
                          onClick={handleUpdateExam}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-1"
                        >
                          <Save size={16} />
                          저장
                        </button>
                        <button
                          onClick={() => setEditingExam(null)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition flex items-center gap-1"
                        >
                          <X size={16} />
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(exam)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                          title="수정"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={() => setExpandedExamId(expandedExamId === exam.id ? null : exam.id)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                          title="정답지 보기"
                        >
                          {expandedExamId === exam.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 정답지 상세 (펼치기) */}
              {(expandedExamId === exam.id || editingExam?.id === exam.id) && (
                <div className="border-t border-gray-200">
                  <div className="max-h-[400px] overflow-y-auto">
                    {editingExam?.id === exam.id ? (
                      renderAnswerTable(editingExam, true)
                    ) : (
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-green-500 text-white sticky top-0">
                            <th className="border border-green-600 px-2 py-1 w-12">#</th>
                            <th className="border border-green-600 px-2 py-1 w-16">문번</th>
                            <th className="border border-green-600 px-2 py-1 w-16">구분</th>
                            <th className="border border-green-600 px-2 py-1 w-20">정답</th>
                            <th className="border border-green-600 px-2 py-1 w-16">배점</th>
                            <th className="border border-green-600 px-2 py-1">영역</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exam.answers?.map((answer, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i + 1}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center font-medium">{i + 1}</td>
                              <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">객관식</td>
                              <td className="border border-gray-300 px-2 py-1 text-center font-bold text-green-600">
                                {answer ? `${['①','②','③','④','⑤'][parseInt(answer)-1] || answer}` : '-'}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-center">{exam.scores?.[i] || 2}</td>
                              <td className="border border-gray-300 px-2 py-1 text-sm">{exam.types?.[i] || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
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
    </div>
  );
}
