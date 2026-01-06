import React, { useState, useEffect } from 'react';
import { db, storage } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { BookOpen, Trash2, FileText, Plus, Save, X, AlertCircle, CheckCircle, BarChart3, Target, Calendar, User, Search, Loader2, Eye, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';

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

const SELECTION_START = 35;

export default function WorkbookAnalysisManager({ students, branch }) {
  const [activeSubTab, setActiveSubTab] = useState('workbooks');
  const [workbooks, setWorkbooks] = useState([]);
  const [showAddWorkbook, setShowAddWorkbook] = useState(false);
  const [newWorkbook, setNewWorkbook] = useState({ name: '', grade: '고3', subject: '국어', totalQuestions: 45, questions: {}, hasSelection: true });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [editingWorkbook, setEditingWorkbook] = useState(null);
  const [selectedWorkbook, setSelectedWorkbook] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [wrongQuestions, setWrongQuestions] = useState('');
  const [wrongAnswerRecords, setWrongAnswerRecords] = useState([]);
  const [wrongAnswerDate, setWrongAnswerDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentSelection, setStudentSelection] = useState('언매');
  const [analysisStudent, setAnalysisStudent] = useState(null);
  const [analysisPeriod, setAnalysisPeriod] = useState('week');
  const [analysisData, setAnalysisData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadWorkbooks(); loadWrongAnswerRecords(); }, [branch]);
  
  // 지점 변경 시 선택 초기화
  useEffect(() => {
    setSelectedStudent(null);
    setSelectedWorkbook(null);
    setAnalysisStudent(null);
    setAnalysisData(null);
  }, [branch]);

  const loadWorkbooks = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'workbooks'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 지점별 필터링
      const filtered = data.filter(w => {
        if (branch === 'baegot') return w.branch === 'baegot';
        return !w.branch || w.branch === '' || w.branch === 'gwangjin';
      });
      setWorkbooks(filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) { console.error('교재 로드 실패:', err); }
  };

  const loadWrongAnswerRecords = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'wrongAnswers'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 지점별 필터링
      const filtered = data.filter(r => {
        if (branch === 'baegot') return r.branch === 'baegot';
        return !r.branch || r.branch === '' || r.branch === 'gwangjin';
      });
      setWrongAnswerRecords(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) { console.error('오답 기록 로드 실패:', err); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') { setUploadedFile(file); setError(''); }
    else { setError('PDF 파일만 업로드 가능합니다.'); }
  };

  const analyzeWorkbook = async () => {
    if (!uploadedFile || !newWorkbook.name) { setError('교재명과 PDF 파일을 모두 입력해주세요.'); return; }
    setIsAnalyzing(true); setError('');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });
      const response = await fetch('/api/analyze-workbook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, workbookName: newWorkbook.name, totalQuestions: newWorkbook.totalQuestions })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || result.error || 'AI 분석 요청 실패');
      if (result.questions && Object.keys(result.questions).length > 0) {
        const hasValidData = Object.values(result.questions).some(q => q.type && q.type !== '');
        if (hasValidData) {
          let processedQuestions = { ...result.questions };
          if (newWorkbook.grade === '고3' && newWorkbook.hasSelection) {
            for (let i = SELECTION_START; i <= newWorkbook.totalQuestions; i++) {
              const originalQ = result.questions[i] || { type: '', subType: '' };
              processedQuestions[i + '_언매'] = originalQ.type === '언매' ? originalQ : { type: '언매', subType: '' };
              processedQuestions[i + '_화작'] = originalQ.type === '화작' ? originalQ : { type: '화작', subType: '' };
              delete processedQuestions[i];
            }
          }
          setAnalysisResult(processedQuestions);
          setNewWorkbook(prev => ({ ...prev, questions: processedQuestions }));
          setSuccess('AI 분석이 완료되었습니다. 결과를 확인하고 저장해주세요.');
        } else throw new Error('AI가 유형을 분류하지 못했습니다.');
      } else throw new Error('분석 결과가 비어있습니다.');
    } catch (err) {
      console.error('분석 오류:', err);
      setError('AI 분석 중 오류: ' + err.message + '. 수동으로 입력해주세요.');
      const emptyQuestions = {};
      for (let i = 1; i <= newWorkbook.totalQuestions; i++) {
        if (newWorkbook.grade === '고3' && newWorkbook.hasSelection && i >= SELECTION_START) {
          emptyQuestions[i + '_화작'] = { type: '화작', subType: '' };
          emptyQuestions[i + '_언매'] = { type: '언매', subType: '' };
        } else emptyQuestions[i] = { type: '', subType: '' };
      }
      setNewWorkbook(prev => ({ ...prev, questions: emptyQuestions }));
      setAnalysisResult(emptyQuestions);
    } finally { setIsAnalyzing(false); }
  };

  const saveWorkbook = async () => {
    if (!newWorkbook.name || Object.keys(newWorkbook.questions).length === 0) { setError('교재명과 문제 유형을 모두 입력해주세요.'); return; }
    setLoading(true);
    try {
      let pdfUrl = '';
      if (uploadedFile) {
        const storageRef = ref(storage, 'workbooks/' + Date.now() + '_' + uploadedFile.name);
        await uploadBytes(storageRef, uploadedFile);
        pdfUrl = await getDownloadURL(storageRef);
      }
      // 지점 정보 추가
      await addDoc(collection(db, 'workbooks'), { 
        ...newWorkbook, 
        pdfUrl, 
        branch: branch === 'baegot' ? 'baegot' : '',
        createdAt: new Date() 
      });
      setSuccess('교재가 성공적으로 등록되었습니다!');
      setShowAddWorkbook(false);
      setNewWorkbook({ name: '', grade: '고3', subject: '국어', totalQuestions: 45, questions: {}, hasSelection: true });
      setUploadedFile(null); setAnalysisResult(null); loadWorkbooks();
    } catch (err) { setError('교재 저장 중 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const deleteWorkbook = async (workbookId) => {
    if (!window.confirm('이 교재를 삭제하시겠습니까?')) return;
    try { await deleteDoc(doc(db, 'workbooks', workbookId)); setSuccess('교재가 삭제되었습니다.'); loadWorkbooks(); }
    catch (err) { setError('교재 삭제 중 오류가 발생했습니다.'); }
  };

  const saveWrongAnswers = async () => {
    if (!selectedStudent || !selectedWorkbook || !wrongQuestions.trim()) { setError('학생, 교재, 틀린 문제 번호를 모두 입력해주세요.'); return; }
    const parseQuestions = (input) => {
      const result = [];
      const parts = input.split(/[,\s]+/).filter(p => p);
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) if (!isNaN(i)) result.push(i);
        } else { const num = parseInt(part); if (!isNaN(num)) result.push(num); }
      }
      return [...new Set(result)].sort((a, b) => a - b);
    };
    const wrongNums = parseQuestions(wrongQuestions);
    if (wrongNums.length === 0) { setError('올바른 문제 번호를 입력해주세요.'); return; }
    const workbook = workbooks.find(w => w.id === selectedWorkbook);
    const analyzedTypes = {};
    wrongNums.forEach(num => {
      let questionKey = num;
      if (workbook.grade === '고3' && workbook.hasSelection && num >= SELECTION_START) questionKey = num + '_' + studentSelection;
      const questionInfo = workbook.questions[questionKey];
      if (questionInfo && questionInfo.type) analyzedTypes[questionInfo.type] = (analyzedTypes[questionInfo.type] || 0) + 1;
    });
    setLoading(true);
    try {
      // 지점 정보 추가
      await addDoc(collection(db, 'wrongAnswers'), {
        studentId: selectedStudent.id, studentName: selectedStudent.name, workbookId: selectedWorkbook,
        workbookName: workbook.name, wrongQuestions: wrongNums, analyzedTypes,
        selection: workbook.grade === '고3' ? studentSelection : null, date: wrongAnswerDate,
        branch: branch === 'baegot' ? 'baegot' : '',
        createdAt: new Date()
      });
      setSuccess(selectedStudent.name + ' 학생의 오답이 저장되었습니다. (' + wrongNums.length + '문제)');
      setWrongQuestions(''); loadWrongAnswerRecords();
    } catch (err) { setError('오답 저장 중 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  };

  const generateAnalysis = async () => {
    if (!analysisStudent) { setError('분석할 학생을 선택해주세요.'); return; }
    const now = new Date();
    let startDate = analysisPeriod === 'week' ? new Date(now.getTime() - 7*24*60*60*1000) : new Date(now.getFullYear(), now.getMonth(), 1);
    const filteredRecords = wrongAnswerRecords.filter(record => {
      if (record.studentId !== analysisStudent.id) return false;
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= now;
    });
    if (filteredRecords.length === 0) { setError('해당 기간에 오답 기록이 없습니다.'); return; }
    const typeStats = {}; let totalWrong = 0;
    filteredRecords.forEach(record => {
      totalWrong += record.wrongQuestions.length;
      Object.entries(record.analyzedTypes || {}).forEach(([type, count]) => { typeStats[type] = (typeStats[type] || 0) + count; });
    });
    const sortedTypes = Object.entries(typeStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count, percentage: Math.round((count / totalWrong) * 100) }));
    setAnalysisData({ student: analysisStudent, period: analysisPeriod, startDate: startDate.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0], totalRecords: filteredRecords.length, totalWrong, typeStats: sortedTypes, weaknesses: sortedTypes.slice(0, 3), records: filteredRecords });
  };

  const generatePersonalReport = async () => {
    if (!analysisData) { setError('먼저 분석을 생성해주세요.'); return; }
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20; let y = 20;
      pdf.setFontSize(24); pdf.setTextColor(79, 70, 229);
      pdf.text('Weakness Analysis Report', pageWidth / 2, y, { align: 'center' }); y += 15;
      pdf.setFontSize(14); pdf.setTextColor(0, 0, 0);
      pdf.text('Student: ' + analysisData.student.name, margin, y); y += 8;
      pdf.setFontSize(11); pdf.setTextColor(100, 100, 100);
      pdf.text('Period: ' + analysisData.startDate + ' ~ ' + analysisData.endDate, margin, y); y += 6;
      pdf.text('Workbooks: ' + analysisData.totalRecords + ' | Total Wrong: ' + analysisData.totalWrong, margin, y); y += 15;
      pdf.setDrawColor(200, 200, 200); pdf.line(margin, y, pageWidth - margin, y); y += 10;
      pdf.setFontSize(16); pdf.setTextColor(220, 38, 38);
      pdf.text('Weakness TOP 3', margin, y); y += 10;
      analysisData.weaknesses.forEach((w, i) => {
        pdf.setFontSize(12); pdf.setTextColor(0, 0, 0);
        pdf.text((i+1) + '. ' + w.type + ': ' + w.count + ' (' + w.percentage + '%)', margin + 5, y);
        const barWidth = (pageWidth - margin * 2 - 80) * (w.percentage / 100);
        const colors = [[239, 68, 68], [249, 115, 22], [234, 179, 8]];
        pdf.setFillColor(...colors[i]); pdf.rect(margin + 80, y - 4, barWidth, 5, 'F'); y += 10;
      }); y += 10;
      pdf.setFontSize(16); pdf.setTextColor(79, 70, 229);
      pdf.text('Type Distribution', margin, y); y += 10;
      analysisData.typeStats.forEach(stat => {
        pdf.setFontSize(10); pdf.setTextColor(0, 0, 0);
        pdf.text(stat.type, margin + 5, y);
        pdf.text(stat.count + ' (' + stat.percentage + '%)', pageWidth - margin - 40, y);
        const barWidth = (pageWidth - margin * 2 - 100) * (stat.percentage / 100);
        pdf.setFillColor(251, 191, 36); pdf.rect(margin + 35, y - 3, barWidth, 4, 'F'); y += 8;
      });
      y = pdf.internal.pageSize.getHeight() - 15;
      pdf.setFontSize(9); pdf.setTextColor(150, 150, 150);
      pdf.text('Generated: ' + new Date().toLocaleDateString(), pageWidth / 2, y, { align: 'center' });
      pdf.save(analysisData.student.name + '_weakness_' + analysisData.endDate + '.pdf');
      setSuccess('PDF 리포트가 생성되었습니다.');
    } catch (err) { setError('PDF 생성 중 오류가 발생했습니다.'); }
    finally { setIsGeneratingPdf(false); }
  };

  const updateQuestionType = (questionKey, field, value) => {
    setNewWorkbook(prev => ({ ...prev, questions: { ...prev.questions, [questionKey]: { ...prev.questions[questionKey], [field]: value } } }));
  };

  const handleGradeChange = (grade) => { setNewWorkbook(prev => ({ ...prev, grade, hasSelection: grade === '고3' })); };

  useEffect(() => {
    if (error || success) { const timer = setTimeout(() => { setError(''); setSuccess(''); }, 5000); return () => clearTimeout(timer); }
  }, [error, success]);

  const renderQuestionInputs = () => {
    if (!analysisResult) return null;
    const commonQuestions = []; const selectionQuestions = { '화작': [], '언매': [] };
    Object.keys(analysisResult).forEach(key => {
      if (key.includes('_화작')) selectionQuestions['화작'].push(key.replace('_화작', ''));
      else if (key.includes('_언매')) selectionQuestions['언매'].push(key.replace('_언매', ''));
      else commonQuestions.push(key);
    });
    return (
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">문제별 유형 설정</h4>
        {commonQuestions.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-blue-600 mb-2">📘 공통 문제 (1~34번)</h5>
            <div className="max-h-64 overflow-y-auto border rounded-lg p-3 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {commonQuestions.sort((a, b) => Number(a) - Number(b)).map(num => (
                  <div key={num} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="w-8 text-center font-medium text-gray-700">{num}번</span>
                    <select value={newWorkbook.questions[num]?.type || ''} onChange={(e) => updateQuestionType(num, 'type', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm">
                      <option value="">유형 선택</option>
                      {Object.keys(TYPE_CATEGORIES).filter(t => !['화작', '언매'].includes(t)).map(type => (<option key={type} value={type}>{type}</option>))}
                    </select>
                    <select value={newWorkbook.questions[num]?.subType || ''} onChange={(e) => updateQuestionType(num, 'subType', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" disabled={!newWorkbook.questions[num]?.type}>
                      <option value="">세부유형</option>
                      {newWorkbook.questions[num]?.type && TYPE_CATEGORIES[newWorkbook.questions[num].type]?.map(sub => (<option key={sub} value={sub}>{sub}</option>))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {selectionQuestions['화작'].length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-orange-600 mb-2">🔶 선택과목 - 화법과작문 (35~45번)</h5>
            <div className="max-h-48 overflow-y-auto border border-orange-200 rounded-lg p-3 bg-orange-50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {selectionQuestions['화작'].sort((a, b) => Number(a) - Number(b)).map(num => {
                  const key = num + '_화작';
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                      <span className="w-8 text-center font-medium text-orange-700">{num}번</span>
                      <select value={newWorkbook.questions[key]?.subType || ''} onChange={(e) => updateQuestionType(key, 'subType', e.target.value)} className="flex-1 px-2 py-1 border border-orange-300 rounded text-sm">
                        <option value="">세부유형</option>
                        {TYPE_CATEGORIES['화작'].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {selectionQuestions['언매'].length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-pink-600 mb-2">🔷 선택과목 - 언어와매체 (35~45번)</h5>
            <div className="max-h-48 overflow-y-auto border border-pink-200 rounded-lg p-3 bg-pink-50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {selectionQuestions['언매'].sort((a, b) => Number(a) - Number(b)).map(num => {
                  const key = num + '_언매';
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                      <span className="w-8 text-center font-medium text-pink-700">{num}번</span>
                      <select value={newWorkbook.questions[key]?.subType || ''} onChange={(e) => updateQuestionType(key, 'subType', e.target.value)} className="flex-1 px-2 py-1 border border-pink-300 rounded text-sm">
                        <option value="">세부유형</option>
                        {TYPE_CATEGORIES['언매'].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl"><BookOpen className="text-white" size={24} /></div>
          <div><h2 className="text-2xl font-bold text-gray-800">교재 오답 분석</h2><p className="text-gray-500 text-sm">교재별 문제 유형 분석 및 학생 약점 진단</p></div>
        </div>
      </div>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700"><AlertCircle size={20} />{error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700"><CheckCircle size={20} />{success}</div>}
      <div className="flex gap-2 mb-6 border-b pb-4">
        {['workbooks', 'wrongAnswers', 'analysis'].map(tab => (
          <button key={tab} onClick={() => setActiveSubTab(tab)} className={'px-4 py-2 rounded-lg font-medium transition-all ' + (activeSubTab === tab ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {tab === 'workbooks' ? '📚 교재 관리' : tab === 'wrongAnswers' ? '✏️ 오답 입력' : '📊 약점 분석'}
          </button>
        ))}
      </div>

      {activeSubTab === 'workbooks' && (
        <div>
          <button onClick={() => setShowAddWorkbook(!showAddWorkbook)} className="mb-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all"><Plus size={20} />새 교재 등록</button>
          {showAddWorkbook && (
            <div className="mb-6 p-6 bg-amber-50 rounded-xl border border-amber-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📚 새 교재 등록</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">교재명 *</label><input type="text" value={newWorkbook.name} onChange={(e) => setNewWorkbook(prev => ({ ...prev, name: e.target.value }))} placeholder="예: 오늘의 주간지 12월" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">학년</label><select value={newWorkbook.grade} onChange={(e) => handleGradeChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"><option value="고1">고1</option><option value="고2">고2</option><option value="고3">고3</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">총 문항 수</label><input type="number" value={newWorkbook.totalQuestions} onChange={(e) => setNewWorkbook(prev => ({ ...prev, totalQuestions: parseInt(e.target.value) || 45 }))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                {newWorkbook.grade === '고3' && (<div><label className="block text-sm font-medium text-gray-700 mb-1">선택과목 분리</label><select value={newWorkbook.hasSelection ? 'yes' : 'no'} onChange={(e) => setNewWorkbook(prev => ({ ...prev, hasSelection: e.target.value === 'yes' }))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"><option value="yes">예 (35~45번 화작/언매)</option><option value="no">아니오</option></select></div>)}
              </div>
              {newWorkbook.grade === '고3' && newWorkbook.hasSelection && (<div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200"><p className="text-sm text-blue-700">ℹ️ <strong>고3 선택과목:</strong> 35~45번은 화법과작문/언어와매체로 분리 저장됩니다.</p></div>)}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">교재 PDF 업로드</label>
                <div className="flex gap-2">
                  <input type="file" accept=".pdf" onChange={handleFileSelect} className="flex-1 px-3 py-2 border rounded-lg" />
                  <button onClick={analyzeWorkbook} disabled={!uploadedFile || isAnalyzing} className={'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ' + (!uploadedFile || isAnalyzing ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600')}>
                    {isAnalyzing ? <><Loader2 className="animate-spin" size={18} />분석 중...</> : <><Search size={18} />AI 분석</>}
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">AI가 문제 유형을 자동 분류합니다. (약 100원/교재)</p>
              </div>
              {renderQuestionInputs()}
              <div className="flex gap-2">
                <button onClick={saveWorkbook} disabled={loading || !newWorkbook.name} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"><Save size={18} />저장</button>
                <button onClick={() => { setShowAddWorkbook(false); setNewWorkbook({ name: '', grade: '고3', subject: '국어', totalQuestions: 45, questions: {}, hasSelection: true }); setUploadedFile(null); setAnalysisResult(null); }} className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"><X size={18} />취소</button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800">등록된 교재 ({workbooks.length})</h3>
            {workbooks.length === 0 ? <p className="text-gray-500 text-center py-8">등록된 교재가 없습니다.</p> : workbooks.map(workbook => (
              <div key={workbook.id} className="p-4 border rounded-xl hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2"><h4 className="font-bold text-gray-800">{workbook.name}</h4>{workbook.hasSelection && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">선택과목 분리</span>}</div>
                    <p className="text-sm text-gray-500">{workbook.grade} | {workbook.totalQuestions}문항</p>
                    <div className="flex flex-wrap gap-1 mt-2">{Object.entries(Object.values(workbook.questions || {}).reduce((acc, q) => { if (q.type) acc[q.type] = (acc[q.type] || 0) + 1; return acc; }, {})).map(([type, count]) => (<span key={type} className={'text-xs px-2 py-0.5 rounded ' + (TYPE_COLORS[type] || 'bg-gray-100')}>{type}: {count}</span>))}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingWorkbook(editingWorkbook === workbook.id ? null : workbook.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                    <button onClick={() => deleteWorkbook(workbook.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                  </div>
                </div>
                {editingWorkbook === workbook.id && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium text-gray-700 mb-2">문제별 유형</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">{Object.entries(workbook.questions || {}).map(([key, info]) => (<div key={key} className="text-sm p-2 bg-gray-50 rounded"><span className="font-medium">{key.replace('_', ' ')}:</span> <span className={(TYPE_COLORS[info.type] || '') + ' px-1 rounded'}>{info.subType || info.type || '미지정'}</span></div>))}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'wrongAnswers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">✏️ 오답 입력</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">학생 선택 *</label><select value={selectedStudent?.id || ''} onChange={(e) => setSelectedStudent(students.find(s => s.id === e.target.value))} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"><option value="">학생을 선택하세요</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">교재 선택 *</label><select value={selectedWorkbook || ''} onChange={(e) => setSelectedWorkbook(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"><option value="">교재를 선택하세요</option>{workbooks.map(w => <option key={w.id} value={w.id}>{w.name} ({w.grade})</option>)}</select></div>
              {selectedWorkbook && (() => { const wb = workbooks.find(w => w.id === selectedWorkbook); return wb?.grade === '고3' && wb?.hasSelection; })() && (
                <div><label className="block text-sm font-medium text-gray-700 mb-1">학생 선택과목 *</label>
                  <div className="flex gap-2">
                    <button onClick={() => setStudentSelection('화작')} className={'flex-1 py-2 rounded-lg font-medium transition-all ' + (studentSelection === '화작' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200')}>🔶 화법과작문</button>
                    <button onClick={() => setStudentSelection('언매')} className={'flex-1 py-2 rounded-lg font-medium transition-all ' + (studentSelection === '언매' ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-700 hover:bg-pink-200')}>🔷 언어와매체</button>
                  </div>
                </div>
              )}
              <div><label className="block text-sm font-medium text-gray-700 mb-1">날짜</label><input type="date" value={wrongAnswerDate} onChange={(e) => setWrongAnswerDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">틀린 문제 번호 *</label><input type="text" value={wrongQuestions} onChange={(e) => setWrongQuestions(e.target.value)} placeholder="예: 1, 3, 5-7, 10, 35" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500" /><p className="mt-1 text-sm text-gray-500">쉼표, 공백, 범위(5-7) 모두 가능</p></div>
              <button onClick={saveWrongAnswers} disabled={loading || !selectedStudent || !selectedWorkbook || !wrongQuestions} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"><Save size={20} />오답 저장</button>
            </div>
          </div>
          <div className="p-6 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📋 최근 오답 기록</h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {wrongAnswerRecords.slice(0, 20).map(record => (
                <div key={record.id} className="p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div><span className="font-medium">{record.studentName}</span><span className="text-gray-500 text-sm ml-2">{record.date}</span>{record.selection && <span className={'ml-2 text-xs px-2 py-0.5 rounded ' + (record.selection === '화작' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700')}>{record.selection}</span>}</div>
                    <span className="text-red-500 font-medium">{record.wrongQuestions?.length || 0}문제</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{record.workbookName}</p>
                  <div className="flex flex-wrap gap-1 mt-2">{Object.entries(record.analyzedTypes || {}).map(([type, count]) => (<span key={type} className={'text-xs px-2 py-0.5 rounded ' + (TYPE_COLORS[type] || 'bg-gray-100')}>{type}: {count}</span>))}</div>
                </div>
              ))}
              {wrongAnswerRecords.length === 0 && <p className="text-gray-500 text-center py-8">오답 기록이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'analysis' && (
        <div>
          <div className="mb-6 p-6 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 약점 분석</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">학생 선택</label><select value={analysisStudent?.id || ''} onChange={(e) => setAnalysisStudent(students.find(s => s.id === e.target.value))} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"><option value="">학생을 선택하세요</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">분석 기간</label><select value={analysisPeriod} onChange={(e) => setAnalysisPeriod(e.target.value)} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500"><option value="week">최근 1주일</option><option value="month">이번 달</option></select></div>
              <button onClick={generateAnalysis} disabled={!analysisStudent} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"><BarChart3 size={20} />분석 생성</button>
              {analysisData && (<button onClick={generatePersonalReport} disabled={isGeneratingPdf} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50">{isGeneratingPdf ? <Loader2 className="animate-spin" size={20} /> : <FileDown size={20} />}PDF 리포트</button>)}
            </div>
          </div>
          {analysisData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl"><div className="flex items-center gap-2 text-blue-600 mb-2"><User size={20} /><span className="font-medium">학생</span></div><p className="text-2xl font-bold text-blue-800">{analysisData.student.name}</p></div>
                <div className="p-4 bg-purple-50 rounded-xl"><div className="flex items-center gap-2 text-purple-600 mb-2"><Calendar size={20} /><span className="font-medium">분석 기간</span></div><p className="text-lg font-bold text-purple-800">{analysisData.startDate} ~ {analysisData.endDate}</p></div>
                <div className="p-4 bg-orange-50 rounded-xl"><div className="flex items-center gap-2 text-orange-600 mb-2"><FileText size={20} /><span className="font-medium">분석 교재</span></div><p className="text-2xl font-bold text-orange-800">{analysisData.totalRecords}권</p></div>
                <div className="p-4 bg-red-50 rounded-xl"><div className="flex items-center gap-2 text-red-600 mb-2"><Target size={20} /><span className="font-medium">총 오답</span></div><p className="text-2xl font-bold text-red-800">{analysisData.totalWrong}문제</p></div>
              </div>
              <div className="p-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200">
                <h4 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2"><AlertCircle size={20} />약점 유형 TOP 3</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysisData.weaknesses.map((w, i) => (
                    <div key={w.type} className="p-4 bg-white rounded-xl shadow">
                      <div className="flex items-center gap-2 mb-2"><span className={'w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ' + (i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-500')}>{i + 1}</span><span className={(TYPE_COLORS[w.type] || '') + ' font-medium px-2 py-1 rounded'}>{w.type}</span></div>
                      <p className="text-gray-600">{w.count}문제 ({w.percentage}%)</p>
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={'h-full ' + (i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-500')} style={{ width: w.percentage + '%' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-white rounded-xl border">
                <h4 className="text-lg font-bold text-gray-800 mb-4">📈 유형별 오답 분포</h4>
                <div className="space-y-3">
                  {analysisData.typeStats.map(stat => (
                    <div key={stat.type} className="flex items-center gap-4">
                      <span className={(TYPE_COLORS[stat.type] || '') + ' w-24 text-sm font-medium px-2 py-1 rounded text-center'}>{stat.type}</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: stat.percentage + '%' }} /></div>
                      <span className="w-24 text-right text-gray-600">{stat.count}문제 ({stat.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                <h4 className="text-lg font-bold text-indigo-800 mb-3">💡 학습 피드백</h4>
                <div className="space-y-2 text-indigo-700">
                  {analysisData.weaknesses[0] && <p>• <strong>{analysisData.weaknesses[0].type}</strong> 유형에서 가장 많은 오답이 발생했습니다. 해당 유형을 집중 학습하세요.</p>}
                  {analysisData.weaknesses.some(w => w.type.startsWith('독서-')) && <p>• 독서 영역 약점: 지문 구조 파악과 핵심 정보 추출 연습을 권장합니다.</p>}
                  {analysisData.weaknesses.some(w => w.type.startsWith('문학-')) && <p>• 문학 영역 약점: 작품의 주제와 표현 기법 분석 연습이 필요합니다.</p>}
                  {analysisData.weaknesses.some(w => w.type.includes('보기')) && <p>• 보기 문제 약점: 보기 내용과 지문 연결 연습을 강화하세요.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500"><BarChart3 size={48} className="mx-auto mb-4 opacity-30" /><p>학생을 선택하고 분석을 생성해주세요.</p></div>
          )}
        </div>
      )}
    </div>
  );
}
