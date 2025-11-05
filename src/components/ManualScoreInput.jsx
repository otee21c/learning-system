import React, { useState } from 'react';
import { FileText, Save, X } from 'lucide-react';
import { collection, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function ManualScoreInput({ exams, students }) {
  const [selectedExam, setSelectedExam] = useState(null);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);

  // 시험 선택 시 초기화
  const handleSelectExam = (examId) => {
    setSelectedExam(examId);
    // 모든 학생의 점수를 빈 문자열로 초기화
    const initialScores = {};
    students.forEach(student => {
      initialScores[student.id] = '';
    });
    setScores(initialScores);
  };

  // 점수 입력 핸들러
  const handleScoreChange = (studentId, score) => {
    setScores(prev => ({
      ...prev,
      [studentId]: score
    }));
  };

  // 저장 핸들러
  const handleSave = async () => {
    if (!selectedExam) {
      alert('시험을 선택해주세요.');
      return;
    }

    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) {
      alert('시험 정보를 찾을 수 없습니다.');
      return;
    }

    // 입력된 점수가 있는 학생만 필터링
    const studentsToUpdate = students.filter(student => 
      scores[student.id] && scores[student.id].trim() !== ''
    );

    if (studentsToUpdate.length === 0) {
      alert('입력된 점수가 없습니다.');
      return;
    }

    setSaving(true);

    try {
      // Firestore에서 모든 학생 데이터 가져오기
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);

      // 각 학생의 성적 업데이트
      for (const studentToUpdate of studentsToUpdate) {
        const studentDoc = snapshot.docs.find(doc => doc.data().id === studentToUpdate.id);
        
        if (studentDoc) {
          const studentData = studentDoc.data();
          const currentExams = studentData.exams || [];

          // 새로운 시험 결과 객체
          const newExamResult = {
            examId: exam.id,
            examTitle: exam.title,
            date: exam.date || new Date().toISOString().split('T')[0],
            subject: exam.subject || '국어',
            totalScore: parseInt(scores[studentToUpdate.id]) || 0,
            totalPossibleScore: exam.scores?.reduce((a, b) => a + b, 0) || 100,
            percentage: ((parseInt(scores[studentToUpdate.id]) || 0) / (exam.scores?.reduce((a, b) => a + b, 0) || 100) * 100).toFixed(1),
            manualEntry: true, // 수동 입력 표시
            results: [] // 문항별 결과는 없음 (수동 입력이므로)
          };

          // 기존 시험 결과에 추가
          const updatedExams = [...currentExams, newExamResult];

          // Firestore 업데이트
          await updateDoc(doc(db, 'students', studentDoc.id), {
            exams: updatedExams
          });
        }
      }

      alert(`${studentsToUpdate.length}명의 학생 성적이 저장되었습니다!`);
      
      // 초기화
      setSelectedExam(null);
      setScores({});

    } catch (error) {
      console.error('점수 저장 오류:', error);
      alert('점수 저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedExamData = exams.find(e => e.id === selectedExam);

  return (
    <div className="space-y-6">
      {!selectedExam ? (
        // 시험 선택 화면
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            💯 수동 점수 입력
          </h2>
          <p className="text-gray-600 mb-6">
            시험을 선택하고 학생별로 총점을 직접 입력할 수 있습니다.
          </p>
          <div className="space-y-3">
            {exams.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="mx-auto mb-4 text-gray-400" size={48} />
                <p>등록된 시험이 없습니다.</p>
                <p className="text-sm mt-2">시험 관리 탭에서 먼저 시험을 등록해주세요.</p>
              </div>
            ) : (
              exams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => handleSelectExam(exam.id)}
                  className="w-full p-5 bg-gradient-to-r from-gray-50 to-purple-50 hover:shadow-md rounded-xl text-left transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                      <FileText className="text-white" size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{exam.title}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {exam.subject} | {exam.date}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        만점: {exam.scores?.reduce((a, b) => a + b, 0) || 100}점
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        // 점수 입력 화면
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {selectedExamData?.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedExamData?.subject} | {selectedExamData?.date} | 
                  만점: {selectedExamData?.scores?.reduce((a, b) => a + b, 0) || 100}점
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedExam(null);
                  setScores({});
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center gap-2"
              >
                <X size={20} />
                취소
              </button>
            </div>

            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
              <h3 className="font-semibold text-lg mb-4">학생별 점수 입력</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {students.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>등록된 학생이 없습니다.</p>
                  </div>
                ) : (
                  students.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-indigo-300 transition"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{student.name}</p>
                        <p className="text-sm text-gray-600">
                          {student.grade} | ID: {student.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={scores[student.id] || ''}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          placeholder="점수"
                          className="w-24 px-4 py-2 border-2 border-gray-300 rounded-lg text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          min="0"
                          max={selectedExamData?.scores?.reduce((a, b) => a + b, 0) || 100}
                        />
                        <span className="text-gray-600 font-medium">
                          / {selectedExamData?.scores?.reduce((a, b) => a + b, 0) || 100}점
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={24} />
                {saving ? '저장 중...' : '점수 저장하기'}
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 안내:</strong> 저장된 점수는 각 학생의 성적 탭과 SMS 안내장 발송 시 자동으로 반영됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
