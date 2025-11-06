import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

export default function ProblemAnalysisManager() {
  const [problemAnalysisList, setProblemAnalysisList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    const problemAnalysisRef = collection(db, 'problemAnalysis');
    const unsubscribe = onSnapshot(problemAnalysisRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // 최신순 정렬
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setProblemAnalysisList(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          📊 문제 분석 관리
        </h2>

        {/* 분석 목록 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">학생 이름</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">분석 날짜</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">상세보기</th>
              </tr>
            </thead>
            <tbody>
              {problemAnalysisList.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.studentName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(item.createdAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all"
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {problemAnalysisList.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              아직 분석된 문제가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 상세보기 모달 */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{selectedItem.studentName}의 문제 분석</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* 문제 이미지 */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">📸 문제 사진</h4>
                <img 
                  src={selectedItem.imageUrl} 
                  alt="문제 사진" 
                  className="w-full max-w-2xl rounded-lg shadow-md border border-gray-200"
                />
              </div>

              {/* AI 피드백 */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">🤖 AI 피드백</h4>
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-100">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {selectedItem.analysis}
                  </p>
                </div>
              </div>

              {/* 분석 날짜 */}
              <div className="text-sm text-gray-500">
                분석 날짜: {new Date(selectedItem.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}