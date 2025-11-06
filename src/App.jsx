import React, { useState, useEffect } from 'react';
import './index.css';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';

// Auth
import LoginForm from './components/auth/LoginForm';

// Admin Components
import StudentManager from './components/admin/StudentManager';
import ExamManager from './components/admin/ExamManager';
import VideoManager from './components/admin/VideoManager';
import OMRBatchGrading from './components/admin/OMRBatchGrading';
import StatisticsView from './components/admin/StatisticsView';
import HomeworkManager from './components/admin/HomeworkManager';
import ProblemAssignmentManager from './components/admin/ProblemAssignmentManager';
import ProblemAnalysisManager from './components/admin/ProblemAnalysisManager';
import NotificationManager from './components/admin/NotificationManager';
import CurriculumManager from './components/admin/CurriculumManager';
import AttendanceManager from './components/admin/AttendanceManager';
import ProblemGenerator from './components/admin/ProblemGenerator';
import ProblemSolver from './components/admin/ProblemSolver';

// Student Components
import ExamTaking from './components/student/ExamTaking';
import MyGrades from './components/student/MyGrades';
import HomeworkSubmission from './components/student/HomeworkSubmission';
import ProblemAnalysis from './components/student/ProblemAnalysis';

// Common
import Navigation from './components/common/Navigation';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');

  // 전역 데이터 (모든 컴포넌트에서 필요한 것만)
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [videos, setVideos] = useState([]);
  const [problemAnalysisList, setProblemAnalysisList] = useState([]);

  // Firebase 인증 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email;
        const userId = email ? email.split('@')[0] : user.uid;
        
        // Firestore에서 사용자 정보 가져오기
        const studentsRef = collection(db, 'students');
        const snapshot = await getDocs(studentsRef);
        const studentDoc = snapshot.docs.find(doc => doc.data().id === userId);
        
        if (studentDoc) {
          const studentData = studentDoc.data();
          setCurrentUser({ 
            type: 'student', 
            id: studentData.id, 
            name: studentData.name, 
            exams: studentData.exams || [] 
          });
          setActiveTab('exam'); // 학생은 시험 탭으로
        } else {
          if (email === 'admin@test.com') {
            setCurrentUser({ type: 'admin', name: '관리자' });
            setActiveTab('students'); // 관리자는 학생 관리 탭으로
          } else {
            await signOut(auth);
            setCurrentUser(null);
            alert('등록되지 않은 사용자입니다. 관리자에게 문의하세요.');
          }
        }
        setLoading(false);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Firestore 데이터 실시간 로드
  useEffect(() => {
    if (!currentUser) return;

    // 학생 데이터
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) setStudents(data);
    });

    // 시험 데이터
    const unsubExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) setExams(data);
    });

    // 숙제 데이터
    const unsubHomeworks = onSnapshot(collection(db, 'assignments'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHomeworks(data);
    });

    // 동영상 데이터
    const unsubVideos = onSnapshot(collection(db, 'videos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) setVideos(data);
    });

    // 문제 분석 데이터
    const unsubProblemAnalysis = onSnapshot(collection(db, 'problemAnalysis'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProblemAnalysisList(data);
    });

    return () => {
      unsubStudents();
      unsubExams();
      unsubHomeworks();
      unsubVideos();
      unsubProblemAnalysis();
    };
  }, [currentUser]);

  // 로그아웃
  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setActiveTab('students');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                오늘의 국어 연구소
              </h1>
              <p className="text-gray-600 mt-1">
                {currentUser.name}님, 환영합니다!
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:shadow-lg transition-all font-medium"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 네비게이션 */}
        <Navigation 
          currentUser={currentUser} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        {/* 콘텐츠 영역 */}
        <div className="mt-8">
          {/* 관리자 탭 */}
          {currentUser.type === 'admin' && (
            <>
              {activeTab === 'students' && <StudentManager students={students} />}
              {activeTab === 'exams' && <ExamManager exams={exams} students={students} />}
              {activeTab === 'videos' && <VideoManager videos={videos} />}
              {activeTab === 'omr' && <OMRBatchGrading exams={exams} students={students} />}
              {activeTab === 'statistics' && <StatisticsView students={students} exams={exams} />}
              {activeTab === 'homework' && <HomeworkManager students={students} />}
              {activeTab === 'problem-assignment' && <ProblemAssignmentManager students={students} />}
              {activeTab === 'problem-analysis' && <ProblemAnalysisManager problemAnalysisList={problemAnalysisList} />}
              {activeTab === 'notification' && <NotificationManager students={students} />}
              {activeTab === 'curriculum' && <CurriculumManager />}
              {activeTab === 'attendance' && <AttendanceManager students={students} />}
              {activeTab === 'problem-generator' && <ProblemGenerator />}
              {activeTab === 'problem-solver' && <ProblemSolver />}
            </>
          )}

          {/* 학생 탭 */}
          {currentUser.type === 'student' && (
            <>
              {activeTab === 'exam' && <ExamTaking currentUser={currentUser} exams={exams} />}
              {activeTab === 'homework' && <HomeworkSubmission currentUser={currentUser} homeworks={homeworks} />}
              {activeTab === 'problem' && <ProblemAnalysis currentUser={currentUser} problemAnalysisList={problemAnalysisList} />}
              {activeTab === 'mypage' && <MyGrades currentUser={currentUser} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
