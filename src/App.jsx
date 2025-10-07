import React, { useState, useEffect } from 'react';
import { Upload, Video, FileText, User, LogOut, CheckCircle, XCircle, Edit2 } from 'lucide-react';
import './index.css';
import { auth } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('problem');
  
  const [students, setStudents] = useState([
    { id: 'student1', name: '김민수', grade: '중3', phone: '010-1234-5678', birthDate: '0315', password: 'pass123', exams: [] }
  ]);
  
  const [videos, setVideos] = useState([
    { id: 1, subject: '수학', unit: '이차방정식', title: '근의 공식 이해하기', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', uploadDate: '2024-10-01' }
  ]);
  
  const [exams, setExams] = useState([
    {
      id: 1,
      title: '2024년 10월 전국연합 모의고사',
      date: '2024-10-01',
      subject: '국어',
      totalQuestions: 40,
      answers: ['1', '2', '3', '4', '5', '1', '2', '3', '4', '5', '1', '2', '3', '4', '5', '1', '2', '3', '4', '5',
                '1', '2', '3', '4', '5', '1', '2', '3', '4', '5', '1', '2', '3', '4', '5', '1', '2', '3', '4', '5'],
      scores: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
               3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      types: ['사실적 이해', '사실적 이해', '추론적 이해', '추론적 이해', '비판적 이해',
              '사실적 이해', '추론적 이해', '추론적 이해', '비판적 이해', '어휘/문법',
              '사실적 이해', '추론적 이해', '추론적 이해', '비판적 이해', '어휘/문법',
              '사실적 이해', '추론적 이해', '비판적 이해', '어휘/문법', '어휘/문법',
              '문학 감상', '문학 감상', '작품 분석', '작품 분석', '문학 감상',
              '문학 감상', '작품 분석', '작품 분석', '문학 감상', '어휘/문법',
              '사실적 이해', '추론적 이해', '비판적 이해', '어휘/문법', '어휘/문법',
              '문학 감상', '작품 분석', '문학 감상', '작품 분석', '어휘/문법']
    }
  ]);

  const [loginForm, setLoginForm] = useState({ id: '', password: '' });
  const [newStudent, setNewStudent] = useState({ name: '', grade: '', phone: '', birthDate: '', id: '', password: '' });
  const [newVideo, setNewVideo] = useState({ subject: '', unit: '', title: '', url: '' });
  const [newExam, setNewExam] = useState({
    title: '',
    date: '',
    subject: '국어',
    totalQuestions: 40,
    answers: Array(40).fill(''),
    scores: Array(40).fill(2),
    types: Array(40).fill('사실적 이해')
  });
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examResult, setExamResult] = useState(null);
  const [omrImage, setOmrImage] = useState(null);
  const [assignments, setAssignments] = useState([]);
const [newAssignment, setNewAssignment] = useState({
  title: '',
  description: '',
  dueDate: '',
  subject: '국어'
});
const [submissions, setSubmissions] = useState([]);
  const [recognizedAnswers, setRecognizedAnswers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  
  const [batchGrading, setBatchGrading] = useState({
    selectedExam: null,
    omrList: []
  });
// Firestore에서 데이터 로드
useEffect(() => {
  // 학생 데이터 로드
  const studentsRef = collection(db, 'students');
  const unsubscribeStudents = onSnapshot(studentsRef, (snapshot) => {
    const studentsData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    if (studentsData.length > 0) {
      setStudents(studentsData);
    }
  });

  // 시험 데이터 로드
  const examsRef = collection(db, 'exams');
  const unsubscribeExams = onSnapshot(examsRef, (snapshot) => {
    const examsData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    if (examsData.length > 0) {
      setExams(examsData);
    }
  });

// 과제 데이터 로드
  const assignmentsRef = collection(db, 'assignments');
  const unsubscribeAssignments = onSnapshot(assignmentsRef, (snapshot) => {
    const assignmentsData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    if (assignmentsData.length > 0) {
      setAssignments(assignmentsData);
    }
  });
  return () => {
    unsubscribeStudents();
    unsubscribeExams();
    unsubscribeAssignments();
  };
}, []);

  // 시험 데이터 로드
  const handleLogin = async (e) => {
  e.preventDefault();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, loginForm.id, loginForm.password);
    
    // Firestore에서 학생인지 확인
    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);
    const studentDoc = snapshot.docs.find(doc => doc.data().id === loginForm.id.split('@')[0]);
    
    if (studentDoc) {
      const studentData = studentDoc.data();
      setCurrentUser({ type: 'student', id: studentData.id, name: studentData.name, exams: studentData.exams || [] });
    } else {
      setCurrentUser({ type: 'admin', name: '관리자' });
    }
    
    setActiveTab('problem');
  } catch (error) {
    alert('로그인 실패: ' + error.message);
  }
};


  const questionTypes = ['사실적 이해', '추론적 이해', '비판적 이해', '어휘/문법', '문학 감상', '작품 분석'];

  const updateExamQuestions = (numQuestions) => {
    const num = parseInt(numQuestions) || 0;
    if (num < 1 || num > 100) return;
    
    setNewExam({
      ...newExam,
      totalQuestions: num,
      answers: Array(num).fill(''),
      scores: Array(num).fill(2),
      types: Array(num).fill('사실적 이해')
    });
  };


const handleAddStudent = async () => {
  if (!newStudent.name || !newStudent.id || !newStudent.password) {
    alert('필수 정보를 모두 입력해주세요.');
    return;
  }

  try {
    // Firebase Authentication에 사용자 생성
    const email = `${newStudent.id}@student.com`;
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    await createUserWithEmailAndPassword(auth, email, newStudent.password);
    
    // Firestore에 학생 정보 저장
    await addDoc(collection(db, 'students'), {
      name: newStudent.name,
      grade: newStudent.grade,
      phone: newStudent.phone,
      birthDate: newStudent.birthDate,
      id: newStudent.id,
      password: newStudent.password,
      exams: []
    });
    
    setNewStudent({ name: '', grade: '', phone: '', birthDate: '', id: '', password: '' });
    alert('학생이 추가되었습니다.');
  } catch (error) {
    alert('학생 추가 실패: ' + error.message);
  }
};

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
      setStudents(students.filter(s => s.id !== studentId));
      alert('학생이 삭제되었습니다.');
    } else {
      alert('학생을 찾을 수 없습니다.');
    }
  } catch (error) {
    alert('학생 삭제 실패: ' + error.message);
  }
};

  const handleAddVideo = () => {
    if (!newVideo.subject || !newVideo.unit || !newVideo.title || !newVideo.url) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    const video = {
      id: Date.now(),
      ...newVideo,
      uploadDate: new Date().toISOString().split('T')[0]
    };
    setVideos([...videos, video]);
    setNewVideo({ subject: '', unit: '', title: '', url: '' });
    alert('동영상이 추가되었습니다!');
  };

const handleAddExam = async () => {
  if (!newExam.title || !newExam.date) {
    alert('시험명과 날짜를 입력해주세요.');
    return;
  }

  const allAnswersFilled = newExam.answers.every(answer => answer !== '');
  if (!allAnswersFilled) {
    alert('모든 문제의 정답을 입력해주세요.');
    return;
  }

  try {
    await addDoc(collection(db, 'exams'), {
      title: newExam.title,
      date: newExam.date,
      subject: newExam.subject,
      totalQuestions: newExam.totalQuestions,
      answers: newExam.answers,
      scores: newExam.scores,
      types: newExam.types
    });

    setNewExam({
      title: '',
      date: '',
      subject: '국어',
      totalQuestions: 40,
      answers: Array(40).fill(''),
      scores: Array(40).fill(2),
      types: Array(40).fill('사실적 이해')
    });
  
  const handleAddAssignment = async () => {
  if (!newAssignment.title || !newAssignment.dueDate) {
    alert('과제명과 마감일을 입력해주세요.');
    return;
  }

  try {
    await addDoc(collection(db, 'assignments'), {
      title: newAssignment.title,
      description: newAssignment.description,
      dueDate: newAssignment.dueDate,
      subject: newAssignment.subject,
      createdAt: new Date().toISOString()
    });

    setNewAssignment({
      title: '',
      description: '',
      dueDate: '',
      subject: '국어'
    });
    
    alert('과제가 추가되었습니다.');
  } catch (error) {
    alert('과제 추가 실패: ' + error.message);
  }
};
    
    alert('시험이 추가되었습니다.');
  } catch (error) {
    alert('시험 추가 실패: ' + error.message);
  }
};

const handleDeleteExam = async (examId) => {
  if (!confirm('정말 이 시험을 삭제하시겠습니까?')) {
    return;
  }

  try {
    const examsRef = collection(db, 'exams');
    const snapshot = await getDocs(examsRef);
    const examDoc = snapshot.docs.find(doc => doc.id === examId);
    
    if (examDoc) {
      await deleteDoc(doc(db, 'exams', examDoc.id));
      setExams(exams.filter(e => e.id !== examId));
      alert('시험이 삭제되었습니다.');
    } else {
      alert('시험을 찾을 수 없습니다.');
    }
  } catch (error) {
    alert('시험 삭제 실패: ' + error.message);
  }
};

  const handleUpdateExam = (examId) => {
    setExams(exams.map(exam => exam.id === examId ? editingExam : exam));
    setEditingExam(null);
    alert('시험 정보가 수정되었습니다!');
  };

  const generateFeedback = (weakTypes, typeStats) => {
    if (weakTypes.length === 0) {
      return "모든 영역에서 우수한 성적을 보였습니다! 현재 수준을 유지하세요.";
    }

    const feedbackMap = {
      '사실적 이해': '지문에 직접 제시된 내용을 정확히 파악하는 연습이 필요합니다.',
      '추론적 이해': '글의 숨은 의미와 작가의 의도를 파악하는 능력이 부족합니다.',
      '비판적 이해': '글의 논리와 주장을 평가하는 능력을 키워야 합니다.',
      '어휘/문법': '어휘력과 문법 지식이 부족합니다.',
      '문학 감상': '작품의 정서와 분위기를 이해하는 능력이 필요합니다.',
      '작품 분석': '작품의 표현 기법과 구조를 분석하는 연습이 필요합니다.'
    };

    let feedback = "약점 영역 분석\n\n";
    
    weakTypes.forEach((stat, index) => {
      feedback += `${index + 1}. ${stat.type} (정답률 ${stat.correctRate}%)\n`;
      feedback += `   - ${feedbackMap[stat.type]}\n\n`;
    });

    return feedback;
  };

  const handleGradeExam = async () => {
    const exam = exams.find(e => e.id === selectedExam);
    if (!exam) return;

    let totalScore = 0;
    const results = [];
    const typeStats = {};

    for (let i = 0; i < exam.totalQuestions; i++) {
      const isCorrect = studentAnswers[i] === exam.answers[i];
      const questionType = exam.types[i];
      
      if (isCorrect) {
        totalScore += exam.scores[i];
      }
      
      results.push({
        questionNum: i + 1,
        studentAnswer: studentAnswers[i],
        correctAnswer: exam.answers[i],
        isCorrect,
        score: isCorrect ? exam.scores[i] : 0,
        type: questionType
      });

      if (!typeStats[questionType]) {
        typeStats[questionType] = { total: 0, correct: 0, incorrect: 0 };
      }
      typeStats[questionType].total++;
      if (isCorrect) {
        typeStats[questionType].correct++;
      } else {
        typeStats[questionType].incorrect++;
      }
    }

    const weakTypes = Object.entries(typeStats)
      .map(([type, stats]) => ({
        type,
        correctRate: (stats.correct / stats.total * 100).toFixed(1),
        ...stats
      }))
      .filter(stat => stat.correctRate < 70)
      .sort((a, b) => a.correctRate - b.correctRate);

    const feedback = generateFeedback(weakTypes, typeStats);

    const maxScore = exam.scores.reduce((a, b) => a + b, 0);
    const result = {
      examId: exam.id,
      examTitle: exam.title,
      date: new Date().toISOString().split('T')[0],
      totalScore,
      maxScore,
      percentage: ((totalScore / maxScore) * 100).toFixed(1),
      results,
      typeStats,
      weakTypes,
      feedback
    };

    setExamResult(result);

  if (currentUser.type === 'student') {
  try {
    // Firestore에서 학생 문서 찾기
    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);
    const studentDoc = snapshot.docs.find(doc => doc.data().id === currentUser.id);
    
    if (studentDoc) {
      // 기존 시험 결과에 새 결과 추가
      const studentData = studentDoc.data();
      const updatedExams = [...(studentData.exams || []), result];
      
      // Firestore 업데이트
      await updateDoc(doc(db, 'students', studentDoc.id), {
        exams: updatedExams
      });
      
      // 로컬 상태도 업데이트
      setCurrentUser({ ...currentUser, exams: updatedExams });
    }
  } catch (error) {
    console.error('채점 결과 저장 실패:', error);
    alert('채점 결과 저장에 실패했습니다.');
  }
} 
  };

  const handleOMRUpload = async (file) => {
  if (!file) return;
  
  setIsProcessing(true);
  
  // 이미지 미리보기
  const reader = new FileReader();
  reader.onload = (e) => {
    setOmrImage(e.target.result);
  };
  reader.readAsDataURL(file);
  
  try {
    // Tesseract.js로 OMR 인식
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('kor');
    
    // 이미지에서 텍스트 인식 (테스트)
    const { data: { text } } = await worker.recognize(file);
    console.log('인식된 텍스트:', text);
    
    // 임시: 기본 답안 배열 생성
    const answers = Array(selectedExam.totalQuestions).fill('');
    setRecognizedAnswers(answers);
    setStudentAnswers(answers);
    
    await worker.terminate();
    alert('OMR 이미지가 업로드되었습니다. 답안을 확인하고 수정하세요.');
  } catch (error) {
    console.error('OMR 인식 실패:', error);
    alert('OMR 인식에 실패했습니다: ' + error.message);
  } finally {
    setIsProcessing(false);
  }
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    setCurrentUser(null);
    setActiveTab('problem');
  } catch (error) {
    alert('로그아웃 실패: ' + error.message);
  }
};

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const exam = exams.find(e => e.id === batchGrading.selectedExam);
    if (!exam) return;

    const newOMRs = [];

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileName = file.name.replace(/\.(jpg|jpeg|png|gif)$/i, '');
        
        let matchedStudent = null;
        
        const nameBirthPattern = /(.+)_(\d{4})/;
        const match = fileName.match(nameBirthPattern);
        
        if (match) {
          const [, name, birthDate] = match;
          matchedStudent = students.find(s => 
            s.name.toLowerCase().includes(name.toLowerCase()) && 
            s.birthDate === birthDate
          );
        }
        
        if (!matchedStudent) {
          matchedStudent = students.find(s => 
            fileName.toLowerCase().includes(s.id.toLowerCase()) ||
            fileName.toLowerCase().includes(s.name.toLowerCase())
          );
        }

        const omr = {
          id: Date.now() + index,
          studentId: matchedStudent?.id || '',
          studentName: matchedStudent?.name || '미매칭',
          studentBirthDate: matchedStudent?.birthDate || '',
          imagePreview: reader.result,
          fileName: file.name,
          answers: Array(exam.totalQuestions).fill(''),
          autoMatched: !!matchedStudent
        };

        newOMRs.push(omr);

        if (newOMRs.length === files.length) {
          setBatchGrading({
            ...batchGrading,
            omrList: [...batchGrading.omrList, ...newOMRs]
          });
          alert(`${files.length}개의 OMR이 업로드되었습니다.`);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const updateOMRStudent = (omrId, studentId) => {
    const student = students.find(s => s.id === studentId);
    setBatchGrading({
      ...batchGrading,
      omrList: batchGrading.omrList.map(omr => 
        omr.id === omrId ? { ...omr, studentId, studentName: student?.name || '미매칭', studentBirthDate: student?.birthDate || '' } : omr
      )
    });
  };

  const handleBatchGrade = () => {
    if (batchGrading.omrList.length === 0) {
      alert('채점할 OMR이 없습니다.');
      return;
    }

    const exam = exams.find(e => e.id === batchGrading.selectedExam);
    if (!exam) return;

    let gradedCount = 0;

    const updatedStudents = students.map(student => {
      const studentOMR = batchGrading.omrList.find(omr => omr.studentId === student.id);
      if (!studentOMR) return student;

      let totalScore = 0;
      const results = [];
      const typeStats = {};

      for (let i = 0; i < exam.totalQuestions; i++) {
        const isCorrect = studentOMR.answers[i] === exam.answers[i];
        const questionType = exam.types[i];
        
        if (isCorrect) {
          totalScore += exam.scores[i];
        }
        
        results.push({
          questionNum: i + 1,
          studentAnswer: studentOMR.answers[i],
          correctAnswer: exam.answers[i],
          isCorrect,
          score: isCorrect ? exam.scores[i] : 0,
          type: questionType
        });

        if (!typeStats[questionType]) {
          typeStats[questionType] = { total: 0, correct: 0, incorrect: 0 };
        }
        typeStats[questionType].total++;
        if (isCorrect) {
          typeStats[questionType].correct++;
        } else {
          typeStats[questionType].incorrect++;
        }
      }

      const weakTypes = Object.entries(typeStats)
        .map(([type, stats]) => ({
          type,
          correctRate: (stats.correct / stats.total * 100).toFixed(1),
          ...stats
        }))
        .filter(stat => stat.correctRate < 70)
        .sort((a, b) => a.correctRate - b.correctRate);

      const feedback = generateFeedback(weakTypes, typeStats);

      const maxScore = exam.scores.reduce((a, b) => a + b, 0);
      const result = {
        examId: exam.id,
        examTitle: exam.title,
        date: new Date().toISOString().split('T')[0],
        totalScore,
        maxScore,
        percentage: ((totalScore / maxScore) * 100).toFixed(1),
        results,
        typeStats,
        weakTypes,
        feedback
      };

      gradedCount++;

      return { ...student, exams: [...student.exams, result] };
    });

    setStudents(updatedStudents);
    
    setBatchGrading({
      selectedExam: null,
      omrList: []
    });

    alert(`총 ${gradedCount}명의 학생이 채점되었습니다!`);
  };

  const removeOMR = (omrId) => {
    setBatchGrading({
      ...batchGrading,
      omrList: batchGrading.omrList.filter(omr => omr.id !== omrId)
    });
  };

  const updateOMRAnswers = (omrId, answers) => {
    setBatchGrading({
      ...batchGrading,
      omrList: batchGrading.omrList.map(omr => 
        omr.id === omrId ? { ...omr, answers } : omr
      )
    });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white border-opacity-30">
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-white bg-opacity-20 rounded-2xl mb-4">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">학습 관리 시스템</h1>
              <p className="text-white text-opacity-90 text-sm">스마트한 학습 관리의 시작</p>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-white text-opacity-90">아이디</label>
                <input
                  type="text"
                  value={loginForm.id}
                  onChange={(e) => setLoginForm({...loginForm, id: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-3 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 text-white placeholder-white placeholder-opacity-60"
                  placeholder="아이디를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white text-opacity-90">비밀번호</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-3 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 text-white placeholder-white placeholder-opacity-60"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-white text-purple-600 py-3.5 rounded-xl hover:bg-opacity-90 transition-all font-semibold shadow-lg"
              >
                로그인
              </button>
            </div>
            
            <div className="mt-8 p-4 bg-white bg-opacity-10 rounded-2xl border border-white border-opacity-20">
              <p className="text-xs text-white text-opacity-80 text-center mb-2 font-medium">테스트 계정</p>
              <div className="space-y-1 text-xs text-white text-opacity-70 text-center">
                <p>관리자: admin / admin123</p>
                <p>학생: student1 / pass123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.type === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">관리자 대시보드</h1>
              <p className="text-indigo-100 text-sm mt-1">학습 관리 시스템</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition backdrop-blur-sm border border-white border-opacity-30"
            >
              <LogOut size={20} />
              로그아웃
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex gap-2 mb-8 overflow-x-auto bg-white rounded-xl p-2 shadow-sm">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'students' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              학생 관리
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'videos' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              동영상 관리
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'exams' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              시험 관리
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'batch' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              일괄 채점
            </button>
            <button
  onClick={() => setActiveTab('homework')}
  className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
    activeTab === 'homework'
      ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg transform scale-105'
      : 'text-gray-700 hover:bg-gray-100'
  }`}
>
  숙제 관리
</button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === 'stats' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              성적 통계
            </button>
          </div>

          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">새 학생 추가</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="학생 이름"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="학년 (예: 중3)"
                    value={newStudent.grade}
                    onChange={(e) => setNewStudent({...newStudent, grade: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="전화번호 (예: 010-1234-5678)"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="생일 4자리 (예: 0315)"
                    value={newStudent.birthDate}
                    onChange={(e) => setNewStudent({...newStudent, birthDate: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    maxLength="4"
                  />
                  <input
                    type="text"
                    placeholder="아이디"
                    value={newStudent.id}
                    onChange={(e) => setNewStudent({...newStudent, id: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={newStudent.password}
                    onChange={(e) => setNewStudent({...newStudent, password: e.target.value})}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={handleAddStudent}
                    className="col-span-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition-all"
                  >
                    학생 추가
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">등록된 학생 목록</h2>
                <div className="space-y-3">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
                          <User className="text-white" size={24} />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{student.name}</p>
                          <p className="text-sm text-gray-600">
                            {student.grade} | 생일: {student.birthDate} | ID: {student.id}
                          </p>
                          <p className="text-xs text-gray-500">{student.phone}</p>
                        </div>
                      </div>
                      <button
  onClick={() => handleDeleteStudent(student.id)}
  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
>
  삭제
</button>
                      <div className="px-4 py-2 bg-white rounded-lg shadow-sm">
                        <p className="text-xs text-gray-500">응시 횟수</p>
                        <p className="text-xl font-bold text-indigo-600">{student.exams?.length || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">새 동영상 추가</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="과목 (예: 수학)"
                      value={newVideo.subject}
                      onChange={(e) => setNewVideo({...newVideo, subject: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="단원 (예: 이차방정식)"
                      value={newVideo.unit}
                      onChange={(e) => setNewVideo({...newVideo, unit: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="동영상 제목"
                    value={newVideo.title}
                    onChange={(e) => setNewVideo({...newVideo, title: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="url"
                    placeholder="YouTube URL"
                    value={newVideo.url}
                    onChange={(e) => setNewVideo({...newVideo, url: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button 
                    onClick={handleAddVideo}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition-all"
                  >
                    동영상 추가
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">등록된 동영상</h2>
                <div className="space-y-3">
                  {videos.map((video) => (
                    <div key={video.id} className="p-5 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                          <Video className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{video.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{video.subject} - {video.unit}</p>
                          <p className="text-xs text-gray-500 mt-1">등록일: {video.uploadDate}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">새 시험 등록</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="시험 제목"
                    value={newExam.title}
                    onChange={(e) => setNewExam({...newExam, title: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="date"
                      value={newExam.date}
                      onChange={(e) => setNewExam({...newExam, date: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={newExam.subject}
                      onChange={(e) => setNewExam({...newExam, subject: e.target.value})}
                      className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="국어">국어</option>
                      <option value="수학">수학</option>
                      <option value="영어">영어</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">문제 수 (1-100)</label>
                    <input
                      type="number"
                      value={newExam.totalQuestions}
                      onChange={(e) => updateExamQuestions(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      min="1"
                      max="100"
                    />
                  </div>
                  
                  <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
                    <h3 className="font-semibold text-lg mb-4">정답, 배점 및 유형 입력</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                      {[...Array(newExam.totalQuestions)].map((_, i) => (
                        <div key={i} className="border-2 border-gray-300 rounded-lg p-3 bg-white">
                          <label className="text-xs font-semibold text-gray-700 block mb-2">{i + 1}번</label>
                          <select
                            value={newExam.answers[i]}
                            onChange={(e) => {
                              const newAnswers = [...newExam.answers];
                              newAnswers[i] = e.target.value;
                              setNewExam({...newExam, answers: newAnswers});
                            }}
                            className="w-full px-2 py-2 border rounded-lg text-sm mb-2 focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">정답</option>
                            <option value="1">①</option>
                            <option value="2">②</option>
                            <option value="3">③</option>
                            <option value="4">④</option>
                            <option value="5">⑤</option>
                          </select>
                          <input
                            type="number"
                            value={newExam.scores[i]}
                            onChange={(e) => {
                              const newScores = [...newExam.scores];
                              newScores[i] = parseInt(e.target.value) || 0;
                              setNewExam({...newExam, scores: newScores});
                            }}
                            className="w-full px-2 py-2 border rounded-lg text-sm mb-2 focus:ring-2 focus:ring-indigo-500"
                            placeholder="배점"
                          />
                          <select
                            value={newExam.types[i]}
                            onChange={(e) => {
                              const newTypes = [...newExam.types];
                              newTypes[i] = e.target.value;
                              setNewExam({...newExam, types: newTypes});
                            }}
                            className="w-full px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          >
                            {questionTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium text-gray-700">
                        총 {newExam.totalQuestions}문항 | 만점 {newExam.scores.reduce((a, b) => a + b, 0)}점
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={handleAddExam}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                  >
                    시험 등록하기
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">등록된 시험 목록</h2>
                <div className="space-y-3">
                  {exams.map((exam) => (
                    <div key={exam.id} className="p-5 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl hover:shadow-md transition-all">
                      {editingExam?.id === exam.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingExam.title}
                            onChange={(e) => setEditingExam({...editingExam, title: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateExam(exam.id)}
                              className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => setEditingExam(null)}
                              className="px-5 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                              <FileText className="text-white" size={24} />
                            </div>
                            <div>
                              <p className="font-semibold text-lg">{exam.title}</p>
                              <p className="text-sm text-gray-600 mt-1">{exam.subject} | {exam.date}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                총 {exam.totalQuestions}문항 | 만점 {exam.scores.reduce((a, b) => a + b, 0)}점
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setEditingExam({...exam})}
                            className="p-3 text-gray-600 hover:bg-white rounded-lg transition"
                          >
                            <Edit2 size={20} />
                          </button>
                          <button
  onClick={() => handleDeleteExam(exam.id)}
  className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition"
>
  삭제
</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'batch' && (
            <div className="space-y-6">
              {!batchGrading.selectedExam ? (
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">일괄 채점할 시험 선택</h2>
                  <div className="space-y-3">
                    {exams.map((exam) => (
                      <button
                        key={exam.id}
                        onClick={() => setBatchGrading({ ...batchGrading, selectedExam: exam.id, omrList: [] })}
                        className="w-full p-5 bg-gradient-to-r from-gray-50 to-blue-50 hover:shadow-md rounded-xl text-left transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl">
                            <FileText className="text-white" size={24} />
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{exam.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{exam.subject} | {exam.date}</p>
                            <p className="text-xs text-gray-500 mt-1">총 {exam.totalQuestions}문항</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          {exams.find(e => e.id === batchGrading.selectedExam)?.title}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">OMR 답안지를 업로드하세요</p>
                      </div>
                      <button
                        onClick={() => setBatchGrading({ selectedExam: null, omrList: [] })}
                        className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition text-sm font-medium"
                      >
                        ← 시험 선택으로
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-8 bg-gradient-to-br from-blue-50 to-indigo-50 text-center">
                      <Upload className="mx-auto text-indigo-600 mb-4" size={64} />
                      <h3 className="font-bold text-xl mb-2 text-gray-800">OMR 이미지 업로드</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        한 번에 여러 장 선택 가능
                      </p>
                      <label className="inline-block cursor-pointer bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-lg transition-all font-medium">
                        파일 선택
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {batchGrading.omrList.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                      <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        업로드된 OMR ({batchGrading.omrList.length}명)
                      </h3>
                      
                      <div className="space-y-4">
                        {batchGrading.omrList.map((omr) => (
                          <div key={omr.id} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-r from-gray-50 to-blue-50">
                            <div className="flex items-start gap-4">
                              <img 
                                src={omr.imagePreview} 
                                alt="OMR"
                                className="w-24 h-24 object-contain border-2 border-gray-300 rounded-lg bg-white shadow-sm"
                              />
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-2 font-medium">{omr.fileName}</p>
                                <select
                                  value={omr.studentId}
                                  onChange={(e) => updateOMRStudent(omr.id, e.target.value)}
                                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                  <option value="">학생 선택</option>
                                  {students.map(student => (
                                    <option key={student.id} value={student.id}>
                                      {student.name} ({student.birthDate})
                                    </option>
                                  ))}
                                </select>
                                
                                <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                                  <p className="text-xs font-semibold mb-2 text-gray-700">답안 입력</p>
                                  <div className="grid grid-cols-8 gap-1 max-h-24 overflow-y-auto">
                                    {[...Array(exams.find(e => e.id === batchGrading.selectedExam)?.totalQuestions || 0)].map((_, i) => (
                                      <select
                                        key={i}
                                        value={omr.answers[i] || ''}
                                        onChange={(e) => {
                                          const newAnswers = [...omr.answers];
                                          newAnswers[i] = e.target.value;
                                          updateOMRAnswers(omr.id, newAnswers);
                                        }}
                                        className="px-1 py-1 border rounded text-xs"
                                      >
                                        <option value="">{i + 1}</option>
                                        <option value="1">①</option>
                                        <option value="2">②</option>
                                        <option value="3">③</option>
                                        <option value="4">④</option>
                                        <option value="5">⑤</option>
                                      </select>
                                    ))}
                                  </div>
                                </div>
                                
                                <button
                                  onClick={() => removeOMR(omr.id)}
                                  className="mt-3 text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition text-sm font-medium"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleBatchGrade}
                        disabled={batchGrading.omrList.some(omr => !omr.studentId)}
                        className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 transition-all font-bold text-lg"
                      >
                        전체 일괄 채점 ({batchGrading.omrList.length}명)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">학생별 성적 통계</h2>
                
                {/* 전체 평균 통계 */}
                {students.some(s => s.exams && s.exams.length > 0) && (
                  <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">전체 평균</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">평균 점수</p>
                        <p className="text-3xl font-bold text-indigo-600">
                          {(() => {
                            const allExams = students.flatMap(s => s.exams || []);
                            if (allExams.length === 0) return '0';
                            const avg = allExams.reduce((sum, e) => sum + e.totalScore, 0) / allExams.length;
                            return avg.toFixed(1);
                          })()}점
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">평균 정답률</p>
                        <p className="text-3xl font-bold text-green-600">
                          {(() => {
                            const allExams = students.flatMap(s => s.exams || []);
                            if (allExams.length === 0) return '0';
                            const avg = allExams.reduce((sum, e) => sum + parseFloat(e.percentage), 0) / allExams.length;
                            return avg.toFixed(1);
                          })()}%
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-xl shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">총 응시 횟수</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {students.reduce((sum, s) => sum + (s.exams?.length || 0), 0)}회
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'homework' && (
  <div className="space-y-6">
    {/* 과제 추가 폼 */}
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
        새 과제 추가
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="과제명"
          value={newAssignment.title}
          onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        
        <select
          value={newAssignment.subject}
          onChange={(e) => setNewAssignment({...newAssignment, subject: e.target.value})}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="국어">국어</option>
          <option value="영어">영어</option>
          <option value="수학">수학</option>
          <option value="과학">과학</option>
          <option value="사회">사회</option>
        </select>
        
        <input
          type="date"
          value={newAssignment.dueDate}
          onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>
      
      <textarea
        placeholder="과제 설명"
        value={newAssignment.description}
        onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
        className="w-full p-3 border border-gray-300 rounded-lg mt-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
        rows="3"
      />
      
      <button
        onClick={handleAddAssignment}
        className="mt-4 px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
      >
        과제 추가
      </button>
    </div>

    {/* 과제 목록 */}
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
        과제 목록
      </h2>
      
      {assignments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">등록된 과제가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="border-2 border-gray-200 rounded-xl p-6 hover:border-green-400 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{assignment.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{assignment.subject} | 마감일: {assignment.dueDate}</p>
                  {assignment.description && (
                    <p className="text-gray-700 mt-2">{assignment.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
)}

{activeTab === 'students' && (
                <div className="space-y-6">
                  {students.map((student) => (
                    <div key={student.id} className="border-2 border-gray-200 rounded-2xl p-6 bg-gradient-to-r from-gray-50 to-purple-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                            <User className="text-white" size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl">{student.name}</h3>
                            <p className="text-sm text-gray-600">{student.grade}</p>
                          </div>
                        </div>
                        <div className="text-center px-5 py-3 bg-white rounded-xl shadow-sm">
                          <p className="text-xs text-gray-500">응시 횟수</p>
                          <p className="text-2xl font-bold text-purple-600">{student.exams?.length || 0}</p>
                        </div>
                      </div>

                      {student.exams && student.exams.length > 0 ? (
                        <>
                          {/* 학생 평균 */}
                          <div className="mb-4 p-4 bg-white rounded-xl">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-600 mb-1">평균 점수</p>
                                <p className="text-2xl font-bold text-indigo-600">
                                  {(student.exams.reduce((sum, e) => sum + e.totalScore, 0) / student.exams.length).toFixed(1)}점
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 mb-1">평균 정답률</p>
                                <div className="flex items-end gap-2">
                                  <p className="text-2xl font-bold text-green-600">
                                    {(student.exams.reduce((sum, e) => sum + parseFloat(e.percentage), 0) / student.exams.length).toFixed(1)}%
                                  </p>
                                  {/* 프로그레스 바 */}
                                  <div className="flex-1 mb-1">
                                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                                        style={{
                                          width: `${(student.exams.reduce((sum, e) => sum + parseFloat(e.percentage), 0) / student.exams.length)}%`
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 시험 목록 */}
                          <div className="space-y-3">
                            {student.exams.map((exam, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition">
                                <div className="flex-1">
                                  <p className="font-semibold text-base">{exam.examTitle}</p>
                                  <p className="text-xs text-gray-500 mt-1">{exam.date}</p>
                                  {/* 점수 프로그레스 바 */}
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-gray-600">점수</span>
                                      <span className="text-xs font-semibold text-gray-700">{exam.totalScore} / {exam.maxScore}</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                        style={{
                                          width: `${exam.percentage}%`
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-bold text-2xl text-indigo-600">{exam.totalScore}점</p>
                                  <p className="text-sm text-gray-600">{exam.percentage}%</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-center py-4">응시한 시험이 없습니다.</p>
                      )}
                    </div>
                  ))}
                </div>
          )}
        
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">{currentUser.name}님 환영합니다</h1>
            <p className="text-indigo-100 text-sm mt-1">{currentUser.grade}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition"
          >
            <LogOut size={20} />
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8 overflow-x-auto bg-white rounded-xl p-2 shadow-sm">
          <button
            onClick={() => setActiveTab('problem')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'problem' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            문제 분석
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'video' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            동영상 학습
          </button>
          <button
            onClick={() => setActiveTab('omr')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'omr' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            OMR 채점
          </button>
          <button
            onClick={() => setActiveTab('mypage')}
            className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === 'mypage' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            내 성적
          </button>
        </div>

        {activeTab === 'omr' && (
          <div className="space-y-6">
            {!selectedExam ? (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">시험 선택</h2>
                <div className="space-y-3">
                  {exams.map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => {
                        setSelectedExam(exam.id);
                        setStudentAnswers(Array(exam.totalQuestions).fill(''));
                        setExamResult(null);
                      }}
                      className="w-full p-5 bg-gradient-to-r from-gray-50 to-indigo-50 hover:shadow-md rounded-xl text-left transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                          <FileText className="text-white" size={24} />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{exam.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{exam.subject} | {exam.date}</p>
                          <p className="text-xs text-gray-500 mt-1">총 {exam.totalQuestions}문항</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {selectedExam && !examResult && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mt-6">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                OMR 자동 채점
              </h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleOMRUpload(e.target.files[0])}
                  className="hidden"
                  id="omr-upload"
                />
                <label htmlFor="omr-upload" className="cursor-pointer">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-lg font-semibold text-gray-700">OMR 이미지 업로드</p>
                  <p className="text-sm text-gray-500 mt-2">클릭하거나 파일을 드래그하세요</p>
                </label>
              </div>
            </div>
          )}
                </div>
              </div>
            ) : examResult ? (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">채점 결과</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl p-6 text-center text-white shadow-lg">
                      <p className="text-sm opacity-90 mb-2">총점</p>
                      <p className="text-4xl font-bold">{examResult.totalScore}점</p>
                      <p className="text-sm opacity-75 mt-1">/ {examResult.maxScore}점</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-6 text-center text-white shadow-lg">
                      <p className="text-sm opacity-90 mb-2">정답률</p>
                      <p className="text-4xl font-bold">{examResult.percentage}%</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-6 text-center text-white shadow-lg">
                      <p className="text-sm opacity-90 mb-2">맞은 문항</p>
                      <p className="text-4xl font-bold">
                        {examResult.results.filter(r => r.isCorrect).length}개
                      </p>
                      <p className="text-sm opacity-75 mt-1">/ {examResult.results.length}개</p>
                    </div>
                  </div>

                  <div className="mb-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border-2 border-yellow-200">
                    <h3 className="font-bold text-xl mb-4 text-gray-800">유형별 분석</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(examResult.typeStats).map(([type, stats]) => {
                        const rate = ((stats.correct / stats.total) * 100).toFixed(1);
                        return (
                          <div key={type} className={`p-4 rounded-xl border-2 transition-all ${
                            rate < 70 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'
                          }`}>
                            <p className="font-semibold text-sm mb-1">{type}</p>
                            <p className="text-xs text-gray-600 mb-1">
                              {stats.correct}/{stats.total} 정답
                            </p>
                            <p className={`text-2xl font-bold ${
                              rate < 70 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {rate}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {examResult.feedback && (
                    <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                      <h3 className="font-bold text-xl mb-4 text-gray-800">학습 피드백</h3>
                      <div className="text-sm whitespace-pre-line text-gray-700 leading-relaxed">{examResult.feedback}</div>
                    </div>
                  )}

                  <h3 className="font-bold text-xl mb-4">문항별 결과</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
                    {examResult.results.map((result) => (
                      <div
                        key={result.questionNum}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          result.isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {result.isCorrect ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <XCircle size={16} className="text-red-600" />
                          )}
                          <span className="font-bold text-sm">{result.questionNum}번</span>
                        </div>
                        <p className="text-xs">내 답: {result.studentAnswer || '-'}</p>
                        <p className="text-xs">정답: {result.correctAnswer}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedExam(null);
                    setExamResult(null);
                    setStudentAnswers([]);
                  }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
                >
                  다른 시험 보기
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="mb-6">
                  <button
                    onClick={() => setSelectedExam(null)}
                    className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg transition mb-3 font-medium"
                  >
                    ← 시험 목록으로
                  </button>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {exams.find(e => e.id === selectedExam)?.title}
                  </h2>
                </div>

                <div className="border-2 border-gray-200 rounded-xl p-6 mb-6 bg-gray-50">
                  <h3 className="font-semibold text-lg mb-4">답안 입력</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-96 overflow-y-auto">
                    {studentAnswers.map((_, i) => (
                      <div key={i}>
                        <label className="text-xs text-gray-600 font-medium block mb-1">{i + 1}번</label>
                        <select
                          value={studentAnswers[i]}
                          onChange={(e) => {
                            const newAnswers = [...studentAnswers];
                            newAnswers[i] = e.target.value;
                            setStudentAnswers(newAnswers);
                          }}
                          className="w-full px-2 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="">-</option>
                          <option value="1">①</option>
                          <option value="2">②</option>
                          <option value="3">③</option>
                          <option value="4">④</option>
                          <option value="5">⑤</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGradeExam}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg disabled:from-gray-300 disabled:to-gray-400"
                  disabled={!studentAnswers.some(a => a !== '')}
                >
                  채점하기
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mypage' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">내 성적 기록</h2>
            {currentUser.exams && currentUser.exams.length > 0 ? (
              <div className="space-y-6">
                {currentUser.exams.map((exam, idx) => (
                  <div key={idx} className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-r from-gray-50 to-purple-50 hover:shadow-lg transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-xl">{exam.examTitle}</p>
                        <p className="text-sm text-gray-600 mt-1">{exam.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-indigo-600">{exam.totalScore}점</p>
                        <p className="text-sm text-gray-600">{exam.percentage}%</p>
                      </div>
                    </div>
                    <button
  onClick={() => handleDeleteExam(exam.id)}
  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
>
  삭제
</button>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-4 rounded-xl text-white">
                        <p className="text-xs opacity-90">정답</p>
                        <p className="font-bold text-2xl mt-1">
                          {exam.results.filter(r => r.isCorrect).length}문항
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-red-500 to-pink-500 p-4 rounded-xl text-white">
                        <p className="text-xs opacity-90">오답</p>
                        <p className="font-bold text-2xl mt-1">
                          {exam.results.filter(r => !r.isCorrect).length}문항
                        </p>
                      </div>
                    </div>
                    
                    {exam.typeStats && (
                      <div className="pt-4 border-t-2 border-gray-200">
                        <p className="text-sm font-semibold mb-3 text-gray-700">유형별 성적</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(exam.typeStats).map(([type, stats]) => {
                            const rate = ((stats.correct / stats.total) * 100).toFixed(1);
                            return (
                              <div key={type} className="text-xs p-3 bg-white rounded-lg border shadow-sm">
                                <p className="font-semibold text-gray-700">{type}</p>
                                <p className="text-gray-600 mt-1">{stats.correct}/{stats.total} ({rate}%)</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {exam.weakTypes && exam.weakTypes.length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-sm border-2 border-yellow-200">
                        <p className="font-semibold text-yellow-800">약점 유형:</p>
                        <p className="text-yellow-700 mt-1">
                          {exam.weakTypes.map(w => `${w.type} (${w.correctRate}%)`).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="inline-block p-6 bg-gray-100 rounded-full mb-4">
                  <FileText className="text-gray-400" size={48} />
                </div>
                <p className="text-gray-500 text-lg">아직 응시한 시험이 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'problem' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">문제 분석 요청</h2>
            <p className="text-gray-600 mb-6">틀린 문제 사진을 업로드하면 AI가 자동으로 분석해드립니다.</p>
            <div className="p-12 border-2 border-dashed border-indigo-300 rounded-2xl text-center bg-gradient-to-br from-blue-50 to-indigo-50 hover:border-indigo-400 transition-all">
              <Upload className="mx-auto text-indigo-600 mb-4" size={64} />
              <p className="text-base text-gray-700 font-medium mb-2">이미지를 업로드하세요</p>
              <p className="text-sm text-gray-500">클릭하거나 파일을 드래그하세요</p>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">학습 동영상</h2>
            <div className="space-y-4">
              {videos.map((video) => (
                <div key={video.id} className="p-5 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl hover:shadow-md transition-all">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl">
                      <Video className="text-white" size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">{video.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{video.subject} - {video.unit}</p>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                      >
                        동영상 보기 →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}