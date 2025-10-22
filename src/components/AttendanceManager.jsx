import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const AttendanceManager = () => {
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayAttendance, setTodayAttendance] = useState({});
  const [loading, setLoading] = useState(false);

  // 학생 목록과 출석 기록 로드
  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAttendanceForDate(selectedDate);
    }
  }, [selectedDate]);

  const loadStudents = async () => {
    try {
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentsList = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsList);
    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
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

  const handleStatusChange = (studentId, status) => {
    setTodayAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
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
      for (const student of students) {
        const attendance = todayAttendance[student.id];
        if (!attendance || !attendance.status) continue;

        const attendanceData = {
          studentId: student.id,
          studentName: student.name,
          date: selectedDate,
          status: attendance.status,
          note: attendance.note || '',
          timestamp: new Date()
        };

        if (attendance.id) {
          // 기존 기록 수정
          await updateDoc(doc(db, 'attendance', attendance.id), attendanceData);
        } else {
          // 새 기록 추가
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

  // 출석률 계산
  const calculateAttendanceRate = (studentId) => {
    // 전체 출석 기록에서 해당 학생의 기록만 필터링
    const studentRecords = attendanceRecords.filter(r => r.studentId === studentId);
    if (studentRecords.length === 0) return 0;
    
    const presentCount = studentRecords.filter(r => r.status === '출석').length;
    return Math.round((presentCount / studentRecords.length) * 100);
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

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '20px' }}>📊 출결 관리</h2>
        
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
          <div style={{ marginLeft: 'auto', color: '#666' }}>
            총 {students.length}명
          </div>
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
      </div>
    </div>
  );
};

export default AttendanceManager;