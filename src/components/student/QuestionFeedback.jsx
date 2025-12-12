import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { 
  MessageCircle, Send, BookOpen, Camera, X, Loader2, 
  ChevronDown, History, Lightbulb, AlertCircle, CheckCircle,
  Image as ImageIcon
} from 'lucide-react';

const QuestionFeedback = ({ currentUser }) => {
  // 학습 자료 목록
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  
  // 질문
  const [questionType, setQuestionType] = useState('text'); // 'text' or 'image'
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // 답변
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  
  // 질문 이력
  const [questionHistory, setQuestionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // 학생 학년 (currentUser에서 가져옴)
  const studentGrade = currentUser?.grade || '';

  // 학습 자료 로드 (학생 학년에 맞는 것만)
  useEffect(() => {
    loadMaterials();
  }, [studentGrade]);

  // 질문 이력 로드
  useEffect(() => {
    if (currentUser?.id) {
      loadQuestionHistory();
    }
  }, [currentUser]);

  const loadMaterials = async () => {
    setLoadingMaterials(true);
    try {
      const q = query(
        collection(db, 'learningMaterials'),
        where('textExtracted', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      let materialList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 학생 학년에 맞는 자료만 필터링 (선택사항)
      // 일단은 모든 자료를 보여주되, 같은 학년 자료를 우선 표시
      if (studentGrade) {
        materialList.sort((a, b) => {
          if (a.grade === studentGrade && b.grade !== studentGrade) return -1;
          if (a.grade !== studentGrade && b.grade === studentGrade) return 1;
          return 0;
        });
      }
      
      setMaterials(materialList);
    } catch (error) {
      console.error('학습 자료 로드 실패:', error);
    }
    setLoadingMaterials(false);
  };

  const loadQuestionHistory = async () => {
    try {
      const q = query(
        collection(db, 'questionFeedback'),
        where('studentId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setQuestionHistory(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    } catch (error) {
      console.error('질문 이력 로드 실패:', error);
    }
  };

  // 이미지 선택
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 크기는 5MB 이하만 가능합니다.');
        return;
      }
      
      setQuestionImage(file);
      
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // 이미지 제거
  const removeImage = () => {
    setQuestionImage(null);
    setImagePreview(null);
  };

  // 질문하기
  const handleSubmitQuestion = async () => {
    if (!selectedMaterial) {
      alert('먼저 교재를 선택해주세요.');
      return;
    }
    
    if (questionType === 'text' && !questionText.trim()) {
      alert('질문을 입력해주세요.');
      return;
    }
    
    if (questionType === 'image' && !questionImage) {
      alert('질문 이미지를 업로드해주세요.');
      return;
    }
    
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      alert('API 키가 설정되지 않았습니다.\n선생님께 문의해주세요.');
      return;
    }
    
    setLoading(true);
    setAnswer('');
    
    try {
      let finalQuestion = questionText;
      let questionImageUrl = null;
      
      // 이미지 질문인 경우
      if (questionType === 'image' && questionImage) {
        // 이미지 업로드
        const timestamp = Date.now();
        const fileName = `question-images/${currentUser.id}/${timestamp}_${questionImage.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, questionImage);
        questionImageUrl = await getDownloadURL(storageRef);
        
        // 이미지를 base64로 변환
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(questionImage);
        });
        
        // 먼저 이미지에서 질문 내용 추출
        const extractResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: questionImage.type,
                      data: base64
                    }
                  },
                  {
                    type: 'text',
                    text: '이 이미지에서 학생이 질문하는 내용을 추출해주세요. 손글씨로 쓴 질문이 있다면 그 내용을 읽어주세요. 문제나 지문이 있다면 어떤 문제에 대한 질문인지도 파악해주세요.'
                  }
                ]
              }
            ]
          })
        });
        
        const extractData = await extractResponse.json();
        finalQuestion = extractData.content[0].text;
      }
      
      // 학습 자료 기반 답변 생성
      const systemPrompt = `당신은 국어 과목 전문 학습 도우미입니다. 
학생이 질문하면 제공된 학습 자료를 바탕으로 친절하고 이해하기 쉽게 설명해주세요.

[학습 자료 정보]
- 교재: ${selectedMaterial.bookName}
- 단원: ${selectedMaterial.chapter || '전체'}
- 학년: ${selectedMaterial.grade}
- 과정: ${selectedMaterial.course}

[학습 자료 내용]
${selectedMaterial.extractedText}

---

답변 원칙:
1. 먼저 학습 자료에 있는 내용을 바탕으로 설명하세요.
2. 자료에 직접적인 답이 없다면, 관련 개념을 활용해 설명하세요.
3. 필요한 경우 추가적인 국어 개념을 덧붙여 설명할 수 있습니다.
4. 학생 수준에 맞게 쉽게 설명하세요.
5. 예시를 들어 설명하면 더 좋습니다.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: finalQuestion
            }
          ]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API 호출 실패');
      }
      
      const data = await response.json();
      const answerText = data.content[0].text;
      
      setAnswer(answerText);
      
      // 질문 기록 저장
      await addDoc(collection(db, 'questionFeedback'), {
        studentId: currentUser.id,
        studentName: currentUser.name,
        materialId: selectedMaterial.id,
        materialName: `${selectedMaterial.bookName} ${selectedMaterial.chapter || ''}`,
        questionType: questionType,
        question: finalQuestion,
        questionImageUrl: questionImageUrl,
        answer: answerText,
        createdAt: serverTimestamp()
      });
      
      // 이력 새로고침
      loadQuestionHistory();
      
    } catch (error) {
      console.error('질문 처리 실패:', error);
      setAnswer(`죄송합니다. 오류가 발생했습니다: ${error.message}`);
    }
    
    setLoading(false);
  };

  // 새 질문
  const resetQuestion = () => {
    setQuestionText('');
    setQuestionImage(null);
    setImagePreview(null);
    setAnswer('');
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
              <MessageCircle className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                질문하기
              </h2>
              <p className="text-gray-500 text-sm">학습 자료에 대해 궁금한 점을 질문하세요</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              showHistory 
                ? 'bg-violet-100 text-violet-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <History size={18} />
            질문 이력
          </button>
        </div>

        {/* 교재 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📚 교재 선택 *
          </label>
          {loadingMaterials ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="animate-spin" size={16} />
              자료 로딩 중...
            </div>
          ) : materials.length === 0 ? (
            <div className="p-4 bg-yellow-50 rounded-lg text-yellow-700 text-sm">
              <AlertCircle className="inline mr-2" size={16} />
              아직 등록된 학습 자료가 없습니다. 선생님께 문의하세요.
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedMaterial?.id || ''}
                onChange={(e) => {
                  const material = materials.find(m => m.id === e.target.value);
                  setSelectedMaterial(material);
                  resetQuestion();
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 appearance-none bg-white"
              >
                <option value="">교재를 선택하세요</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    [{m.grade}] {m.bookName} {m.chapter ? `- ${m.chapter}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          )}
        </div>

        {/* 선택된 교재 정보 */}
        {selectedMaterial && (
          <div className="mb-4 p-3 bg-violet-50 rounded-lg">
            <p className="text-sm text-violet-700">
              <BookOpen className="inline mr-2" size={16} />
              <strong>{selectedMaterial.bookName}</strong>
              {selectedMaterial.chapter && ` - ${selectedMaterial.chapter}`}
              <span className="ml-2 text-violet-500">({selectedMaterial.grade} · {selectedMaterial.course})</span>
            </p>
          </div>
        )}
      </div>

      {/* 질문 입력 */}
      {selectedMaterial && !answer && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4">✏️ 질문 입력</h3>
          
          {/* 질문 방식 선택 */}
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setQuestionType('text')}
              className={`flex-1 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                questionType === 'text'
                  ? 'bg-violet-100 text-violet-700 border-2 border-violet-500'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent'
              }`}
            >
              <MessageCircle size={20} />
              텍스트로 질문
            </button>
            <button
              onClick={() => setQuestionType('image')}
              className={`flex-1 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                questionType === 'image'
                  ? 'bg-violet-100 text-violet-700 border-2 border-violet-500'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent'
              }`}
            >
              <Camera size={20} />
              사진으로 질문
            </button>
          </div>

          {/* 텍스트 질문 */}
          {questionType === 'text' && (
            <div className="mb-4">
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="예: 15번 문제에서 화자의 정서가 뭔지 모르겠어요."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 문제 번호와 구체적인 질문을 적으면 더 정확한 답변을 받을 수 있어요!
              </p>
            </div>
          )}

          {/* 이미지 질문 */}
          {questionType === 'image' && (
            <div className="mb-4">
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="질문 이미지" 
                    className="max-h-60 mx-auto rounded-lg"
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-violet-500 transition">
                  <input
                    type="file"
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                    id="question-image"
                  />
                  <label htmlFor="question-image" className="cursor-pointer">
                    <ImageIcon className="mx-auto text-gray-400 mb-2" size={40} />
                    <p className="text-gray-500">교재 사진을 업로드하세요</p>
                    <p className="text-gray-400 text-sm">손글씨로 질문을 적어도 됩니다</p>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* 질문 버튼 */}
          <button
            onClick={handleSubmitQuestion}
            disabled={loading || (questionType === 'text' && !questionText.trim()) || (questionType === 'image' && !questionImage)}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                답변 생성 중...
              </>
            ) : (
              <>
                <Send size={20} />
                질문하기
              </>
            )}
          </button>
        </div>
      )}

      {/* 답변 */}
      {answer && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="text-yellow-500" size={24} />
            <h3 className="font-bold text-lg">답변</h3>
          </div>
          
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-5 mb-4">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {answer}
            </div>
          </div>
          
          <button
            onClick={resetQuestion}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
          >
            새 질문하기
          </button>
        </div>
      )}

      {/* 질문 이력 */}
      {showHistory && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <History size={20} />
            내 질문 이력
          </h3>
          
          {questionHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">아직 질문 이력이 없습니다.</p>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {questionHistory.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded">
                      {item.materialName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {item.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || ''}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    Q: {item.question?.substring(0, 100)}{item.question?.length > 100 ? '...' : ''}
                  </p>
                  
                  <p className="text-sm text-gray-600">
                    A: {item.answer?.substring(0, 150)}{item.answer?.length > 150 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-violet-50 rounded-xl p-4">
        <h4 className="font-medium text-violet-800 mb-2">💡 질문 팁</h4>
        <ul className="text-sm text-violet-700 space-y-1">
          <li>• 문제 번호를 정확히 적어주세요. (예: "15번 문제")</li>
          <li>• 어떤 부분이 헷갈리는지 구체적으로 질문하세요.</li>
          <li>• 사진으로 질문할 때는 글씨가 잘 보이게 찍어주세요.</li>
          <li>• 같은 교재의 다른 문제도 계속 질문할 수 있어요!</li>
        </ul>
      </div>
    </div>
  );
};

export default QuestionFeedback;
