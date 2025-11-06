import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { storage, db } from "../../firebase";

export default function ProblemAnalysis({ currentUser }) {
  const [problemFiles, setProblemFiles] = useState([]);
  const [problemFilePreviews, setProblemFilePreviews] = useState([]);
  const [problemTextQuestion, setProblemTextQuestion] = useState('');
  const [problemUploadType, setProblemUploadType] = useState('image'); // 'image', 'pdf', 'text'
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // 파일 선택 핸들러
  const handleProblemFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (problemUploadType === 'image' && files.length > 10) {
      alert('이미지는 최대 10장까지 업로드 가능합니다!');
      return;
    }

    if (problemUploadType === 'pdf' && files.length > 1) {
      alert('PDF는 1개만 업로드 가능합니다!');
      return;
    }

    setProblemFiles(files);

    // 미리보기 생성
    const previews = files.map(file => {
      if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ type: 'image', url: reader.result, name: file.name });
          reader.readAsDataURL(file);
        });
      } else if (file.type === 'application/pdf') {
        return Promise.resolve({ type: 'pdf', name: file.name });
      }
    });

    Promise.all(previews).then(setProblemFilePreviews);
    setAnalysisResult(null);
  };

  // 문제 분석 함수
  const analyzeProblem = async () => {
    if (problemUploadType !== 'text' && problemFiles.length === 0) {
      alert('파일을 선택하거나 질문을 입력해주세요!');
      return;
    }

    if (problemUploadType === 'text' && !problemTextQuestion.trim()) {
      alert('질문을 입력해주세요!');
      return;
    }

    setAnalyzing(true);

    try {
      let uploadedUrls = [];
      let messageContent = [];

      // 텍스트 질문만 있는 경우
      if (problemUploadType === 'text') {
        messageContent = [
          {
            type: 'text',
            text: `다음 질문에 자세히 답변해주세요:\n\n${problemTextQuestion}`
          }
        ];
      } else {
        // 파일 업로드
        for (const file of problemFiles) {
          const storageRef = ref(storage, `problem-images/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedUrls.push({ url, type: file.type, name: file.name });
        }

        // OpenAI 메시지 구성
        messageContent = [
          {
            type: 'text',
            text: problemUploadType === 'pdf' 
              ? '이 PDF 문서의 내용을 분석하고, 문제가 있다면 자세한 풀이를 제공해주세요.'
              : '이 이미지들의 문제를 자세히 분석해주세요. 문제 유형, 풀이 방법, 핵심 개념을 설명하고 단계별 풀이를 제시해주세요.'
          }
        ];

        // 이미지/PDF 추가
        for (const fileData of uploadedUrls) {
          if (fileData.type.startsWith('image/')) {
            const file = problemFiles.find(f => f.name === fileData.name);
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result.split(',')[1]);
              reader.readAsDataURL(file);
            });

            messageContent.push({
              type: 'image_url',
              image_url: {
                url: `data:${fileData.type};base64,${base64}`
              }
            });
          }
        }
      }

      // OpenAI API 호출
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ],
          max_tokens: 2000
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || '분석 중 오류가 발생했습니다.');
      }

      const aiAnalysis = data.choices[0].message.content;
      setAnalysisResult(aiAnalysis);

      // Firestore에 저장
      await addDoc(collection(db, 'problemAnalysis'), {
        studentId: currentUser.id,
        studentName: currentUser.name,
        type: problemUploadType,
        fileUrls: uploadedUrls.map(f => f.url),
        textQuestion: problemUploadType === 'text' ? problemTextQuestion : null,
        fileCount: problemFiles.length,
        analysis: aiAnalysis,
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('분석 오류:', error);
      alert('분석 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 리셋 함수
  const resetAnalysis = () => {
    setProblemFiles([]);
    setProblemFilePreviews([]);
    setProblemTextQuestion('');
    setAnalysisResult(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
        📖 문제 분석 요청
      </h2>
      
      <div className="space-y-6">
        {/* 업로드 타입 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            분석 방법 선택
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => { setProblemUploadType('image'); resetAnalysis(); }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                problemUploadType === 'image'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🖼️ 이미지 (최대 10장)
            </button>
            <button
              onClick={() => { setProblemUploadType('pdf'); resetAnalysis(); }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                problemUploadType === 'pdf'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📄 PDF 파일
            </button>
            <button
              onClick={() => { setProblemUploadType('text'); resetAnalysis(); }}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                problemUploadType === 'text'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💬 텍스트 질문
            </button>
          </div>
        </div>

        {/* 파일 업로드 (이미지/PDF) */}
        {problemUploadType !== 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {problemUploadType === 'image' ? '이미지 업로드 (최대 10장)' : 'PDF 파일 업로드'}
            </label>
            <input
              type="file"
              accept={problemUploadType === 'image' ? 'image/*' : 'application/pdf'}
              multiple={problemUploadType === 'image'}
              onChange={handleProblemFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-500 file:to-indigo-500 file:text-white hover:file:from-blue-600 hover:file:to-indigo-600"
            />
          </div>
        )}

        {/* 텍스트 질문 */}
        {problemUploadType === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              질문 입력
            </label>
            <textarea
              value={problemTextQuestion}
              onChange={(e) => setProblemTextQuestion(e.target.value)}
              placeholder="궁금한 점을 자유롭게 작성해주세요..."
              rows="6"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* 파일 미리보기 */}
        {problemFilePreviews.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              미리보기 ({problemFilePreviews.length}개 파일)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {problemFilePreviews.map((preview, index) => (
                <div key={index} className="relative">
                  {preview.type === 'image' ? (
                    <img 
                      src={preview.url} 
                      alt={`미리보기 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg shadow-md border border-gray-200"
                    />
                  ) : (
                    <div className="w-full h-32 bg-red-50 rounded-lg shadow-md border border-red-200 flex flex-col items-center justify-center">
                      <span className="text-4xl mb-2">📄</span>
                      <span className="text-xs text-gray-600 px-2 text-center truncate w-full">
                        {preview.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 분석 버튼 */}
        <div className="flex gap-4">
          {(problemFiles.length > 0 || problemTextQuestion.trim()) && (
            <button
              onClick={resetAnalysis}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              초기화
            </button>
          )}
          <button
            onClick={analyzeProblem}
            disabled={analyzing || (problemUploadType !== 'text' && problemFiles.length === 0) || (problemUploadType === 'text' && !problemTextQuestion.trim())}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
              analyzing || (problemUploadType !== 'text' && problemFiles.length === 0) || (problemUploadType === 'text' && !problemTextQuestion.trim())
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg hover:shadow-xl'
            }`}
          >
            {analyzing ? '🔄 AI가 분석 중...' : '🤖 AI 분석 요청'}
          </button>
        </div>

        {/* 분석 결과 */}
        {analysisResult && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              AI 분석 결과
            </h3>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                {analysisResult}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 분석 중 로딩 */}
      {analyzing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <div className="text-lg font-medium">문제를 분석하고 있습니다...</div>
              <div className="text-sm text-gray-500">잠시만 기다려주세요</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
