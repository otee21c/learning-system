import React from 'react';
import { FileText, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function MyGrades({ currentUser }) {
  // 시험 삭제
  const handleDeleteExam = async (examId) => {
    if (!confirm('이 시험 기록을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === currentUser.id);
      
      if (studentDoc) {
        const studentData = studentDoc.data();
        const updatedExams = studentData.exams.filter(e => e.examId !== examId);
        
        await updateDoc(doc(db, 'students', studentDoc.id), {
          exams: updatedExams
        });
        
        alert('시험 기록이 삭제되었습니다.');
      }
    } catch (error) {
      alert('삭제 실패: ' + error.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        내 성적 기록
      </h2>
      
      {currentUser.exams && currentUser.exams.length > 0 ? (
        <div className="space-y-6">
          {currentUser.exams.map((exam, idx) => (
            <div key={idx} className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-purple-50 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-xl">{exam.examTitle}</p>
                  <p className="text-sm text-gray-600 mt-1">{exam.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-3xl font-bold text-indigo-600">{exam.totalScore}점</p>
                    <p className="text-sm text-gray-600">{exam.percentage}%</p>
                  </div>
                  <button
                    onClick={() => handleDeleteExam(exam.examId)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-4 rounded-xl text-white">
                  <p className="text-xs opacity-90">정답</p>
                  <p className="font-bold text-2xl mt-1">
                    {exam.results.filter(r => r.isCorrect).length}문항
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-pink-500 p-4 rounded-xl text-white">
                  <p className="text-xs opacity-90">오답</p>
                  <p className="font-bold text-2xl mt-1">
                    {exam.results.filter(r => !r.isCorrect).length}문항
                  </p>
                </div>
              </div>
              
              {exam.typeStats && (
                <div className="pt-4 border-t-2 border-gray-200">
                  <p className="text-sm font-semibold mb-3 text-gray-700">유형별 성적</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(exam.typeStats).map(([type, stats]) => {
                      const rate = ((stats.correct / stats.total) * 100).toFixed(1);
                      return (
                        <div key={type} className="text-xs p-3 bg-white rounded-lg border shadow-sm">
                          <p className="font-semibold text-gray-700">{type}</p>
                          <p className="text-gray-600 mt-1">{stats.correct}/{stats.total} ({rate}%)</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {exam.weakTypes && exam.weakTypes.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-sm border-2 border-yellow-200">
                  <p className="font-semibold text-yellow-800">약점 유형:</p>
                  <p className="text-yellow-700 mt-1">
                    {exam.weakTypes.map(w => `${w.type} (${w.correctRate}%)`).join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
            <FileText className="text-gray-400" size={48} />
          </div>
          <p className="text-gray-500 text-lg">아직 응시한 시험이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
