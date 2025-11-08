import React, { useState } from 'react';
import { User, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';

export default function StudentManager({ students }) {
  const [newStudent, setNewStudent] = useState({ 
    name: '', 
    grade: '', 
    phone: '', 
    parentPhone: '', // 학부모 전화번호 추가
    birthDate: '', 
    id: '', 
    password: '' 
  });
  
  const [editingStudent, setEditingStudent] = useState(null);
  const [sortByGrade, setSortByGrade] = useState(true); // 학년별 정렬 옵션

  // 학생 추가
  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.grade || !newStudent.id || !newStudent.password) {
      alert('필수 항목을 입력해주세요.');
      return;
    }

    try {
      const email = `${newStudent.id}@student.com`;
      
      // Firebase Auth에 학생 계정 생성
      await createUserWithEmailAndPassword(auth, email, newStudent.password);
      
      // Firestore에 학생 정보 저장
      await addDoc(collection(db, 'students'), {
        name: newStudent.name,
        grade: newStudent.grade,
        phone: newStudent.phone,
        parentPhone: newStudent.parentPhone,
        birthDate: newStudent.birthDate,
        id: newStudent.id,
        password: newStudent.password,
        exams: []
      });
      
      // 관리자 재로그인 (학생 생성 후 자동 로그인되는 문제 해결)
      await signOut(auth);
      await signInWithEmailAndPassword(auth, 'admin@test.com', 'admin123'); // 관리자 비밀번호
      
      setNewStudent({ 
        name: '', 
        grade: '', 
        phone: '', 
        parentPhone: '',
        birthDate: '', 
        id: '', 
        password: '' 
      });
      alert('학생이 추가되었습니다.');
    } catch (error) {
      console.error('학생 추가 오류:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('이미 등록된 아이디입니다.');
      } else {
        alert('학생 추가 실패: ' + error.message);
      }
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (studentId) => {
    if (!confirm('정말 이 학생을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === studentId);
      
      if (studentDoc) {
        await deleteDoc(doc(db, 'students', studentDoc.id));
        alert('학생이 삭제되었습니다.');
      } else {
        alert('학생을 찾을 수 없습니다.');
      }
    } catch (error) {
      alert('학생 삭제 실패: ' + error.message);
    }
  };

  // 학생 정보 수정
  const handleUpdateStudent = async () => {
    if (!editingStudent) return;

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const studentDoc = snapshot.docs.find(doc => doc.data().id === editingStudent.id);
      
      if (studentDoc) {
        await updateDoc(doc(db, 'students', studentDoc.id), {
          name: editingStudent.name,
          grade: editingStudent.grade,
          phone: editingStudent.phone,
          parentPhone: editingStudent.parentPhone,
          birthDate: editingStudent.birthDate,
        });
        
        setEditingStudent(null);
        alert('학생 정보가 수정되었습니다.');
      } else {
        alert('학생을 찾을 수 없습니다.');
      }
    } catch (error) {
      alert('학생 정보 수정 실패: ' + error.message);
    }
  };

  // 학년별로 그룹화
  const groupByGrade = (studentsList) => {
    const grouped = {};
    studentsList.forEach(student => {
      if (!grouped[student.grade]) {
        grouped[student.grade] = [];
      }
      grouped[student.grade].push(student);
    });
    return grouped;
  };

  const displayStudents = sortByGrade ? groupByGrade(students) : { '전체': students };
  const gradeOrder = ['중1', '중2', '중3', '고1', '고2', '고3', '전체'];
  const sortedGrades = Object.keys(displayStudents).sort((a, b) => 
    gradeOrder.indexOf(a) - gradeOrder.indexOf(b)
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          학생 관리
        </h2>
        <button
          onClick={() => setSortByGrade(!sortByGrade)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
        >
          {sortByGrade ? '전체 보기' : '학년별 정렬'}
        </button>
      </div>

      {/* 학생 추가 폼 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-8">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Plus size={20} />
          새 학생 추가
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="이름"
            value={newStudent.name}
            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select
            value={newStudent.grade}
            onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">학년 선택</option>
            <option value="중1">중1</option>
            <option value="중2">중2</option>
            <option value="중3">중3</option>
            <option value="고1">고1</option>
            <option value="고2">고2</option>
            <option value="고3">고3</option>
          </select>
          <input
            type="text"
            placeholder="학생 전화번호"
            value={newStudent.phone}
            onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="학부모 전화번호"
            value={newStudent.parentPhone}
            onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="생년월일 (MMDD)"
            value={newStudent.birthDate}
            onChange={(e) => setNewStudent({ ...newStudent, birthDate: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="로그인 아이디"
            value={newStudent.id}
            onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={newStudent.password}
            onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleAddStudent}
          className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold"
        >
          학생 추가
        </button>
      </div>

      {/* 학생 목록 */}
      <div className="space-y-6">
        {sortedGrades.map(grade => (
          <div key={grade}>
            <h3 className="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-gray-200">
              {grade} {sortByGrade && grade !== '전체' && `(${displayStudents[grade].length}명)`}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayStudents[grade].map((student) => (
                <div
                  key={student.id}
                  className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-md transition"
                >
                  {editingStudent && editingStudent.id === student.id ? (
                    // 수정 모드
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editingStudent.name}
                        onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="이름"
                      />
                      <select
                        value={editingStudent.grade}
                        onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="중1">중1</option>
                        <option value="중2">중2</option>
                        <option value="중3">중3</option>
                        <option value="고1">고1</option>
                        <option value="고2">고2</option>
                        <option value="고3">고3</option>
                      </select>
                      <input
                        type="text"
                        value={editingStudent.phone}
                        onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="학생 전화번호"
                      />
                      <input
                        type="text"
                        value={editingStudent.parentPhone || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="학부모 전화번호"
                      />
                      <input
                        type="text"
                        value={editingStudent.birthDate}
                        onChange={(e) => setEditingStudent({ ...editingStudent, birthDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="생년월일 (MMDD)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateStudent}
                          className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2"
                        >
                          <Save size={16} />
                          저장
                        </button>
                        <button
                          onClick={() => setEditingStudent(null)}
                          className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition flex items-center justify-center gap-2"
                        >
                          <X size={16} />
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 일반 모드
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full flex items-center justify-center">
                            <User className="text-white" size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{student.name}</p>
                            <p className="text-sm text-gray-600">{student.grade}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>📱 학생: {student.phone || '미등록'}</p>
                        <p>📱 학부모: {student.parentPhone || '미등록'}</p>
                        <p>🎂 생년월일: {student.birthDate || '미등록'}</p>
                        <p>🆔 아이디: {student.id}</p>
                        <p>📝 시험 기록: {student.exams?.length || 0}개</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {students.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
            <User className="text-gray-400" size={48} />
          </div>
          <p className="text-gray-500 text-lg">등록된 학생이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
