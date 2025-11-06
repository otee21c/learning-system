import React, { useState } from 'react';
import { FileText, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getMonthWeek } from '../../utils/dateUtils';

export default function ExamManager({ exams, students }) {
  const [newExam, setNewExam] = useState({
    title: '',
    date: '',
    subject: '국어',
    totalQuestions: 40,
    answers: Array(40).fill(''),
    scores: Array(40).fill(2),
    types: Array(40).fill('사실적 이해')
  });

  const [editingExam, setEditingExam] = useState(null);

  const questionTypes = [
    '사실적 이해', '추론적 이해', '비판적 이해', 
    '어휘/문법', '문학 감상', '작품 분석'
  ];

  // 문제 수 변경 시 배열 조정
  const updateExamQuestions = (count) => {
    const num = parseInt(count) || 40;
    setNewExam({
      ...newExam,
      totalQuestions: num,
      answers: Array(num).fill(''),
      scores: Array(num).fill(2),
      types: Array(num).fill('사실적 이해')
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
        week: week,
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
        totalQuestions: 40,
        answers: Array(40).fill(''),
        scores: Array(40).fill(2),
        types: Array(40).fill('사실적 이해')
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

  // 시험 수정
  const handleUpdateExam = async () => {
    if (!editingExam) return;

    try {
      const { month, week } = getMonthWeek(editingExam.date);
      
      await updateDoc(doc(db, 'exams', editingExam.id), {
        title: editingExam.title,
        date: editingExam.date,
        month: month,
        week: week,
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">문제 수 (1-100)</label>
            <input
              type="number"
              value={newExam.totalQuestions}
              onChange={(e) => updateExamQuestions(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              min="1"
              max="100"
            />
          </div>
          
          <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
            <h3 className="font-semibold text-lg mb-4">정답, 배점 및 유형 입력</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {[...Array(newExam.totalQuestions)].map((_, i) => (
                <div key={i} className="border-2 border-gray-300 rounded-lg p-3 bg-white">
                  <label className="text-xs font-semibold text-gray-700 block mb-2">{i + 1}번</label>
                  <select
                    value={newExam.answers[i]}
                    onChange={(e) => {
                      const newAnswers = [...newExam.answers];
                      newAnswers[i] = e.target.value;
                      setNewExam({ ...newExam, answers: newAnswers });
                    }}
                    className="w-full px-2 py-2 border rounded-lg text-sm mb-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">정답</option>
                    <option value="1">①</option>
                    <option value="2">②</option>
                    <option value="3">③</option>
                    <option value="4">④</option>
                    <option value="5">⑤</option>
                  </select>
                  <input
                    type="number"
                    value={newExam.scores[i]}
                    onChange={(e) => {
                      const newScores = [...newExam.scores];
                      newScores[i] = parseInt(e.target.value) || 0;
                      setNewExam({ ...newExam, scores: newScores });
                    }}
                    className="w-full px-2 py-2 border rounded-lg text-sm mb-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="배점"
                  />
                  <select
                    value={newExam.types[i]}
                    onChange={(e) => {
                      const newTypes = [...newExam.types];
                      newTypes[i] = e.target.value;
                      setNewExam({ ...newExam, types: newTypes });
                    }}
                    className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    {questionTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              ))}
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
              className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-md transition"
            >
              {editingExam && editingExam.id === exam.id ? (
                // 수정 모드
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingExam.title}
                    onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={editingExam.date}
                      onChange={(e) => setEditingExam({ ...editingExam, date: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    />
                    <select
                      value={editingExam.subject}
                      onChange={(e) => setEditingExam({ ...editingExam, subject: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="국어">국어</option>
                      <option value="수학">수학</option>
                      <option value="영어">영어</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateExam}
                      className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2"
                    >
                      <Save size={16} />
                      저장
                    </button>
                    <button
                      onClick={() => setEditingExam(null)}
                      className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition flex items-center justify-center gap-2"
                    >
                      <X size={16} />
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // 일반 모드
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl">
                        <FileText className="text-white" size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-xl">{exam.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-gray-600">
                            {exam.date} | {exam.subject} | {exam.totalQuestions}문항
                          </p>
                          {exam.month && exam.week && (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                              {exam.month}월 {exam.week}주차
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingExam(exam)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">총 배점</p>
                      <p className="font-bold text-lg text-indigo-600">
                        {exam.scores.reduce((a, b) => a + b, 0)}점
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">문항 수</p>
                      <p className="font-bold text-lg text-purple-600">
                        {exam.totalQuestions}개
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600">응시 학생</p>
                      <p className="font-bold text-lg text-green-600">
                        {students.filter(s => s.exams?.some(e => e.examId === exam.id)).length}명
                      </p>
                    </div>
                  </div>
                </>
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
