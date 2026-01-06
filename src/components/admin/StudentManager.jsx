import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Edit2, Save, X, FileText, ChevronDown, ChevronUp, Camera, Image, RotateCcw, BarChart2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db, auth, storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getTodayMonthWeek } from '../../utils/dateUtils';

export default function StudentManager({ students, branch }) {
  const [newStudent, setNewStudent] = useState({ 
    name: '', 
    grade: '', 
    school: '',
    phone: '', 
    parentPhone: '',
    birthDate: '', 
    id: '', 
    password: '' 
  });
  
  const [editingStudent, setEditingStudent] = useState(null);
  const [sortByGrade, setSortByGrade] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' 또는 'card'
  
  // 수업 메모 관련 상태
  const [memoStudent, setMemoStudent] = useState(null); // 메모 작성 중인 학생
  const [studentMemos, setStudentMemos] = useState({}); // 학생별 메모 목록
  const [expandedMemos, setExpandedMemos] = useState({}); // 펼쳐진 메모
  const [showAllMemos, setShowAllMemos] = useState({}); // 전체보기 상태
  
  // 학교 성적 관련 상태
  const [schoolGradeStudent, setSchoolGradeStudent] = useState(null); // 성적 입력 중인 학생
  const [studentSchoolGrades, setStudentSchoolGrades] = useState({}); // 학생별 학교 성적
  const [schoolGradeForm, setSchoolGradeForm] = useState({
    examType: '중간고사',
    year: new Date().getFullYear(),
    semester: 1,
    subject: '국어',
    score: '',
    grade: '',
    rank: '',
    totalStudents: '',
    note: ''
  });
  
  // 메모 작성 폼
  const todayMonthWeek = getTodayMonthWeek();
  const [memoForm, setMemoForm] = useState({
    month: todayMonthWeek.month,
    week: todayMonthWeek.week,
    content: ''
  });

  // 이미지 관련 상태
  const [imageStudent, setImageStudent] = useState(null); // 이미지 업로드 중인 학생
  const [studentImages, setStudentImages] = useState({}); // 학생별 이미지 목록
  const [imageUploading, setImageUploading] = useState(false);
  const [imageForm, setImageForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // 메모 데이터 로드
  useEffect(() => {
    const loadMemos = async () => {
      try {
        const memosRef = collection(db, 'studentMemos');
        const snapshot = await getDocs(memosRef);
        const memosData = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        
        // 학생별로 그룹화
        const grouped = {};
        memosData.forEach(memo => {
          if (!grouped[memo.studentId]) {
            grouped[memo.studentId] = [];
          }
          grouped[memo.studentId].push(memo);
        });
        
        // 각 학생의 메모를 최신순 정렬
        Object.keys(grouped).forEach(studentId => {
          grouped[studentId].sort((a, b) => {
            if (b.month !== a.month) return b.month - a.month;
            return b.week - a.week;
          });
        });
        
        setStudentMemos(grouped);
      } catch (error) {
        console.error('메모 로드 실패:', error);
      }
    };
    
    loadMemos();
  }, []);

  // 학교 성적 데이터 로드
  useEffect(() => {
    const loadSchoolGrades = async () => {
      try {
        const gradesRef = collection(db, 'schoolGrades');
        const snapshot = await getDocs(gradesRef);
        const gradesData = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        
        // 학생별로 그룹화
        const grouped = {};
        gradesData.forEach(grade => {
          if (!grouped[grade.studentId]) {
            grouped[grade.studentId] = [];
          }
          grouped[grade.studentId].push(grade);
        });
        
        // 각 학생의 성적을 최신순 정렬
        Object.keys(grouped).forEach(studentId => {
          grouped[studentId].sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            if (b.semester !== a.semester) return b.semester - a.semester;
            return 0;
          });
        });
        
        setStudentSchoolGrades(grouped);
      } catch (error) {
        console.error('학교 성적 로드 실패:', error);
      }
    };
    
    loadSchoolGrades();
  }, []);

  // 이미지 데이터 로드
  useEffect(() => {
    const loadImages = async () => {
      try {
        const imagesRef = collection(db, 'studentImages');
        const snapshot = await getDocs(imagesRef);
        const imagesData = snapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data()
        }));
        
        // 학생별로 그룹화
        const grouped = {};
        imagesData.forEach(img => {
          if (!grouped[img.studentId]) {
            grouped[img.studentId] = [];
          }
          grouped[img.studentId].push(img);
        });
        
        // 각 학생의 이미지를 최신순 정렬
        Object.keys(grouped).forEach(studentId => {
          grouped[studentId].sort((a, b) => new Date(b.date) - new Date(a.date));
        });
        
        setStudentImages(grouped);
      } catch (error) {
        console.error('이미지 로드 실패:', error);
      }
    };
    
    loadImages();
  }, []);

  // 이미지 파일 선택 핸들러
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하로 업로드해주세요.');
      return;
    }

    setSelectedImageFile(file);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 파일을 Base64로 변환하는 함수
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 이미지 저장
  const handleSaveImage = async () => {
    if (!imageStudent || !selectedImageFile) {
      alert('이미지를 선택해주세요.');
      return;
    }

    if (!imageForm.title.trim()) {
      alert('이미지 제목을 입력해주세요.');
      return;
    }

    setImageUploading(true);

    try {
      // Firebase Storage에 업로드
      const fileName = `${Date.now()}_${selectedImageFile.name}`;
      const storageRef = ref(storage, `student-images/${imageStudent.id}/${fileName}`);
      await uploadBytes(storageRef, selectedImageFile);
      const imageUrl = await getDownloadURL(storageRef);

      // Base64로 변환 (MMS 발송용)
      const imageBase64 = await fileToBase64(selectedImageFile);

      // Firestore에 메타데이터 저장 (Base64 포함)
      await addDoc(collection(db, 'studentImages'), {
        studentId: imageStudent.id,
        studentName: imageStudent.name,
        title: imageForm.title,
        date: imageForm.date,
        imageUrl: imageUrl,
        imageBase64: imageBase64,  // MMS 발송용 Base64 데이터
        storagePath: `student-images/${imageStudent.id}/${fileName}`,
        createdAt: new Date()
      });

      // 상태 업데이트
      const newImage = {
        studentId: imageStudent.id,
        studentName: imageStudent.name,
        title: imageForm.title,
        date: imageForm.date,
        imageUrl: imageUrl,
        imageBase64: imageBase64
      };

      setStudentImages(prev => ({
        ...prev,
        [imageStudent.id]: [newImage, ...(prev[imageStudent.id] || [])]
      }));

      // 폼 초기화
      setImageStudent(null);
      setSelectedImageFile(null);
      setImagePreview(null);
      setImageForm({ title: '', date: new Date().toISOString().split('T')[0] });

      alert('이미지가 저장되었습니다!');
    } catch (error) {
      console.error('이미지 저장 실패:', error);
      alert('이미지 저장에 실패했습니다: ' + error.message);
    } finally {
      setImageUploading(false);
    }
  };

  // 이미지 삭제
  const handleDeleteImage = async (studentId, image) => {
    if (!window.confirm(`"${image.title}" 이미지를 삭제하시겠습니까?`)) return;

    try {
      // Storage에서 삭제
      if (image.storagePath) {
        const storageRef = ref(storage, image.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }

      // Firestore에서 삭제
      await deleteDoc(doc(db, 'studentImages', image.docId));

      // 상태 업데이트
      setStudentImages(prev => ({
        ...prev,
        [studentId]: prev[studentId].filter(img => img.docId !== image.docId)
      }));

      alert('이미지가 삭제되었습니다.');
    } catch (error) {
      console.error('이미지 삭제 실패:', error);
      alert('이미지 삭제에 실패했습니다.');
    }
  };

  // 학생 추가
  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.grade || !newStudent.id || !newStudent.password) {
      alert('필수 항목을 입력해주세요.');
      return;
    }

    try {
      const email = `${newStudent.id}@student.com`;
      
      await createUserWithEmailAndPassword(auth, email, newStudent.password);
      await signOut(auth);
      await signInWithEmailAndPassword(auth, 'admin@test.com', 'admin123');
      
      await addDoc(collection(db, 'students'), {
        name: newStudent.name,
        grade: newStudent.grade,
        school: newStudent.school,
        phone: newStudent.phone,
        parentPhone: newStudent.parentPhone,
        birthDate: newStudent.birthDate,
        id: newStudent.id,
        password: newStudent.password,
        branch: branch, // 지점 정보 추가
        exams: []
      });
      
      setNewStudent({ 
        name: '', 
        grade: '', 
        school: '',
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
          school: editingStudent.school || '',
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

  // 수업 메모 저장
  const handleSaveMemo = async () => {
    if (!memoStudent || !memoForm.content.trim()) {
      alert('메모 내용을 입력해주세요.');
      return;
    }

    try {
      // 같은 월/주차 메모가 있는지 확인
      const existingMemos = studentMemos[memoStudent.id] || [];
      const existingMemo = existingMemos.find(
        m => m.month === memoForm.month && m.week === memoForm.week
      );

      if (existingMemo) {
        // 기존 메모 수정
        await updateDoc(doc(db, 'studentMemos', existingMemo.docId), {
          content: memoForm.content,
          updatedAt: new Date().toISOString()
        });
        
        // 로컬 상태 업데이트
        setStudentMemos(prev => ({
          ...prev,
          [memoStudent.id]: prev[memoStudent.id].map(m => 
            m.docId === existingMemo.docId 
              ? { ...m, content: memoForm.content, updatedAt: new Date().toISOString() }
              : m
          )
        }));
        
        alert('메모가 수정되었습니다.');
      } else {
        // 새 메모 추가
        const newMemo = {
          studentId: memoStudent.id,
          studentName: memoStudent.name,
          grade: memoStudent.grade,
          school: memoStudent.school || '',
          month: memoForm.month,
          week: memoForm.week,
          content: memoForm.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'studentMemos'), newMemo);
        
        // 로컬 상태 업데이트
        setStudentMemos(prev => ({
          ...prev,
          [memoStudent.id]: [
            { docId: docRef.id, ...newMemo },
            ...(prev[memoStudent.id] || [])
          ]
        }));
        
        alert('메모가 저장되었습니다.');
      }

      // 폼 초기화
      setMemoForm({
        month: todayMonthWeek.month,
        week: todayMonthWeek.week,
        content: ''
      });
      setMemoStudent(null);
    } catch (error) {
      console.error('메모 저장 실패:', error);
      alert('메모 저장에 실패했습니다.');
    }
  };

  // 메모 삭제
  const handleDeleteMemo = async (studentId, memoDocId) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'studentMemos', memoDocId));
      
      setStudentMemos(prev => ({
        ...prev,
        [studentId]: prev[studentId].filter(m => m.docId !== memoDocId)
      }));
      
      alert('메모가 삭제되었습니다.');
    } catch (error) {
      console.error('메모 삭제 실패:', error);
      alert('메모 삭제에 실패했습니다.');
    }
  };

  // 질문 횟수 초기화
  const handleResetQuestionCount = async (student) => {
    if (!confirm(`${student.name} 학생의 이번 주 질문 횟수를 초기화하시겠습니까?\n(개념과 지문, 문제 풀이 모두 초기화됩니다)`)) return;

    try {
      // 이번 주 시작일 계산
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(now);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);

      // 개념과 지문 질문 삭제
      const conceptQuery = query(
        collection(db, 'conceptQuestions'),
        where('studentId', '==', student.id)
      );
      const conceptSnapshot = await getDocs(conceptQuery);
      
      for (const docSnap of conceptSnapshot.docs) {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
        if (createdAt >= weekStart) {
          await deleteDoc(doc(db, 'conceptQuestions', docSnap.id));
        }
      }

      // 문제 풀이 질문 삭제
      const problemQuery = query(
        collection(db, 'problemQuestions'),
        where('studentId', '==', student.id)
      );
      const problemSnapshot = await getDocs(problemQuery);
      
      for (const docSnap of problemSnapshot.docs) {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
        if (createdAt >= weekStart) {
          await deleteDoc(doc(db, 'problemQuestions', docSnap.id));
        }
      }

      alert(`${student.name} 학생의 질문 횟수가 초기화되었습니다.`);
    } catch (error) {
      console.error('질문 횟수 초기화 실패:', error);
      alert('질문 횟수 초기화에 실패했습니다.');
    }
  };

  // 메모 수정 모드
  const handleEditMemo = (student, memo) => {
    setMemoStudent(student);
    setMemoForm({
      month: memo.month,
      week: memo.week,
      content: memo.content
    });
  };

  // 메모 펼침/접기 토글
  const toggleMemoExpand = (studentId, memoDocId) => {
    setExpandedMemos(prev => ({
      ...prev,
      [`${studentId}-${memoDocId}`]: !prev[`${studentId}-${memoDocId}`]
    }));
  };

  // 전체보기 토글
  const toggleShowAllMemos = (studentId) => {
    setShowAllMemos(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // 학교 성적 저장
  const handleSaveSchoolGrade = async () => {
    if (!schoolGradeStudent) return;
    if (!schoolGradeForm.score && !schoolGradeForm.grade) {
      alert('점수 또는 등급을 입력해주세요.');
      return;
    }

    try {
      const newGrade = {
        studentId: schoolGradeStudent.id,
        studentName: schoolGradeStudent.name,
        examType: schoolGradeForm.examType,
        year: parseInt(schoolGradeForm.year),
        semester: parseInt(schoolGradeForm.semester),
        subject: schoolGradeForm.subject,
        score: schoolGradeForm.score ? parseInt(schoolGradeForm.score) : null,
        grade: schoolGradeForm.grade || null,
        rank: schoolGradeForm.rank ? parseInt(schoolGradeForm.rank) : null,
        totalStudents: schoolGradeForm.totalStudents ? parseInt(schoolGradeForm.totalStudents) : null,
        note: schoolGradeForm.note || '',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'schoolGrades'), newGrade);
      
      // 로컬 상태 업데이트
      setStudentSchoolGrades(prev => ({
        ...prev,
        [schoolGradeStudent.id]: [
          { docId: docRef.id, ...newGrade },
          ...(prev[schoolGradeStudent.id] || [])
        ]
      }));
      
      alert('학교 성적이 저장되었습니다.');
      
      // 폼 초기화
      setSchoolGradeForm({
        examType: '중간고사',
        year: new Date().getFullYear(),
        semester: 1,
        subject: '국어',
        score: '',
        grade: '',
        rank: '',
        totalStudents: '',
        note: ''
      });
      setSchoolGradeStudent(null);
    } catch (error) {
      console.error('학교 성적 저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 학교 성적 삭제
  const handleDeleteSchoolGrade = async (studentId, gradeDocId) => {
    if (!confirm('이 성적을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'schoolGrades', gradeDocId));
      
      setStudentSchoolGrades(prev => ({
        ...prev,
        [studentId]: prev[studentId].filter(g => g.docId !== gradeDocId)
      }));
      
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('학교 성적 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
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
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm"
          >
            {viewMode === 'table' ? '📇 카드형' : '📋 테이블형'}
          </button>
          <button
            onClick={() => setSortByGrade(!sortByGrade)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
          >
            {sortByGrade ? '전체 보기' : '학년별 정렬'}
          </button>
        </div>
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
            placeholder="이름 *"
            value={newStudent.name}
            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select
            value={newStudent.grade}
            onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">학년 선택 *</option>
            <option value="중1">중1</option>
            <option value="중2">중2</option>
            <option value="중3">중3</option>
            <option value="고1">고1</option>
            <option value="고2">고2</option>
            <option value="고3">고3</option>
          </select>
          <input
            type="text"
            placeholder="학교"
            value={newStudent.school}
            onChange={(e) => setNewStudent({ ...newStudent, school: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
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
            placeholder="로그인 아이디 *"
            value={newStudent.id}
            onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="password"
            placeholder="비밀번호 *"
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

      {/* 수업 메모 작성 모달 */}
      {memoStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                📝 {memoStudent.name} 수업 메모
              </h3>
              <button
                onClick={() => {
                  setMemoStudent(null);
                  setMemoForm({ month: todayMonthWeek.month, week: todayMonthWeek.week, content: '' });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">월</label>
                  <select
                    value={memoForm.month}
                    onChange={(e) => setMemoForm({ ...memoForm, month: parseInt(e.target.value) })}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">주차</label>
                  <select
                    value={memoForm.week}
                    onChange={(e) => setMemoForm({ ...memoForm, week: parseInt(e.target.value) })}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                  >
                    {[1,2,3,4,5].map(w => (
                      <option key={w} value={w}>{w}주차</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모 내용</label>
                <textarea
                  value={memoForm.content}
                  onChange={(e) => setMemoForm({ ...memoForm, content: e.target.value })}
                  placeholder="수업 내용, 학습 상태, 특이사항 등을 기록하세요..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                  rows="5"
                />
              </div>

              <button
                onClick={handleSaveMemo}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
              >
                메모 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 정보 수정 모달 (테이블 모드용) */}
      {editingStudent && viewMode === 'table' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                ✏️ {editingStudent.name} 정보 수정
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">이름</label>
                  <input
                    type="text"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">학년</label>
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
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">학교</label>
                <input
                  type="text"
                  value={editingStudent.school || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, school: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">학생 전화번호</label>
                  <input
                    type="text"
                    value={editingStudent.phone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">학부모 전화번호</label>
                  <input
                    type="text"
                    value={editingStudent.parentPhone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">생년월일 (MMDD)</label>
                <input
                  type="text"
                  value={editingStudent.birthDate || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, birthDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-2">※ 아이디/비밀번호는 수정할 수 없습니다</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 bg-gray-100 rounded-lg">
                    <p className="text-xs text-gray-500">아이디</p>
                    <p className="text-sm font-medium text-gray-700">{editingStudent.id}</p>
                  </div>
                  <div className="px-3 py-2 bg-gray-100 rounded-lg">
                    <p className="text-xs text-gray-500">비밀번호</p>
                    <p className="text-sm font-medium text-gray-700">{editingStudent.password || '미등록'}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
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
          </div>
        </div>
      )}

      {/* 학교 성적 입력 모달 */}
      {schoolGradeStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                📊 {schoolGradeStudent.name} 학교 성적
              </h3>
              <button
                onClick={() => {
                  setSchoolGradeStudent(null);
                  setSchoolGradeForm({
                    examType: '중간고사',
                    year: new Date().getFullYear(),
                    semester: 1,
                    subject: '국어',
                    score: '',
                    grade: '',
                    rank: '',
                    totalStudents: '',
                    note: ''
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* 새 성적 입력 폼 */}
            <div className="space-y-3 mb-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-800">새 성적 입력</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">연도</label>
                  <select
                    value={schoolGradeForm.year}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, year: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">학기</label>
                  <select
                    value={schoolGradeForm.semester}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, semester: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value={1}>1학기</option>
                    <option value={2}>2학기</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">시험</label>
                  <select
                    value={schoolGradeForm.examType}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, examType: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value="중간고사">중간고사</option>
                    <option value="기말고사">기말고사</option>
                    <option value="모의고사">모의고사</option>
                    <option value="수행평가">수행평가</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">과목</label>
                  <select
                    value={schoolGradeForm.subject}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, subject: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value="국어">국어</option>
                    <option value="문학">문학</option>
                    <option value="독서">독서</option>
                    <option value="화법과작문">화법과작문</option>
                    <option value="언어와매체">언어와매체</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">점수</label>
                  <input
                    type="number"
                    value={schoolGradeForm.score}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, score: e.target.value })}
                    placeholder="점수"
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">등급</label>
                  <select
                    value={schoolGradeForm.grade}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, grade: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value="">-</option>
                    {[1,2,3,4,5,6,7,8,9].map(g => (
                      <option key={g} value={g}>{g}등급</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">석차</label>
                  <input
                    type="number"
                    value={schoolGradeForm.rank}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, rank: e.target.value })}
                    placeholder="석차"
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">전체인원</label>
                  <input
                    type="number"
                    value={schoolGradeForm.totalStudents}
                    onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, totalStudents: e.target.value })}
                    placeholder="인원"
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">메모</label>
                <input
                  type="text"
                  value={schoolGradeForm.note}
                  onChange={(e) => setSchoolGradeForm({ ...schoolGradeForm, note: e.target.value })}
                  placeholder="특이사항"
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <button
                onClick={handleSaveSchoolGrade}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                성적 저장
              </button>
            </div>

            {/* 기존 성적 목록 */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">📋 성적 기록</h4>
              {studentSchoolGrades[schoolGradeStudent.id]?.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {studentSchoolGrades[schoolGradeStudent.id].map(grade => (
                    <div key={grade.docId} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium">{grade.year}년 {grade.semester}학기 {grade.examType}</span>
                          <span className="ml-2 text-gray-500">{grade.subject}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteSchoolGrade(schoolGradeStudent.id, grade.docId)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          삭제
                        </button>
                      </div>
                      <div className="mt-1 text-gray-600">
                        {grade.score && <span className="mr-3">점수: {grade.score}점</span>}
                        {grade.grade && <span className="mr-3">{grade.grade}등급</span>}
                        {grade.rank && grade.totalStudents && (
                          <span className="mr-3">석차: {grade.rank}/{grade.totalStudents}</span>
                        )}
                      </div>
                      {grade.note && <p className="text-xs text-gray-500 mt-1">{grade.note}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">등록된 성적이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 이미지 업로드 모달 */}
      {imageStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                📷 {imageStudent.name} 이미지 저장
              </h3>
              <button
                onClick={() => {
                  setImageStudent(null);
                  setSelectedImageFile(null);
                  setImagePreview(null);
                  setImageForm({ title: '', date: new Date().toISOString().split('T')[0] });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={imageForm.date}
                  onChange={(e) => setImageForm({ ...imageForm, date: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목/설명</label>
                <input
                  type="text"
                  value={imageForm.title}
                  onChange={(e) => setImageForm({ ...imageForm, title: e.target.value })}
                  placeholder="예: 11월 4주차 성적표, 모의고사 결과..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 선택</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">최대 5MB, JPG/PNG 파일</p>
              </div>

              {imagePreview && (
                <div className="border rounded-lg p-2">
                  <p className="text-sm text-gray-600 mb-2">미리보기:</p>
                  <img
                    src={imagePreview}
                    alt="미리보기"
                    className="max-h-48 mx-auto rounded-lg"
                  />
                </div>
              )}

              <button
                onClick={handleSaveImage}
                disabled={imageUploading || !selectedImageFile}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:from-gray-400 disabled:to-gray-500"
              >
                {imageUploading ? '업로드 중...' : '이미지 저장'}
              </button>
            </div>

            {/* 저장된 이미지 목록 */}
            {studentImages[imageStudent.id] && studentImages[imageStudent.id].length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-3">
                  📂 저장된 이미지 ({studentImages[imageStudent.id].length}개)
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {studentImages[imageStudent.id].map((img, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <img
                          src={img.imageUrl}
                          alt={img.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div>
                          <p className="text-sm font-medium">{img.title}</p>
                          <p className="text-xs text-gray-500">{img.date}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteImage(imageStudent.id, img)}
                        className="p-1 text-red-500 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 학생 목록 */}
      <div className="space-y-6">
        {sortedGrades.map(grade => (
          <div key={grade}>
            <h3 className="text-lg font-bold text-gray-700 mb-3 pb-2 border-b-2 border-gray-200">
              {grade} {sortByGrade && grade !== '전체' && `(${displayStudents[grade].length}명)`}
            </h3>
            
            {/* 테이블 형태 (한 줄에 한 명) */}
            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">이름</th>
                      <th className="px-3 py-2 text-left">학년</th>
                      <th className="px-3 py-2 text-left">학교</th>
                      <th className="px-3 py-2 text-left">학생번호</th>
                      <th className="px-3 py-2 text-left">학부모번호</th>
                      <th className="px-3 py-2 text-left">생년월일</th>
                      <th className="px-3 py-2 text-left">아이디</th>
                      <th className="px-3 py-2 text-left">시험</th>
                      <th className="px-3 py-2 text-left">학교성적</th>
                      <th className="px-3 py-2 text-left">메모</th>
                      <th className="px-3 py-2 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayStudents[grade].map((student, idx) => (
                      <tr key={student.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-3 py-2 font-medium">{student.name}</td>
                        <td className="px-3 py-2">{student.grade}</td>
                        <td className="px-3 py-2">{student.school || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{student.phone || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{student.parentPhone || '-'}</td>
                        <td className="px-3 py-2">{student.birthDate || '-'}</td>
                        <td className="px-3 py-2 text-gray-500">{student.id}</td>
                        <td className="px-3 py-2">{student.exams?.length || 0}개</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setSchoolGradeStudent(student)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {studentSchoolGrades[student.id]?.length || 0}개 📊
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-500">
                            {studentMemos[student.id]?.length || 0}개
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setMemoStudent(student)}
                              className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"
                              title="수업 메모"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              onClick={() => setImageStudent(student)}
                              className="p-1.5 bg-purple-100 text-purple-600 rounded hover:bg-purple-200"
                              title="이미지 저장"
                            >
                              <Camera size={14} />
                            </button>
                            <button
                              onClick={() => handleResetQuestionCount(student)}
                              className="p-1.5 bg-orange-100 text-orange-600 rounded hover:bg-orange-200"
                              title="질문 초기화"
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              onClick={() => setEditingStudent(student)}
                              className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                              title="수정"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* 카드 형태 (기존) */
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
                        value={editingStudent.school || ''}
                        onChange={(e) => setEditingStudent({ ...editingStudent, school: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="학교"
                      />
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
                      
                      {/* 아이디/비밀번호 표시 (읽기 전용) */}
                      <div className="pt-2 border-t border-gray-200 mt-2">
                        <p className="text-xs text-gray-500 mb-2">※ 아이디/비밀번호는 수정할 수 없습니다</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="px-3 py-2 bg-gray-100 rounded-lg">
                            <p className="text-xs text-gray-500">아이디</p>
                            <p className="text-sm font-medium text-gray-700">{editingStudent.id}</p>
                          </div>
                          <div className="px-3 py-2 bg-gray-100 rounded-lg">
                            <p className="text-xs text-gray-500">비밀번호</p>
                            <p className="text-sm font-medium text-gray-700">{editingStudent.password || '미등록'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
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
                            <p className="text-sm text-gray-600">
                              {student.grade} {student.school && `• ${student.school}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMemoStudent(student)}
                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                            title="수업 메모"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={() => setImageStudent(student)}
                            className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition"
                            title="이미지 저장"
                          >
                            <Camera size={16} />
                          </button>
                          <button
                            onClick={() => handleResetQuestionCount(student)}
                            className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition"
                            title="질문 횟수 초기화"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition"
                            title="정보 수정"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>🏫 학교: {student.school || '미등록'}</p>
                        <p>📱 학생: {student.phone || '미등록'}</p>
                        <p>📱 학부모: {student.parentPhone || '미등록'}</p>
                        <p>🎂 생년월일: {student.birthDate || '미등록'}</p>
                        <p>🆔 아이디: {student.id}</p>
                        <p>🔑 비밀번호: {student.password || '미등록'}</p>
                        <p>📝 시험 기록: {student.exams?.length || 0}개</p>
                        <p>📷 저장된 이미지: {studentImages[student.id]?.length || 0}개</p>
                      </div>

                      {/* 수업 메모 히스토리 */}
                      {studentMemos[student.id] && studentMemos[student.id].length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-700">
                              📋 수업 메모 ({studentMemos[student.id].length}개)
                            </p>
                            {studentMemos[student.id].length > 3 && (
                              <button
                                onClick={() => toggleShowAllMemos(student.id)}
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                {showAllMemos[student.id] ? '접기' : '전체보기'}
                              </button>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {(showAllMemos[student.id] 
                              ? studentMemos[student.id] 
                              : studentMemos[student.id].slice(0, 3)
                            ).map(memo => (
                              <div 
                                key={memo.docId}
                                className="bg-gray-50 rounded-lg overflow-hidden"
                              >
                                <div 
                                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100"
                                  onClick={() => toggleMemoExpand(student.id, memo.docId)}
                                >
                                  <span className="text-sm font-medium text-gray-700">
                                    {memo.month}월 {memo.week}주차
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {memo.content.length > 20 
                                        ? memo.content.substring(0, 20) + '...' 
                                        : memo.content}
                                    </span>
                                    {expandedMemos[`${student.id}-${memo.docId}`] 
                                      ? <ChevronUp size={14} /> 
                                      : <ChevronDown size={14} />
                                    }
                                  </div>
                                </div>
                                
                                {expandedMemos[`${student.id}-${memo.docId}`] && (
                                  <div className="px-3 py-2 border-t border-gray-200 bg-white">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                                      {memo.content}
                                    </p>
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditMemo(student, memo);
                                        }}
                                        className="text-xs text-blue-600 hover:underline"
                                      >
                                        수정
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteMemo(student.id, memo.docId);
                                        }}
                                        className="text-xs text-red-600 hover:underline"
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              </div>
            )}
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
