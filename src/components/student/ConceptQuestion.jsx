import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { 
  MessageCircle, Send, Camera, X, Loader2, 
  History, Lightbulb, AlertCircle,
  Image as ImageIcon
} from 'lucide-react';

const ConceptQuestion = ({ currentUser }) => {
  // 질문
  const [questionType, setQuestionType] = useState('text');
  const [questionText, setQuestionText] = useState('');
  const [questionImage, setQuestionImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // 답변
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 질문 이력 및 제한
  const [questionHistory, setQuestionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [canAsk, setCanAsk] = useState(true);

  const WEEKLY_LIMIT = 3;

  // 이번 주 시작일 계산
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // 질문 이력 및 주간 횟수 로드
  useEffect(() => {
    if (currentUser?.id) {
      loadQuestionHistory();
    }
  }, [currentUser]);

  const loadQuestionHistory = async () => {
    try {
      const q = query(
        collection(db, 'conceptQuestions'),
        where('studentId', '==', currentUser.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuestionHistory(history);

      // 이번 주 질문 횟수 계산
      const weekStart = getWeekStart();
      const weeklyQuestions = history.filter(q => {
        if (!q.createdAt) return false;
        const questionDate = q.createdAt.toDate ? q.createdAt.toDate() : new Date(q.createdAt);
        return questionDate >= weekStart;
      });
      
      setWeeklyCount(weeklyQuestions.length);
      setCanAsk(weeklyQuestions.length < WEEKLY_LIMIT);
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
    if (!canAsk) {
      alert('이번 주 질문 횟수를 모두 사용했습니다. 선생님께 문의해주세요.');
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
    
    setLoading(true);
    setAnswer('');
    
    try {
      let questionImageUrl = null;
      let imageBase64 = null;
      
      // 이미지 질문인 경우
      if (questionType === 'image' && questionImage) {
        // 이미지 업로드
        const timestamp = Date.now();
        const fileName = `concept-questions/${currentUser.id}/${timestamp}_${questionImage.name}`;
        const storageRef = ref(storage, fileName);
        await uploadBytes(storageRef, questionImage);
        questionImageUrl = await getDownloadURL(storageRef);
        
        // 이미지를 base64로 변환
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(questionImage);
        });
      }
      
      // 서버리스 함수 호출
      const response = await fetch('/api/concept-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: questionText,
          imageBase64: imageBase64,
          mediaType: questionImage?.type
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '질문 처리 실패');
      }
      
      const data = await response.json();
      const answerText = data.answer;
      const finalQuestion = data.extractedQuestion || questionText;
      
      setAnswer(answerText);
      
      // 질문 기록 저장
      await addDoc(collection(db, 'conceptQuestions'), {
        studentId: currentUser.id,
        studentName: currentUser.name,
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
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
              <MessageCircle className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                개념과 지문
              </h2>
              <p className="text-sm text-gray-500">
                문법 개념, 작품 해설, 지문 해석에 대해 질문하세요
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              showHistory ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <History size={18} />
            질문 이력
          </button>
        </div>

        {/* 질문 횟수 안내 */}
        <div className={`p-4 rounded-lg mb-4 ${canAsk ? 'bg-blue-50' : 'bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className={canAsk ? 'text-blue-600' : 'text-red-600'} />
              <span className={canAsk ? 'text-blue-700' : 'text-red-700'}>
                이번 주 질문: <strong>{weeklyCount} / {WEEKLY_LIMIT}회</strong>
              </span>
            </div>
            {!canAsk && (
              <span className="text-red-600 text-sm font-medium">
                질문 횟수를 모두 사용했습니다. 선생님께 문의해주세요.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 질문 입력 */}
      {canAsk && !answer && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-lg mb-4">✏️ 질문 입력</h3>
          
          {/* 질문 방식 선택 */}
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setQuestionType('text')}
              className={`flex-1 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                questionType === 'text'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
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
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
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
                placeholder="예: 역설법이 무엇인가요? / 청산별곡의 주제가 뭔가요?"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 개념, 문법, 작품 해설, 지문 해석에 대해 질문할 수 있어요!
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
                  <input
                    type="file"
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                    id="question-image"
                  />
                  <label htmlFor="question-image" className="cursor-pointer">
                    <ImageIcon className="mx-auto text-gray-400 mb-2" size={40} />
                    <p className="text-gray-500">교재나 지문 사진을 업로드하세요</p>
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
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-bold hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
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

      {/* 질문 횟수 초과 안내 */}
      {!canAsk && !answer && (
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-gray-800 mb-2">이번 주 질문 횟수를 모두 사용했습니다</h3>
          <p className="text-gray-600 mb-4">
            추가 질문이 필요하시면 선생님께 문의해주세요.
          </p>
          <p className="text-sm text-gray-500">
            질문 횟수는 매주 월요일에 초기화됩니다.
          </p>
        </div>
      )}

      {/* 답변 */}
      {answer && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="text-yellow-500" size={24} />
            <h3 className="font-bold text-lg">답변</h3>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 mb-4">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {answer}
            </div>
          </div>
          
          {canAsk && (
            <button
              onClick={resetQuestion}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              새 질문하기
            </button>
          )}
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
      <div className="bg-blue-50 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 mb-2">💡 이런 질문을 할 수 있어요</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 문법 개념: "역설법이 뭐예요?", "서술자 시점 종류 알려주세요"</li>
          <li>• 작품 해설: "청산별곡의 주제가 뭔가요?"</li>
          <li>• 지문 해석: 교재 사진을 찍어서 질문하세요</li>
          <li>• 주 3회까지 질문할 수 있어요</li>
        </ul>
      </div>
    </div>
  );
};

export default ConceptQuestion;
