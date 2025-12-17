import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  MessageCircle, HelpCircle, ChevronDown, ChevronUp, Trash2, 
  Search, User, Calendar, Loader2, RefreshCw
} from 'lucide-react';

export default function QuestionManager() {
  const [activeType, setActiveType] = useState('concept'); // 'concept' or 'problem'
  const [conceptQuestions, setConceptQuestions] = useState([]);
  const [problemQuestions, setProblemQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 데이터 로드
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      // 개념과 지문 질문 로드
      const conceptSnapshot = await getDocs(collection(db, 'conceptQuestions'));
      let conceptData = conceptSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      conceptData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setConceptQuestions(conceptData);

      // 문제 풀이 질문 로드
      const problemSnapshot = await getDocs(collection(db, 'problemQuestions'));
      let problemData = problemSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      problemData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setProblemQuestions(problemData);

    } catch (error) {
      console.error('질문 로드 실패:', error);
    }
    setLoading(false);
  };

  // 질문 삭제
  const handleDelete = async (type, questionId) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;

    try {
      const collectionName = type === 'concept' ? 'conceptQuestions' : 'problemQuestions';
      await deleteDoc(doc(db, collectionName, questionId));
      
      if (type === 'concept') {
        setConceptQuestions(prev => prev.filter(q => q.id !== questionId));
      } else {
        setProblemQuestions(prev => prev.filter(q => q.id !== questionId));
      }
      
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 검색 필터
  const filterQuestions = (questions) => {
    if (!searchTerm.trim()) return questions;
    
    const term = searchTerm.toLowerCase();
    return questions.filter(q => 
      q.studentName?.toLowerCase().includes(term) ||
      q.question?.toLowerCase().includes(term) ||
      q.materialName?.toLowerCase().includes(term)
    );
  };

  const currentQuestions = activeType === 'concept' 
    ? filterQuestions(conceptQuestions) 
    : filterQuestions(problemQuestions);

  // 날짜 포맷
  const formatDate = (timestamp) => {
    if (!timestamp) return '날짜 없음';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          📋 학생 질문 관리
        </h2>
        <button
          onClick={loadQuestions}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      {/* 탭 선택 */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveType('concept')}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
            activeType === 'concept'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <MessageCircle size={20} />
          개념과 지문 ({conceptQuestions.length})
        </button>
        <button
          onClick={() => setActiveType('problem')}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition flex items-center justify-center gap-2 ${
            activeType === 'problem'
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <HelpCircle size={20} />
          문제 풀이 ({problemQuestions.length})
        </button>
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="학생 이름, 질문 내용, 교재명으로 검색..."
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <span className="ml-3 text-gray-600">질문을 불러오는 중...</span>
        </div>
      ) : currentQuestions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {searchTerm ? '검색 결과가 없습니다.' : '아직 등록된 질문이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {currentQuestions.map((question) => (
            <div 
              key={question.id}
              className="border rounded-xl overflow-hidden"
            >
              {/* 헤더 */}
              <div 
                onClick={() => setExpandedId(expandedId === question.id ? null : question.id)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      activeType === 'concept' ? 'bg-blue-100' : 'bg-violet-100'
                    }`}>
                      <User size={16} className={activeType === 'concept' ? 'text-blue-600' : 'text-violet-600'} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{question.studentName || '이름 없음'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar size={12} />
                        {formatDate(question.createdAt)}
                        {question.materialName && (
                          <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded">
                            {question.materialName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(activeType, question.id);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedId === question.id ? (
                      <ChevronUp className="text-gray-400" size={20} />
                    ) : (
                      <ChevronDown className="text-gray-400" size={20} />
                    )}
                  </div>
                </div>
                
                {/* 질문 미리보기 */}
                <p className="mt-2 text-sm text-gray-700 truncate">
                  Q: {question.question || '질문 내용 없음'}
                </p>
              </div>

              {/* 펼쳐진 내용 */}
              {expandedId === question.id && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                  {/* 질문 이미지 */}
                  {(question.questionImageUrls?.length > 0 || question.questionImageUrl) && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">📷 질문 이미지</p>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {(question.questionImageUrls || [question.questionImageUrl]).filter(Boolean).map((url, idx) => (
                          <a 
                            key={idx}
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img 
                              src={url} 
                              alt={`질문 이미지 ${idx + 1}`}
                              className="w-full h-20 object-cover rounded-lg border hover:opacity-80 transition"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 전체 질문 */}
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">❓ 질문 내용</p>
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {question.question || '질문 내용 없음'}
                      </p>
                    </div>
                  </div>

                  {/* 답변 */}
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">💡 답변</p>
                    <div className={`p-4 rounded-lg border ${
                      activeType === 'concept' 
                        ? 'bg-blue-50 border-blue-100' 
                        : 'bg-violet-50 border-violet-100'
                    }`}>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {question.answer || '답변 없음'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 통계 요약 */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-600 mb-1">개념과 지문 질문</p>
            <p className="text-2xl font-bold text-blue-700">{conceptQuestions.length}개</p>
          </div>
          <div className="p-4 bg-violet-50 rounded-xl">
            <p className="text-sm text-violet-600 mb-1">문제 풀이 질문</p>
            <p className="text-2xl font-bold text-violet-700">{problemQuestions.length}개</p>
          </div>
        </div>
      </div>
    </div>
  );
}
