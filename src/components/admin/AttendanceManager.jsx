import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Calendar, Settings, Users, Save, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const AttendanceManager = ({ students: propStudents = [], branch }) => {
  const [students, setStudents] = useState(propStudents);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayAttendance, setTodayAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  
  // 차수 일정 설정 관련 상태
  const [activeSubTab, setActiveSubTab] = useState('attendance'); // 'attendance' | 'schedule'
  const [schedules, setSchedules] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    month: new Date().getMonth() + 1,
    round: 1,
    startDate: '',
    endDate: ''
  });

  // props로 받은 학생 목록이 변경되면 업데이트
  useEffect(() => {
    setStudents(propStudents);
  }, [propStudents]);

  useEffect(() => {
    if (selectedDate) {
      loadAttendanceForDate(selectedDate);
    }
  }, [selectedDate]);

  // 차수 일정 로드
  useEffect(() => {
    loadSchedules();
  }, [branch, selectedYear]);

  const loadSchedules = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'roundSchedules'));
      let scheduleList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 지점별 필터링
      const currentBranch = branch || 'gwangjin';
      scheduleList = scheduleList.filter(s => {
        const scheduleBranch = s.branch || 'gwangjin';
        return scheduleBranch === currentBranch;
      });
      
      // 연도별 필터링
      scheduleList = scheduleList.filter(s => s.year === selectedYear);
      
      // 월, 차수 순으로 정렬
      scheduleList.sort((a, b) => {
        if (a.month !== b.month) return a.month - b.month;
        return a.round - b.round;
      });
      
      setSchedules(scheduleList);
    } catch (error) {
      console.error('차수 일정 로드 실패:', error);
    }
  };

  const loadAttendanceForDate = async (date) => {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('date', '==', date)
      );
      const snapshot = await getDocs(q);
      const records = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        records[data.studentId] = {
          id: doc.id,
          status: data.status,
          note: data.note || ''
        };
      });
      setTodayAttendance(records);
    } catch (error) {
      console.error('출석 기록 로드 실패:', error);
    }
  };

  // 날짜로 월-차수 찾기 (새 시스템)
  const getMonthRound = (dateStr) => {
    const date = new Date(dateStr);
    
    // 먼저 차수 일정에서 찾기
    for (const schedule of schedules) {
      const start = new Date(schedule.startDate);
      const end = new Date(schedule.endDate);
      end.setHours(23, 59, 59); // 종료일 포함
      
      if (date >= start && date <= end) {
        return { month: schedule.month, round: schedule.round };
      }
    }
    
    // 차수 일정에 없으면 기본값 (해당 날짜의 월, 1차)
    return { month: date.getMonth() + 1, round: null };
  };

  // 토글 기능: 같은 버튼 다시 누르면 선택 해제
  const handleStatusChange = (studentId, status) => {
    setTodayAttendance(prev => {
      const current = prev[studentId];
      
      if (current?.status === status) {
        return {
          ...prev,
          [studentId]: {
            ...current,
            status: null
          }
        };
      }
      
      return {
        ...prev,
        [studentId]: {
          ...current,
          status
        }
      };
    });
  };

  const handleNoteChange = (studentId, note) => {
    setTodayAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        note
      }
    }));
  };

  const handleSaveAttendance = async () => {
    setLoading(true);
    try {
      const { month, round } = getMonthRound(selectedDate);
      
      for (const student of students) {
        const attendance = todayAttendance[student.id];
        
        if (!attendance || !attendance.status) {
          if (attendance?.id) {
            await deleteDoc(doc(db, 'attendance', attendance.id));
          }
          continue;
        }

        const attendanceData = {
          studentId: student.id,
          studentName: student.name,
          date: selectedDate,
          month: month,
          round: round, // week 대신 round 사용
          status: attendance.status,
          note: attendance.note || '',
          branch: branch || 'gwangjin',
          timestamp: new Date()
        };

        if (attendance.id) {
          await updateDoc(doc(db, 'attendance', attendance.id), attendanceData);
        } else {
          await addDoc(collection(db, 'attendance'), attendanceData);
        }
      }
      alert('출석이 저장되었습니다.');
      loadAttendanceForDate(selectedDate);
    } catch (error) {
      console.error('출석 저장 실패:', error);
      alert('출석 저장에 실패했습니다.');
    }
    setLoading(false);
  };

  // 차수 일정 저장
  const handleSaveSchedule = async () => {
    if (!newSchedule.startDate || !newSchedule.endDate) {
      alert('시작일과 종료일을 모두 입력해주세요.');
      return;
    }

    // 중복 체크
    const duplicate = schedules.find(s => 
      s.month === newSchedule.month && 
      s.round === newSchedule.round &&
      s.id !== editingSchedule?.id
    );
    if (duplicate) {
      alert(`${newSchedule.month}월 ${newSchedule.round}차 일정이 이미 존재합니다.`);
      return;
    }

    setLoading(true);
    try {
      const scheduleData = {
        year: selectedYear,
        month: newSchedule.month,
        round: newSchedule.round,
        startDate: newSchedule.startDate,
        endDate: newSchedule.endDate,
        branch: branch || 'gwangjin',
        updatedAt: new Date()
      };

      if (editingSchedule) {
        await updateDoc(doc(db, 'roundSchedules', editingSchedule.id), scheduleData);
        alert('차수 일정이 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'roundSchedules'), {
          ...scheduleData,
          createdAt: new Date()
        });
        alert('차수 일정이 추가되었습니다.');
      }

      setShowAddForm(false);
      setEditingSchedule(null);
      setNewSchedule({ month: selectedMonth, round: 1, startDate: '', endDate: '' });
      loadSchedules();
    } catch (error) {
      console.error('차수 일정 저장 실패:', error);
      alert('차수 일정 저장에 실패했습니다.');
    }
    setLoading(false);
  };

  // 차수 일정 삭제
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('이 차수 일정을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'roundSchedules', scheduleId));
      alert('차수 일정이 삭제되었습니다.');
      loadSchedules();
    } catch (error) {
      console.error('차수 일정 삭제 실패:', error);
      alert('차수 일정 삭제에 실패했습니다.');
    }
  };

  // 차수 일정 수정 시작
  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      month: schedule.month,
      round: schedule.round,
      startDate: schedule.startDate,
      endDate: schedule.endDate
    });
    setShowAddForm(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '출석': return '#10b981';
      case '지각': return '#f59e0b';
      case '결석': return '#ef4444';
      case '조퇴': return '#8b5cf6';
      default: return '#d1d5db';
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
  };

  // 월별 차수 목록 그룹화
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.month]) {
      acc[schedule.month] = [];
    }
    acc[schedule.month].push(schedule);
    return acc;
  }, {});

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '20px' }}>📊 출결 관리</h2>
        
        {/* 서브 탭 */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '10px'
        }}>
          <button
            onClick={() => setActiveSubTab('attendance')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeSubTab === 'attendance' ? '#4f46e5' : 'white',
              color: activeSubTab === 'attendance' ? 'white' : '#666',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: activeSubTab === 'attendance' ? 'bold' : 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Users size={18} />
            출석 체크
          </button>
          <button
            onClick={() => setActiveSubTab('schedule')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeSubTab === 'schedule' ? '#4f46e5' : 'white',
              color: activeSubTab === 'schedule' ? 'white' : '#666',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: activeSubTab === 'schedule' ? 'bold' : 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Calendar size={18} />
            차수 일정 설정
          </button>
        </div>

        {/* 출석 체크 탭 */}
        {activeSubTab === 'attendance' && (
          <>
            {/* 날짜 선택 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '20px',
              padding: '20px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <label style={{ fontWeight: 'bold', fontSize: '16px' }}>
                📅 출석 날짜:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              />
              {selectedDate && (() => {
                const { month, round } = getMonthRound(selectedDate);
                return (
                  <span style={{
                    padding: '8px 16px',
                    backgroundColor: round ? '#dcfce7' : '#fef3c7',
                    color: round ? '#166534' : '#b45309',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderRadius: '12px'
                  }}>
                    {month}월 {round ? `${round}차` : '(차수 미설정)'}
                  </span>
                );
              })()}
              <div style={{ marginLeft: 'auto', color: '#666' }}>
                총 {students.length}명
              </div>
            </div>

            {/* 안내 메시지 */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #bbf7d0'
            }}>
              <p style={{ margin: 0, color: '#166534', fontSize: '14px' }}>
                💡 <strong>팁:</strong> 같은 버튼을 다시 누르면 선택이 해제됩니다. 차수 일정은 "차수 일정 설정" 탭에서 관리하세요.
              </p>
            </div>

            {/* 출석 체크 테이블 */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>학생</th>
                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>출석 상태</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const attendance = todayAttendance[student.id] || {};
                    return (
                      <tr key={student.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '15px' }}>
                          <div style={{ fontWeight: '500' }}>{student.name}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>{student.grade || ''}</div>
                        </td>
                        <td style={{ padding: '15px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {['출석', '지각', '결석', '조퇴'].map(status => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(student.id, status)}
                                style={{
                                  padding: '8px 16px',
                                  border: attendance.status === status ? 'none' : '1px solid #ddd',
                                  borderRadius: '6px',
                                  backgroundColor: attendance.status === status ? getStatusColor(status) : 'white',
                                  color: attendance.status === status ? 'white' : '#333',
                                  cursor: 'pointer',
                                  fontWeight: attendance.status === status ? 'bold' : 'normal',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '15px' }}>
                          <input
                            type="text"
                            value={attendance.note || ''}
                            onChange={(e) => handleNoteChange(student.id, e.target.value)}
                            placeholder="메모 (선택사항)"
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 저장 버튼 */}
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={handleSaveAttendance}
                disabled={loading}
                style={{
                  padding: '12px 30px',
                  backgroundColor: loading ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                {loading ? '저장 중...' : '💾 출석 저장'}
              </button>
            </div>

            {/* 출석 통계 */}
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ marginBottom: '15px' }}>📈 오늘 출석 통계</h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '15px' 
              }}>
                {['출석', '지각', '결석', '조퇴'].map(status => {
                  const count = Object.values(todayAttendance).filter(a => a.status === status).length;
                  return (
                    <div
                      key={status}
                      style={{
                        padding: '20px',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ 
                        fontSize: '28px', 
                        fontWeight: 'bold',
                        color: getStatusColor(status),
                        marginBottom: '5px'
                      }}>
                        {count}명
                      </div>
                      <div style={{ color: '#666' }}>{status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 차수 일정 설정 탭 */}
        {activeSubTab === 'schedule' && (
          <>
            {/* 연도 선택 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '20px',
              padding: '20px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <label style={{ fontWeight: 'bold', fontSize: '16px' }}>
                📅 연도 선택:
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
              >
                {[2024, 2025, 2026, 2027].map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setEditingSchedule(null);
                    setNewSchedule({ month: selectedMonth, round: 1, startDate: '', endDate: '' });
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Plus size={18} />
                  차수 일정 추가
                </button>
              </div>
            </div>

            {/* 안내 메시지 */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #fde68a'
            }}>
              <p style={{ margin: 0, color: '#b45309', fontSize: '14px' }}>
                💡 <strong>안내:</strong> 차수 일정을 설정하면 해당 기간의 출석, 과제 등이 자동으로 해당 월-차수로 분류됩니다. 
                예: 1월 25일~31일을 "2월 1차"로 설정할 수 있습니다.
              </p>
            </div>

            {/* 차수 추가/수정 폼 */}
            {showAddForm && (
              <div style={{
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #e5e7eb'
              }}>
                <h4 style={{ marginTop: 0, marginBottom: '15px' }}>
                  {editingSchedule ? '✏️ 차수 일정 수정' : '➕ 새 차수 일정 추가'}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>월</label>
                    <select
                      value={newSchedule.month}
                      onChange={(e) => setNewSchedule({ ...newSchedule, month: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px'
                      }}
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                        <option key={m} value={m}>{m}월</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>차수</label>
                    <select
                      value={newSchedule.round}
                      onChange={(e) => setNewSchedule({ ...newSchedule, round: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px'
                      }}
                    >
                      {[1,2,3,4,5].map(r => (
                        <option key={r} value={r}>{r}차</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>시작일</label>
                    <input
                      type="date"
                      value={newSchedule.startDate}
                      onChange={(e) => setNewSchedule({ ...newSchedule, startDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>종료일</label>
                    <input
                      type="date"
                      value={newSchedule.endDate}
                      onChange={(e) => setNewSchedule({ ...newSchedule, endDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingSchedule(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: 'white',
                      color: '#666',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveSchedule}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4f46e5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {loading ? '저장 중...' : (editingSchedule ? '수정' : '추가')}
                  </button>
                </div>
              </div>
            )}

            {/* 차수 일정 목록 */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              {Object.keys(groupedSchedules).length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  <Calendar size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p>등록된 차수 일정이 없습니다.</p>
                  <p style={{ fontSize: '14px' }}>위의 "차수 일정 추가" 버튼을 눌러 일정을 추가해주세요.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold' }}>월</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>차수</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>시작일</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>종료일</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>기간</th>
                      <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold' }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedSchedules).map(([month, monthSchedules]) => (
                      monthSchedules.map((schedule, idx) => {
                        const startDate = new Date(schedule.startDate);
                        const endDate = new Date(schedule.endDate);
                        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                        
                        return (
                          <tr key={schedule.id} style={{ 
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: idx === 0 ? '#f0f9ff' : 'white'
                          }}>
                            <td style={{ padding: '15px', fontWeight: idx === 0 ? 'bold' : 'normal' }}>
                              {idx === 0 ? `${month}월` : ''}
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 12px',
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                borderRadius: '12px',
                                fontWeight: 'bold'
                              }}>
                                {schedule.round}차
                              </span>
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              {formatDate(schedule.startDate)}
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              {formatDate(schedule.endDate)}
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center', color: '#666' }}>
                              {days}일
                            </td>
                            <td style={{ padding: '15px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleEditSchedule(schedule)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f0f9ff',
                                    color: '#4f46e5',
                                    border: '1px solid #4f46e5',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                  }}
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#fef2f2',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '13px'
                                  }}
                                >
                                  삭제
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 차수 일정 미리보기 (캘린더 형태) */}
            {schedules.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h3 style={{ marginBottom: '15px' }}>📆 {selectedYear}년 차수 일정 미리보기</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '15px' 
                }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
                    const monthSchedules = schedules.filter(s => s.month === month);
                    return (
                      <div
                        key={month}
                        style={{
                          padding: '15px',
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ 
                          fontWeight: 'bold', 
                          marginBottom: '10px',
                          paddingBottom: '10px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          {month}월
                        </div>
                        {monthSchedules.length === 0 ? (
                          <div style={{ color: '#999', fontSize: '13px' }}>미설정</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {monthSchedules.map(s => (
                              <div key={s.id} style={{ 
                                fontSize: '13px',
                                padding: '4px 8px',
                                backgroundColor: '#f0f9ff',
                                borderRadius: '4px'
                              }}>
                                <span style={{ fontWeight: 'bold' }}>{s.round}차</span>
                                <span style={{ color: '#666', marginLeft: '8px' }}>
                                  {formatDate(s.startDate).split('(')[0]}~{formatDate(s.endDate).split('(')[0]}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceManager;
