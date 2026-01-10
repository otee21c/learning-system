import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { getMonthRoundFromSchedules } from '../../utils/dateUtils';
import { Plus, Send, Trash2, Edit2, X, ChevronDown, ChevronRight, FileText, Eye, Image } from 'lucide-react';

// SMS 발송 함수
const sendSMS = async (phoneNumber, message) => {
  try {
    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        key: import.meta.env.VITE_ALIGO_API_KEY,
        user_id: import.meta.env.VITE_ALIGO_USER_ID,
        sender: import.meta.env.VITE_ALIGO_SENDER,
        receiver: phoneNumber,
        msg: message,
        testmode_yn: 'N'
      })
    });
    const data = await response.json();
    return data.result_code === '1';
  } catch (error) {
    console.error('SMS 발송 오류:', error);
    return false;
  }
};

// 지각 여부 체크
const isLateSubmission = (dueDate, submittedAt) => {
  if (!dueDate || !submittedAt) return false;
  const deadline = new Date(dueDate);
  deadline.setHours(23, 59, 59, 999);
  let submitTime = submittedAt.seconds ? new Date(submittedAt.seconds * 1000) : new Date(submittedAt);
  return submitTime > deadline;
};

// 과제 유형 정의
const HOMEWORK_TYPES = {
  training: { label: '🏋️ 훈련과제', color: 'bg-blue-100 text-blue-700' },
  weekly: { label: '📚 주간지', color: 'bg-green-100 text-green-700' },
  review: { label: '📝 복습', color: 'bg-purple-100 text-purple-700' },
  other: { label: '📖 기타', color: 'bg-gray-100 text-gray-700' }
};

// 과제 코드 목록
const TASK_CODES = { numbers: ['1', '2', '3', '4', '5'], letters: ['a', 'b', 'c', 'd', 'e'] };

const HomeworkManager = ({ students: propStudents = [], branch, schedules = [] }) => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState(propStudents);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [viewMode, setViewMode] = useState('assignments');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [roundFilter, setRoundFilter] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', dueDate: '', taskCode: '', homeworkType: 'training', sendToStudent: true, sendToParent: true
  });
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [overviewMonth, setOverviewMonth] = useState(new Date().getMonth() + 1);
  const [overviewRound, setOverviewRound] = useState(1);
  const [selectedTaskCode, setSelectedTaskCode] = useState('');
  const [sendToStudentBulk, setSendToStudentBulk] = useState(true);
  const [sendToParentBulk, setSendToParentBulk] = useState(true);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [collapsedRounds, setCollapsedRounds] = useState({});

  useEffect(() => { setStudents(propStudents); }, [propStudents]);
  useEffect(() => { loadAssignments(); loadAllSubmissions(); }, [branch]);

  const loadAssignments = async () => {
    try {
      const q = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (branch) list = list.filter(a => !a.branch || a.branch === branch);
      setAssignments(list);
    } catch (error) { console.error('과제 불러오기 실패:', error); }
  };

  const loadAllSubmissions = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'homeworkSubmissions'));
      let list = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      if (branch) list = list.filter(s => !s.branch || s.branch === branch);
      setAllSubmissions(list);
    } catch (error) { console.error('전체 제출 현황 불러오기 실패:', error); }
  };

  const loadSubmissions = async (assignmentId) => {
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) { setSubmissions([]); return; }
      
      // 과제의 월/차수를 schedules 기준으로 계산
      let assignMonth, assignRound;
      if (assignment.dueDate && schedules.length > 0) {
        const calc = getMonthRoundFromSchedules(assignment.dueDate, schedules);
        assignMonth = calc.month;
        assignRound = calc.round || assignment.round || assignment.week || 1;
      } else {
        assignMonth = assignment.month;
        assignRound = assignment.round || assignment.week || 1;
      }
      
      const q = query(collection(db, 'homeworkSubmissions'), orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);
      const allSubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // 매칭 조건: ID 직접 매칭 또는 taskCode+월/차수 매칭
      const filtered = allSubs.filter(sub => {
        // 1. 직접 ID 매칭
        if (sub.homeworkId === assignmentId || sub.assignmentId === assignmentId) return true;
        
        // 2. taskCode + 월/차수 매칭
        if (assignment.taskCode && sub.taskCode === assignment.taskCode) {
          const subRound = sub.round || sub.week;
          if (sub.month === assignMonth && subRound === assignRound) return true;
        }
        
        return false;
      });
      
      console.log('과제:', assignment.title, '월/차수:', assignMonth, assignRound, '제출물:', filtered.length);
      setSubmissions(filtered);
    } catch (error) { console.error('제출 기록 불러오기 실패:', error); }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.dueDate) { alert('제목과 마감일을 입력하세요!'); return; }
    try {
      const { month, round } = getMonthRoundFromSchedules(formData.dueDate, schedules);
      await addDoc(collection(db, 'assignments'), { ...formData, month, round, branch: branch || '', createdAt: serverTimestamp(), status: 'active' });
      alert('과제가 생성되었습니다!');
      resetForm(); loadAssignments();
    } catch (error) { alert('과제 생성 실패: ' + error.message); }
  };

  const handleUpdateAssignment = async (e) => {
    e.preventDefault();
    if (!editingAssignment) return;
    try {
      const { month, round } = getMonthRoundFromSchedules(formData.dueDate, schedules);
      await updateDoc(doc(db, 'assignments', editingAssignment.id), { ...formData, month, round, updatedAt: serverTimestamp() });
      alert('과제가 수정되었습니다!');
      resetForm(); loadAssignments();
    } catch (error) { alert('과제 수정 실패: ' + error.message); }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const q = query(collection(db, 'homeworkSubmissions'), where('assignmentId', '==', assignmentId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'assignments', assignmentId));
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      if (selectedAssignment?.id === assignmentId) setSelectedAssignment(null);
      alert('삭제되었습니다.');
    } catch (error) { alert('삭제 실패'); }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', dueDate: '', taskCode: '', homeworkType: 'training', sendToStudent: true, sendToParent: true });
    setShowCreateForm(false); setEditingAssignment(null);
  };

  const startEditing = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      title: assignment.title || '', description: assignment.description || '', dueDate: assignment.dueDate || '',
      taskCode: assignment.taskCode || '', homeworkType: assignment.homeworkType || 'training',
      sendToStudent: assignment.sendToStudent ?? true, sendToParent: assignment.sendToParent ?? true
    });
    setShowCreateForm(true);
  };

  const selectAssignment = (assignment) => { setSelectedAssignment(assignment); loadSubmissions(assignment.id); };

  // 과제의 월/차수를 schedules 기준으로 계산
  const getAssignmentMonthRound = (assignment) => {
    // dueDate가 있으면 schedules에서 찾기
    if (assignment.dueDate && schedules.length > 0) {
      const { month, round } = getMonthRoundFromSchedules(assignment.dueDate, schedules);
      if (round) return { month, round };
    }
    // 저장된 값 사용
    return { 
      month: assignment.month || new Date().getMonth() + 1, 
      round: assignment.round || assignment.week || 1 
    };
  };

  const getFilteredAssignments = () => {
    return assignments.filter(a => {
      // 유형 필터: 'all'이면 전체 (기존 과제는 homeworkType 없으면 모두 표시)
      if (typeFilter !== 'all') {
        const assignmentType = a.homeworkType || null;
        // homeworkType이 없는 기존 과제는 '전체'에서만 보임
        if (assignmentType !== typeFilter) return false;
      }
      
      // 월/차수는 schedules 기준으로 계산
      const { month, round } = getAssignmentMonthRound(a);
      if (monthFilter && month !== monthFilter) return false;
      if (roundFilter > 0 && round !== roundFilter) return false;
      return true;
    });
  };

  const getGroupedAssignments = () => {
    const filtered = getFilteredAssignments();
    const grouped = {};
    filtered.forEach(a => {
      const { month, round } = getAssignmentMonthRound(a);
      const key = `${month}월 ${round}차`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const [aM, aR] = a.match(/\d+/g).map(Number);
      const [bM, bR] = b.match(/\d+/g).map(Number);
      return bM !== aM ? bM - aM : bR - aR;
    });
    return { grouped, sortedKeys };
  };

  const toggleRoundCollapse = (key) => setCollapsedRounds(prev => ({ ...prev, [key]: !prev[key] }));

  const hasTaskCodeInOverview = (studentId, taskCode) => {
    return allSubmissions.some(s => s.studentId === studentId && s.month === overviewMonth && (s.round === overviewRound || s.week === overviewRound) && s.taskCode === taskCode);
  };

  const toggleTaskCodeInOverview = async (studentId, taskCode) => {
    try {
      const existing = allSubmissions.find(s => s.studentId === studentId && s.month === overviewMonth && (s.round === overviewRound || s.week === overviewRound) && s.taskCode === taskCode);
      if (existing) {
        await deleteDoc(doc(db, 'homeworkSubmissions', existing.docId));
        setAllSubmissions(prev => prev.filter(s => s.docId !== existing.docId));
      } else {
        const student = students.find(s => s.id === studentId);
        const newSub = { studentId, studentName: student?.name || '', month: overviewMonth, round: overviewRound, taskCode, submitted: true, submittedAt: serverTimestamp(), branch: branch || '' };
        const docRef = await addDoc(collection(db, 'homeworkSubmissions'), newSub);
        setAllSubmissions(prev => [...prev, { docId: docRef.id, ...newSub }]);
      }
    } catch (error) { console.error('토글 실패:', error); }
  };

  const getNotSubmittedStudents = (taskCode) => taskCode ? students.filter(s => !hasTaskCodeInOverview(s.id, taskCode)) : [];

  const sendBulkNotSubmittedSMS = async () => {
    if (!selectedTaskCode) { alert('과제 코드를 선택해주세요.'); return; }
    const notSubmitted = getNotSubmittedStudents(selectedTaskCode);
    if (notSubmitted.length === 0) { alert('미제출자가 없습니다.'); return; }
    if (!sendToStudentBulk && !sendToParentBulk) { alert('발송 대상을 선택해주세요.'); return; }
    const assignment = assignments.find(a => a.taskCode === selectedTaskCode);
    const taskName = assignment?.title || `${selectedTaskCode}번 과제`;
    if (!window.confirm(`미제출자 ${notSubmitted.length}명에게 문자를 발송하시겠습니까?`)) return;
    setSendingBulk(true);
    let success = 0, fail = 0;
    for (const student of notSubmitted) {
      const msg = `안녕하세요. 오늘의 국어입니다.\n${student.name} 학생의 '${taskName}' 과제가 아직 제출되지 않았습니다.\n확인 부탁드립니다.`;
      if (sendToStudentBulk && student.phone) { if (await sendSMS(student.phone, msg)) success++; else fail++; }
      if (sendToParentBulk && student.parentPhone) { if (await sendSMS(student.parentPhone, msg)) success++; else fail++; }
    }
    setSendingBulk(false);
    alert(`발송 완료! 성공: ${success}, 실패: ${fail}`);
  };

  const handleSendNotification = async (assignment) => {
    if (selectedStudents.length === 0) { alert('학생을 선택해주세요.'); return; }
    if (!window.confirm(`${selectedStudents.length}명에게 알림을 발송하시겠습니까?`)) return;
    let success = 0, fail = 0;
    for (const student of students.filter(s => selectedStudents.includes(s.id))) {
      const msg = `[오늘의 국어] ${student.name} 학생\n'${assignment.title}' 과제가 등록되었습니다.\n마감: ${assignment.dueDate}`;
      if (assignment.sendToStudent && student.phone) { if (await sendSMS(student.phone, msg)) success++; else fail++; }
      if (assignment.sendToParent && student.parentPhone) { if (await sendSMS(student.parentPhone, msg)) success++; else fail++; }
    }
    alert(`발송 완료! 성공: ${success}, 실패: ${fail}`);
    setSelectedStudents([]);
  };

  const handleManualStatusChange = async (studentId, studentName, status) => {
    if (!selectedAssignment) return;
    try {
      const existing = submissions.find(sub => sub.studentId === studentId || sub.studentName === studentName);
      if (existing) {
        await updateDoc(doc(db, 'homeworkSubmissions', existing.id), { manualStatus: status, updatedAt: serverTimestamp() });
      } else {
        const { month, round } = getMonthRoundFromSchedules(selectedAssignment.dueDate, schedules);
        await addDoc(collection(db, 'homeworkSubmissions'), { homeworkId: selectedAssignment.id, studentId, studentName, month, round, manualStatus: status, submitted: false, submittedAt: serverTimestamp() });
      }
      loadSubmissions(selectedAssignment.id);
    } catch (error) { console.error('상태 변경 실패:', error); }
  };

  const toggleStudentSelection = (id) => setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllStudents = () => setSelectedStudents(selectedStudents.length === students.length ? [] : students.map(s => s.id));

  const { grouped, sortedKeys } = getGroupedAssignments();

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">과제 관리</h2>
              <p className="text-gray-500 text-sm">과제 생성, 제출 확인, 미제출자 알림</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setViewMode('assignments')} className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'assignments' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              📋 과제 목록
            </button>
            <button onClick={() => setViewMode('overview')} className={`px-4 py-2 rounded-lg font-medium transition ${viewMode === 'overview' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              📊 전체 현황표
            </button>
          </div>
        </div>
        {viewMode === 'assignments' && (
          <button onClick={() => { resetForm(); setShowCreateForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg transition">
            <Plus size={20} />새 과제
          </button>
        )}
      </div>

      {/* 과제 생성/수정 모달 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingAssignment ? '📝 과제 수정' : '➕ 새 과제 만들기'}</h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={editingAssignment ? handleUpdateAssignment : handleCreateAssignment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">과제 유형 *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(HOMEWORK_TYPES).map(([key, { label, color }]) => (
                    <button key={key} type="button" onClick={() => setFormData(prev => ({ ...prev, homeworkType: key }))}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition ${formData.homeworkType === key ? color + ' border-current' : 'bg-white border-gray-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">과제 제목 *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="예: 훈련과제_1월 2차_3일차" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">마감일 *</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">과제 코드</label>
                <select value={formData.taskCode} onChange={(e) => setFormData(prev => ({ ...prev, taskCode: e.target.value }))} className="w-full px-4 py-2 border rounded-lg">
                  <option value="">선택 안함</option>
                  <optgroup label="숫자형">{TASK_CODES.numbers.map(c => <option key={c} value={c}>{c}번</option>)}</optgroup>
                  <optgroup label="알파벳형">{TASK_CODES.letters.map(c => <option key={c} value={c}>{c}번</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">📱 알림 대상</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.sendToStudent} onChange={(e) => setFormData(prev => ({ ...prev, sendToStudent: e.target.checked }))} /><span className="text-sm">학생</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.sendToParent} onChange={(e) => setFormData(prev => ({ ...prev, sendToParent: e.target.checked }))} /><span className="text-sm">학부모</span></label>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-bold">{editingAssignment ? '수정 완료' : '과제 생성'}</button>
                <button type="button" onClick={resetForm} className="px-6 py-3 bg-gray-200 rounded-lg">취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 전체 현황표 */}
      {viewMode === 'overview' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <h3 className="text-lg font-bold">학생별 과제 제출 현황</h3>
            <select value={overviewMonth} onChange={(e) => setOverviewMonth(Number(e.target.value))} className="px-3 py-2 border rounded-lg">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select value={overviewRound} onChange={(e) => setOverviewRound(Number(e.target.value))} className="px-3 py-2 border rounded-lg">
              {[1,2,3,4,5].map(r => <option key={r} value={r}>{r}차</option>)}
            </select>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h4 className="font-bold text-orange-800 mb-3">📱 미제출자 알림 발송</h4>
            <div className="flex flex-wrap items-center gap-4">
              <select value={selectedTaskCode} onChange={(e) => setSelectedTaskCode(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                <option value="">과제 코드</option>
                <optgroup label="숫자형">{TASK_CODES.numbers.map(c => <option key={c} value={c}>{c}번</option>)}</optgroup>
                <optgroup label="알파벳형">{TASK_CODES.letters.map(c => <option key={c} value={c}>{c}번</option>)}</optgroup>
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={sendToStudentBulk} onChange={(e) => setSendToStudentBulk(e.target.checked)} /><span className="text-sm">학생</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={sendToParentBulk} onChange={(e) => setSendToParentBulk(e.target.checked)} /><span className="text-sm">학부모</span></label>
              <button onClick={sendBulkNotSubmittedSMS} disabled={sendingBulk || !selectedTaskCode} className={`px-4 py-2 rounded-lg text-sm font-bold ${sendingBulk || !selectedTaskCode ? 'bg-gray-300' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                {sendingBulk ? '발송 중...' : '📤 알림 발송'}
              </button>
              {selectedTaskCode && <span className="text-sm text-orange-700 font-medium">미제출: {getNotSubmittedStudents(selectedTaskCode).length}명</span>}
            </div>
            {selectedTaskCode && getNotSubmittedStudents(selectedTaskCode).length > 0 && (
              <div className="mt-3 p-3 bg-white rounded border">
                <div className="flex flex-wrap gap-2">
                  {getNotSubmittedStudents(selectedTaskCode).map(s => <span key={s.id} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">{s.name}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left sticky left-0 bg-gray-100">학생</th>
                  <th className="border px-2 py-2 text-center bg-blue-50" colSpan={5}>숫자형</th>
                  <th className="border px-2 py-2 text-center bg-green-50" colSpan={5}>알파벳형</th>
                </tr>
                <tr className="bg-gray-50">
                  <th className="border px-3 py-2 sticky left-0 bg-gray-50">이름</th>
                  {TASK_CODES.numbers.map(c => <th key={c} className="border px-2 py-1 text-center text-xs bg-blue-50">{c}</th>)}
                  {TASK_CODES.letters.map(c => <th key={c} className="border px-2 py-1 text-center text-xs bg-green-50">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border px-3 py-2 font-medium sticky left-0 bg-inherit">{student.name} <span className="text-xs text-gray-500">{student.grade}</span></td>
                    {TASK_CODES.numbers.map(code => (
                      <td key={code} className="border px-1 py-1 text-center">
                        <button onClick={() => toggleTaskCodeInOverview(student.id, code)} className={`w-6 h-6 rounded text-xs font-bold ${hasTaskCodeInOverview(student.id, code) ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                          {hasTaskCodeInOverview(student.id, code) ? '✓' : ''}
                        </button>
                      </td>
                    ))}
                    {TASK_CODES.letters.map(code => (
                      <td key={code} className="border px-1 py-1 text-center">
                        <button onClick={() => toggleTaskCodeInOverview(student.id, code)} className={`w-6 h-6 rounded text-xs font-bold ${hasTaskCodeInOverview(student.id, code) ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                          {hasTaskCodeInOverview(student.id, code) ? '✓' : ''}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 과제 목록 - 2단 레이아웃 */}
      {viewMode === 'assignments' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* 필터 */}
          <div className="flex flex-wrap gap-3 mb-6 pb-4 border-b">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${typeFilter === 'all' ? 'bg-white shadow' : ''}`}>전체</button>
              {Object.entries(HOMEWORK_TYPES).map(([key, { label }]) => (
                <button key={key} onClick={() => setTypeFilter(key)} className={`px-3 py-1.5 rounded-md text-sm font-medium ${typeFilter === key ? 'bg-white shadow' : ''}`}>{label.split(' ')[0]}</button>
              ))}
            </div>
            <select value={monthFilter} onChange={(e) => setMonthFilter(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select value={roundFilter} onChange={(e) => setRoundFilter(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
              <option value={0}>전체 차수</option>
              {[1,2,3,4,5].map(r => <option key={r} value={r}>{r}차</option>)}
            </select>
          </div>

          {/* 2단 레이아웃 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽: 과제 목록 */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b"><h3 className="font-bold text-gray-800">📁 과제 목록 ({getFilteredAssignments().length})</h3></div>
              <div className="max-h-[600px] overflow-y-auto">
                {sortedKeys.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">과제가 없습니다.</p>
                ) : (
                  sortedKeys.map(roundKey => (
                    <div key={roundKey}>
                      <button onClick={() => toggleRoundCollapse(roundKey)} className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200">
                        <span className="font-medium text-gray-700">
                          {collapsedRounds[roundKey] ? <ChevronRight size={16} className="inline mr-1" /> : <ChevronDown size={16} className="inline mr-1" />}
                          {roundKey} ({grouped[roundKey].length}개)
                        </span>
                      </button>
                      {!collapsedRounds[roundKey] && grouped[roundKey].map(assignment => {
                        const isSelected = selectedAssignment?.id === assignment.id;
                        const deadline = new Date(assignment.dueDate); deadline.setHours(23, 59, 59, 999);
                        const isPastDue = new Date() > deadline;
                        const typeInfo = HOMEWORK_TYPES[assignment.homeworkType] || HOMEWORK_TYPES.other;
                        return (
                          <div key={assignment.id} onClick={() => selectAssignment(assignment)}
                            className={`p-4 border-b cursor-pointer transition ${isSelected ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>{typeInfo.label.split(' ')[0]}</span>
                                  {assignment.taskCode && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">코드: {assignment.taskCode}</span>}
                                  <span className={`px-2 py-0.5 rounded text-xs ${isPastDue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{isPastDue ? '마감됨' : '진행중'}</span>
                                </div>
                                <h4 className="font-medium text-gray-800 truncate">{assignment.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">📅 {assignment.dueDate}</p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={(e) => { e.stopPropagation(); startEditing(assignment); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="수정"><Edit2 size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteAssignment(assignment.id); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="삭제"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 오른쪽: 제출물 보기 */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-bold text-gray-800">📸 {selectedAssignment ? selectedAssignment.title : '과제를 선택하세요'}</h3>
              </div>
              {selectedAssignment ? (
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-2">{selectedAssignment.description || '설명 없음'}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-white rounded">📅 마감: {selectedAssignment.dueDate}</span>
                      {selectedAssignment.taskCode && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">코드: {selectedAssignment.taskCode}</span>}
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-emerald-800">📱 알림 발송</span>
                      <button onClick={() => handleSendNotification(selectedAssignment)} disabled={selectedStudents.length === 0} className="px-3 py-1 bg-emerald-500 text-white text-sm rounded hover:bg-emerald-600 disabled:opacity-50">
                        <Send size={14} className="inline mr-1" />발송 ({selectedStudents.length})
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedStudents.length === students.length} onChange={toggleAllStudents} />전체 선택</label>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-3 py-2 text-left">선택</th>
                          <th className="px-3 py-2 text-left">학생</th>
                          <th className="px-3 py-2 text-center">제출</th>
                          <th className="px-3 py-2 text-center">확인</th>
                          <th className="px-3 py-2 text-center">이미지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(student => {
                          const submission = submissions.find(s => s.studentId === student.id || s.studentName === student.name);
                          const hasSubmitted = submission?.submitted || submission?.imageUrl;
                          const isLate = hasSubmitted && isLateSubmission(selectedAssignment.dueDate, submission?.submittedAt);
                          return (
                            <tr key={student.id} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-2"><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudentSelection(student.id)} /></td>
                              <td className="px-3 py-2 font-medium">{student.name}</td>
                              <td className="px-3 py-2 text-center">
                                {hasSubmitted ? <span className={`px-2 py-0.5 rounded text-xs ${isLate ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{isLate ? '⏰지각' : '✅완료'}</span> : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">미제출</span>}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <select value={submission?.manualStatus || ''} onChange={(e) => handleManualStatusChange(student.id, student.name, e.target.value)} className="text-xs border rounded px-2 py-1">
                                  <option value="">-</option>
                                  <option value="확인완료">확인완료</option>
                                  <option value="확인예정">확인예정</option>
                                </select>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {submission?.imageUrl ? <a href={submission.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600"><Image size={16} className="inline" /></a> : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {submissions.filter(s => s.imageUrl).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-3">🖼️ 제출 이미지</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {submissions.filter(s => s.imageUrl).map(sub => (
                          <div key={sub.id} className="relative group">
                            <a href={sub.imageUrl} target="_blank" rel="noopener noreferrer">
                              <img src={sub.imageUrl} alt={sub.studentName} className="w-full h-32 object-cover rounded-lg border" />
                            </a>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 rounded-b-lg">
                              {sub.studentName}
                              {isLateSubmission(selectedAssignment.dueDate, sub.submittedAt) && <span className="ml-1 text-yellow-300">⏰</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Eye size={48} className="mb-3 opacity-50" />
                  <p>왼쪽에서 과제를 선택하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeworkManager;
