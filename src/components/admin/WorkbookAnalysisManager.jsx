import React, { useState, useEffect } from 'react';
import { db, storage } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  BookOpen, Upload, Trash2, ChevronDown, ChevronUp, 
  FileText, Plus, Save, X, AlertCircle, CheckCircle,
  BarChart3, TrendingUp, Target, Calendar, User, Search,
  Loader2, Eye, Edit3, RefreshCw
} from 'lucide-react';

// 유형 분류 체계
const TYPE_CATEGORIES = {
  '독서-정보': ['일치불일치', '내용전개', '서술상특징', '어휘'],
  '독서-의미': ['추론', '이해', '반응', '평가', '구절의미', '대상비교'],
  '독서-보기': ['보기적용', '보기분석', '보기비교'],
  '문학-정보': ['일치불일치', '서술상특징', '표현상특징', '어휘'],
  '문학-의미': ['추론', '이해', '반응', '시어의미', '소재의미', '구절의미', '대상비교'],
  '문학-보기': ['보기감상', '보기적용', '외적준거'],
  '화작': ['화법', '작문', '화법작문통합'],
  '언매': ['언어', '매체', '언어매체통합']
};

// 색상 매핑
const TYPE_COLORS = {
  '독서-정보': 'bg-blue-100 text-blue-800',
  '독서-의미': 'bg-indigo-100 text-indigo-800',
  '독서-보기': 'bg-purple-100 text-purple-800',
  '문학-정보': 'bg-green-100 text-green-800',
  '문학-의미': 'bg-emerald-100 text-emerald-800',
  '문학-보기': 'bg-teal-100 text-teal-800',
  '화작': 'bg-orange-100 text-orange-800',
  '언매': 'bg-pink-100 text-pink-800'
};

export default function WorkbookAnalysisManager({ students }) {
  // 탭 상태
  const [activeSubTab, setActiveSubTab] = useState('workbooks'); // workbooks, wrongAnswers, analysis

  // 교재 관련 상태
  const [workbooks, setWorkbooks] = useState([]);
  const [showAddWorkbook, setShowAddWorkbook] = useState(false);
  const [newWorkbook, setNewWorkbook] = useState({
    name: '',
    grade: '고3',
    subject: '국어',
    totalQuestions: 45,
    questions: {}
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [editingWorkbook, setEditingWorkbook] = useState(null);

  // 오답 입력 관련 상태
  const [selectedWorkbook, setSelectedWorkbook] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [wrongQuestions, setWrongQuestions] = useState('');
  const [wrongAnswerRecords, setWrongAnswerRecords] = useState([]);
  const [wrongAnswerDate, setWrongAnswerDate] = useState(new Date().toISOString().split('T')[0]);

  // 분석 관련 상태
  const [analysisStudent, setAnalysisStudent] = useState(null);
  const [analysisPeriod, setAnalysisPeriod] = useState('week'); // week, month
  const [analysisData, setAnalysisData] = useState(null);

  // 로딩/에러 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 데이터 로드
  useEffect(() => {
    loadWorkbooks();
    loadWrongAnswerRecords();
  }, []);

  // 교재 목록 로드
  const loadWorkbooks = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'workbooks'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWorkbooks(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      console.error('교재 로드 실패:', err);
    }
  };

  // 오답 기록 로드
  const loadWrongAnswerRecords = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'wrongAnswers'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWrongAnswerRecords(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      console.error('오답 기록 로드 실패:', err);
    }
  };

  // PDF 파일 선택
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      setError('');
    } else {
      setError('PDF 파일만 업로드 가능합니다.');
    }
  };

  // AI 유형 분석 요청
  const analyzeWorkbook = async () => {
    if (!uploadedFile || !newWorkbook.name) {
      setError('교재명과 PDF 파일을 모두 입력해주세요.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      // PDF를 Base64로 변환
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      // API 호출
      const response = await fetch('/api/analyze-workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64,
          workbookName: newWorkbook.name,
          totalQuestions: newWorkbook.totalQuestions
        })
      });

      if (!response.ok) {
        throw new Error('AI 분석 요청 실패');
      }

      const result = await response.json();
      setAnalysisResult(result.questions);
      setNewWorkbook(prev => ({
        ...prev,
        questions: result.questions
      }));
      setSuccess('AI 분석이 완료되었습니다. 결과를 확인하고 저장해주세요.');
    } catch (err) {
      console.error('분석 오류:', err);
      setError('AI 분석 중 오류가 발생했습니다. 수동으로 입력해주세요.');
      // 수동 입력을 위한 빈 questions 객체 생성
      const emptyQuestions = {};
      for (let i = 1; i <= newWorkbook.totalQuestions; i++) {
        emptyQuestions[i] = { type: '', subType: '' };
      }
      setNewWorkbook(prev => ({ ...prev, questions: emptyQuestions }));
      setAnalysisResult(emptyQuestions);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 교재 저장
  const saveWorkbook = async () => {
    if (!newWorkbook.name || Object.keys(newWorkbook.questions).length === 0) {
      setError('교재명과 문제 유형을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // PDF 업로드 (선택사항)
      let pdfUrl = '';
      if (uploadedFile) {
        const storageRef = ref(storage, `workbooks/${Date.now()}_${uploadedFile.name}`);
        await uploadBytes(storageRef, uploadedFile);
        pdfUrl = await getDownloadURL(storageRef);
      }

      // Firestore에 저장
      await addDoc(collection(db, 'workbooks'), {
        ...newWorkbook,
        pdfUrl,
        createdAt: new Date()
      });

      setSuccess('교재가 성공적으로 등록되었습니다!');
      setShowAddWorkbook(false);
      setNewWorkbook({ name: '', grade: '고3', subject: '국어', totalQuestions: 45, questions: {} });
      setUploadedFile(null);
      setAnalysisResult(null);
      loadWorkbooks();
    } catch (err) {
      console.error('저장 오류:', err);
      setError('교재 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 교재 삭제
  const deleteWorkbook = async (workbookId) => {
    if (!window.confirm('이 교재를 삭제하시겠습니까? 관련 오답 기록도 함께 삭제됩니다.')) return;

    try {
      await deleteDoc(doc(db, 'workbooks', workbookId));
      
      // 관련 오답 기록도 삭제
      const wrongAnswersQuery = query(collection(db, 'wrongAnswers'), where('workbookId', '==', workbookId));
      const snapshot = await getDocs(wrongAnswersQuery);
      await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));

      setSuccess('교재가 삭제되었습니다.');
      loadWorkbooks();
      loadWrongAnswerRecords();
    } catch (err) {
      console.error('삭제 오류:', err);
      setError('교재 삭제 중 오류가 발생했습니다.');
    }
  };

  // 오답 저장
  const saveWrongAnswers = async () => {
    if (!selectedStudent || !selectedWorkbook || !wrongQuestions.trim()) {
      setError('학생, 교재, 틀린 문제 번호를 모두 입력해주세요.');
      return;
    }

    // 문제 번호 파싱 (예: "1, 3, 5-7, 10" -> [1, 3, 5, 6, 7, 10])
    const parseQuestions = (input) => {
      const result = [];
      const parts = input.split(/[,\s]+/).filter(p => p);
      
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) {
            if (!isNaN(i)) result.push(i);
          }
        } else {
          const num = parseInt(part);
          if (!isNaN(num)) result.push(num);
        }
      }
      return [...new Set(result)].sort((a, b) => a - b);
    };

    const wrongNums = parseQuestions(wrongQuestions);
    
    if (wrongNums.length === 0) {
      setError('올바른 문제 번호를 입력해주세요.');
      return;
    }

    // 유형 자동 매칭
    const workbook = workbooks.find(w => w.id === selectedWorkbook);
    const analyzedTypes = {};
    
    wrongNums.forEach(num => {
      const questionInfo = workbook.questions[num];
      if (questionInfo && questionInfo.type) {
        analyzedTypes[questionInfo.type] = (analyzedTypes[questionInfo.type] || 0) + 1;
      }
    });

    setLoading(true);
    try {
      await addDoc(collection(db, 'wrongAnswers'), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        workbookId: selectedWorkbook,
        workbookName: workbook.name,
        wrongQuestions: wrongNums,
        analyzedTypes,
        date: wrongAnswerDate,
        createdAt: new Date()
      });

      setSuccess(`${selectedStudent.name} 학생의 오답이 저장되었습니다. (${wrongNums.length}문제)`);
      setWrongQuestions('');
      loadWrongAnswerRecords();
    } catch (err) {
      console.error('오답 저장 오류:', err);
      setError('오답 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 주간/월간 분석 생성
  const generateAnalysis = async () => {
    if (!analysisStudent) {
      setError('분석할 학생을 선택해주세요.');
      return;
    }

    const now = new Date();
    let startDate;
    
    if (analysisPeriod === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 해당 기간의 오답 기록 필터링
    const filteredRecords = wrongAnswerRecords.filter(record => {
      if (record.studentId !== analysisStudent.id) return false;
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= now;
    });

    if (filteredRecords.length === 0) {
      setError('해당 기간에 오답 기록이 없습니다.');
      return;
    }

    // 유형별 집계
    const typeStats = {};
    let totalWrong = 0;

    filteredRecords.forEach(record => {
      totalWrong += record.wrongQuestions.length;
      Object.entries(record.analyzedTypes || {}).forEach(([type, count]) => {
        typeStats[type] = (typeStats[type] || 0) + count;
      });
    });

    // 약점 유형 정렬 (많이 틀린 순)
    const sortedTypes = Object.entries(typeStats)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / totalWrong) * 100)
      }));

    setAnalysisData({
      student: analysisStudent,
      period: analysisPeriod,
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      totalRecords: filteredRecords.length,
      totalWrong,
      typeStats: sortedTypes,
      weaknesses: sortedTypes.slice(0, 3),
      records: filteredRecords
    });
  };

  // 유형 수동 수정
  const updateQuestionType = (questionNum, field, value) => {
    setNewWorkbook(prev => ({
      ...prev,
      questions: {
        ...prev.questions,
        [questionNum]: {
          ...prev.questions[questionNum],
          [field]: value
        }
      }
    }));
  };

  // 에러/성공 메시지 자동 제거
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl">
            <BookOpen className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">교재 오답 분석</h2>
            <p className="text-gray-500 text-sm">교재별 문제 유형 분석 및 학생 약점 진단</p>
          </div>
        </div>
      </div>

      {/* 알림 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* 서브 탭 */}
      <div className="flex gap-2 mb-6 border-b pb-4">
        <button
          onClick={() => setActiveSubTab('workbooks')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeSubTab === 'workbooks'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📚 교재 관리
        </button>
        <button
          onClick={() => setActiveSubTab('wrongAnswers')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeSubTab === 'wrongAnswers'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ✏️ 오답 입력
        </button>
        <button
          onClick={() => setActiveSubTab('analysis')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeSubTab === 'analysis'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📊 약점 분석
        </button>
      </div>

      {/* 교재 관리 탭 */}
      {activeSubTab === 'workbooks' && (
        <div>
          {/* 교재 등록 버튼 */}
          <button
            onClick={() => setShowAddWorkbook(!showAddWorkbook)}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            새 교재 등록
          </button>

          {/* 교재 등록 폼 */}
          {showAddWorkbook && (
            <div className="mb-6 p-6 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📚 새 교재 등록</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교재명 *</label>
                  <input
                    type="text"
                    value={newWorkbook.name}
                    onChange={(e) => setNewWorkbook(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 오늘의 주간지 12월 마지막주"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                  <select
                    value={newWorkbook.grade}
                    onChange={(e) => setNewWorkbook(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
                  <select
                    value={newWorkbook.subject}
                    onChange={(e) => setNewWorkbook(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="국어">국어</option>
                    <option value="문학">문학</option>
                    <option value="독서">독서</option>
                    <option value="화법과작문">화법과작문</option>
                    <option value="언어와매체">언어와매체</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">총 문항 수</label>
                  <input
                    type="number"
                    value={newWorkbook.totalQuestions}
                    onChange={(e) => setNewWorkbook(prev => ({ ...prev, totalQuestions: parseInt(e.target.value) || 45 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* PDF 업로드 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  교재 PDF 업로드 (AI 자동 분석)
                </label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={analyzeWorkbook}
                    disabled={!uploadedFile || isAnalyzing}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      !uploadedFile || isAnalyzing
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        분석 중...
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        AI 분석
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  PDF를 업로드하면 AI가 문제 유형을 자동으로 분류합니다. (분석 비용: 약 100원/교재)
                </p>
              </div>

              {/* 분석 결과 또는 수동 입력 */}
              {analysisResult && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-700 mb-2">문제별 유형 설정</h4>
                  <div className="max-h-96 overflow-y-auto border rounded-lg p-3 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {Object.keys(analysisResult).map(num => (
                        <div key={num} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="w-8 text-center font-medium text-gray-700">{num}번</span>
                          <select
                            value={newWorkbook.questions[num]?.type || ''}
                            onChange={(e) => updateQuestionType(num, 'type', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                          >
                            <option value="">유형 선택</option>
                            {Object.keys(TYPE_CATEGORIES).map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <select
                            value={newWorkbook.questions[num]?.subType || ''}
                            onChange={(e) => updateQuestionType(num, 'subType', e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                            disabled={!newWorkbook.questions[num]?.type}
                          >
                            <option value="">세부유형</option>
                            {newWorkbook.questions[num]?.type && 
                              TYPE_CATEGORIES[newWorkbook.questions[num].type]?.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))
                            }
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 저장/취소 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={saveWorkbook}
                  disabled={loading || !newWorkbook.name}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  <Save size={18} />
                  저장
                </button>
                <button
                  onClick={() => {
                    setShowAddWorkbook(false);
                    setNewWorkbook({ name: '', grade: '고3', subject: '국어', totalQuestions: 45, questions: {} });
                    setUploadedFile(null);
                    setAnalysisResult(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  <X size={18} />
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 등록된 교재 목록 */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800">등록된 교재 ({workbooks.length})</h3>
            {workbooks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">등록된 교재가 없습니다.</p>
            ) : (
              workbooks.map(workbook => (
                <div key={workbook.id} className="p-4 border rounded-xl hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-800">{workbook.name}</h4>
                      <p className="text-sm text-gray-500">
                        {workbook.grade} | {workbook.subject} | {workbook.totalQuestions}문항 |
                        등록일: {workbook.createdAt?.toDate?.()?.toLocaleDateString() || '-'}
                      </p>
                      {/* 유형 분포 미니 차트 */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(
                          Object.values(workbook.questions || {}).reduce((acc, q) => {
                            if (q.type) acc[q.type] = (acc[q.type] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([type, count]) => (
                          <span key={type} className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[type] || 'bg-gray-100'}`}>
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingWorkbook(editingWorkbook === workbook.id ? null : workbook.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="상세보기"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => deleteWorkbook(workbook.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  {/* 상세 펼침 */}
                  {editingWorkbook === workbook.id && (
                    <div className="mt-4 pt-4 border-t">
                      <h5 className="font-medium text-gray-700 mb-2">문제별 유형</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {Object.entries(workbook.questions || {}).map(([num, info]) => (
                          <div key={num} className="text-sm p-2 bg-gray-50 rounded">
                            <span className="font-medium">{num}번:</span>{' '}
                            <span className={`${TYPE_COLORS[info.type] || ''} px-1 rounded`}>
                              {info.type || '미지정'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 오답 입력 탭 */}
      {activeSubTab === 'wrongAnswers' && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 오답 입력 폼 */}
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4">✏️ 오답 입력</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">학생 선택 *</label>
                  <select
                    value={selectedStudent?.id || ''}
                    onChange={(e) => {
                      const student = students.find(s => s.id === e.target.value);
                      setSelectedStudent(student);
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">학생을 선택하세요</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>{student.name} ({student.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교재 선택 *</label>
                  <select
                    value={selectedWorkbook || ''}
                    onChange={(e) => setSelectedWorkbook(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">교재를 선택하세요</option>
                    {workbooks.map(workbook => (
                      <option key={workbook.id} value={workbook.id}>{workbook.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                  <input
                    type="date"
                    value={wrongAnswerDate}
                    onChange={(e) => setWrongAnswerDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">틀린 문제 번호 *</label>
                  <input
                    type="text"
                    value={wrongQuestions}
                    onChange={(e) => setWrongQuestions(e.target.value)}
                    placeholder="예: 1, 3, 5-7, 10 (쉼표, 공백, 범위 모두 가능)"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    쉼표, 공백으로 구분하거나 5-7처럼 범위로 입력할 수 있습니다.
                  </p>
                </div>

                <button
                  onClick={saveWrongAnswers}
                  disabled={loading || !selectedStudent || !selectedWorkbook || !wrongQuestions}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Save size={20} />
                  오답 저장
                </button>
              </div>
            </div>

            {/* 최근 오답 기록 */}
            <div className="p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📋 최근 오답 기록</h3>
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {wrongAnswerRecords.slice(0, 20).map(record => (
                  <div key={record.id} className="p-3 bg-white rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{record.studentName}</span>
                        <span className="text-gray-500 text-sm ml-2">{record.date}</span>
                      </div>
                      <span className="text-red-500 font-medium">{record.wrongQuestions?.length || 0}문제</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{record.workbookName}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(record.analyzedTypes || {}).map(([type, count]) => (
                        <span key={type} className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[type] || 'bg-gray-100'}`}>
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {wrongAnswerRecords.length === 0 && (
                  <p className="text-gray-500 text-center py-8">오답 기록이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 약점 분석 탭 */}
      {activeSubTab === 'analysis' && (
        <div>
          {/* 분석 조건 설정 */}
          <div className="mb-6 p-6 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 약점 분석</h3>
            
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학생 선택</label>
                <select
                  value={analysisStudent?.id || ''}
                  onChange={(e) => {
                    const student = students.find(s => s.id === e.target.value);
                    setAnalysisStudent(student);
                  }}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>{student.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">분석 기간</label>
                <select
                  value={analysisPeriod}
                  onChange={(e) => setAnalysisPeriod(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="week">최근 1주일</option>
                  <option value="month">이번 달</option>
                </select>
              </div>

              <button
                onClick={generateAnalysis}
                disabled={!analysisStudent}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                <BarChart3 size={20} />
                분석 생성
              </button>
            </div>
          </div>

          {/* 분석 결과 */}
          {analysisData && (
            <div className="space-y-6">
              {/* 요약 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <User size={20} />
                    <span className="font-medium">학생</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-800">{analysisData.student.name}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <Calendar size={20} />
                    <span className="font-medium">분석 기간</span>
                  </div>
                  <p className="text-lg font-bold text-purple-800">
                    {analysisData.startDate} ~ {analysisData.endDate}
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl">
                  <div className="flex items-center gap-2 text-orange-600 mb-2">
                    <FileText size={20} />
                    <span className="font-medium">분석 교재</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-800">{analysisData.totalRecords}권</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <Target size={20} />
                    <span className="font-medium">총 오답</span>
                  </div>
                  <p className="text-2xl font-bold text-red-800">{analysisData.totalWrong}문제</p>
                </div>
              </div>

              {/* 약점 유형 TOP 3 */}
              <div className="p-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200">
                <h4 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertCircle size={20} />
                  약점 유형 TOP 3
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisData.weaknesses.map((weakness, index) => (
                    <div key={weakness.type} className="p-4 bg-white rounded-xl shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full ${
                          index === 0 ? 'bg-red-500 text-white' :
                          index === 1 ? 'bg-orange-500 text-white' :
                          'bg-yellow-500 text-white'
                        } font-bold`}>
                          {index + 1}
                        </span>
                        <span className={`font-medium ${TYPE_COLORS[weakness.type]} px-2 py-1 rounded`}>
                          {weakness.type}
                        </span>
                      </div>
                      <p className="text-gray-600">
                        {weakness.count}문제 ({weakness.percentage}%)
                      </p>
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            index === 0 ? 'bg-red-500' :
                            index === 1 ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${weakness.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 전체 유형별 통계 */}
              <div className="p-6 bg-white rounded-xl border">
                <h4 className="text-lg font-bold text-gray-800 mb-4">📈 유형별 오답 분포</h4>
                <div className="space-y-3">
                  {analysisData.typeStats.map(stat => (
                    <div key={stat.type} className="flex items-center gap-4">
                      <span className={`w-24 text-sm font-medium ${TYPE_COLORS[stat.type]} px-2 py-1 rounded`}>
                        {stat.type}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-gray-600">
                        {stat.count}문제 ({stat.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 피드백 메시지 */}
              <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                <h4 className="text-lg font-bold text-indigo-800 mb-3">💡 학습 피드백</h4>
                <div className="space-y-2 text-indigo-700">
                  {analysisData.weaknesses[0] && (
                    <p>
                      • <strong>{analysisData.weaknesses[0].type}</strong> 유형에서 가장 많은 오답이 발생했습니다. 
                      해당 유형의 문제 풀이 전략을 집중적으로 학습하세요.
                    </p>
                  )}
                  {analysisData.weaknesses[0]?.type.startsWith('독서-') && (
                    <p>• 독서 영역에서 약점이 보입니다. 지문 구조 파악과 핵심 정보 추출 연습을 권장합니다.</p>
                  )}
                  {analysisData.weaknesses[0]?.type.startsWith('문학-') && (
                    <p>• 문학 영역에서 약점이 보입니다. 작품의 주제와 표현 기법을 꼼꼼히 분석하는 연습이 필요합니다.</p>
                  )}
                  {analysisData.weaknesses.some(w => w.type.includes('보기')) && (
                    <p>• 보기 문제에서 오답이 많습니다. 보기 내용과 지문/작품을 연결하는 연습을 강화하세요.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!analysisData && (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
              <p>학생을 선택하고 분석을 생성해주세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
