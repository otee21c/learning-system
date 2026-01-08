import React, { useState, useEffect } from 'react';
import './index.css';
import { auth, db } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';

// Auth
import LoginForm from './components/auth/LoginForm';

// Admin Components
import StudentManager from './components/admin/StudentManager';
import StudentDashboard from './components/admin/StudentDashboard';
import ExamManager from './components/admin/ExamManager';
import VideoManager from './components/admin/VideoManager';
import OMRBatchGrading from './components/admin/OMRBatchGrading';
import StatisticsView from './components/admin/StatisticsView';
import HomeworkManager from './components/admin/HomeworkManager';
import QuestionManager from './components/admin/QuestionManager';
import NotificationManager from './components/admin/NotificationManager';
import CurriculumManager from './components/admin/CurriculumManager';
import AttendanceManager from './components/admin/AttendanceManager';
import ProblemSolver from './components/admin/ProblemSolver';
import ReportGenerator from './components/admin/ReportGenerator';
import LearningMaterialManager from './components/admin/LearningMaterialManager';
import WorkbookAnalysisManager from './components/admin/WorkbookAnalysisManager';
import { Home, MapPin } from 'lucide-react';

// Student Components
import ExamTaking from './components/student/ExamTaking';
import MyGrades from './components/student/MyGrades';
import HomeworkSubmission from './components/student/HomeworkSubmission';
import ConceptQuestion from './components/student/ConceptQuestion';
import ProblemSolving from './components/student/ProblemSolving';
import VideoLearning from './components/student/VideoLearning';

// Common
import Navigation from './components/common/Navigation';

// 지점 목록
const BRANCHES = [
  { id: 'gwangjin', name: '광진', color: 'from-blue-500 to-indigo-500' },
  { id: 'baegot', name: '배곧', color: 'from-emerald-500 to-teal-500' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 지점 선택 상태
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);

  // 전역 데이터 (모든 컴포넌트에서 필요한 것만)
  const [allStudents, setAllStudents] = useState([]); // 전체 학생
  const [students, setStudents] = useState([]); // 필터링된 학생
  const [exams, setExams] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [videos, setVideos] = useState([]);

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
            exams: studentData.exams || [],
            branch: studentData.branch || 'gwangjin' // 학생의 지점
          });
          setSelectedBranch(studentData.branch || 'gwangjin');
          setActiveTab('exam'); // 학생은 시험 탭으로
        } else {
          if (email === 'admin@test.com') {
            setCurrentUser({ type: 'admin', name: '관리자' });
            // 관리자는 지점 선택 화면 표시
            setShowBranchSelector(true);
            setActiveTab('dashboard');
          } else {
            await signOut(auth);
            setCurrentUser(null);
            alert('등록되지 않은 사용자입니다. 관리자에게 문의하세요.');
          }
        }
        setLoading(false);
      } else {
        setCurrentUser(null);
        setSelectedBranch(null);
        setShowBranchSelector(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Firestore 데이터 실시간 로드
  useEffect(() => {
    if (!currentUser) return;

    // 학생 데이터 (docId: Firebase 문서 ID, id: 학생 ID)
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        docId: doc.id,  // Firebase 문서 ID (수정/삭제에 사용)
        ...doc.data()   // 학생 데이터 (id: 학생 ID 포함)
      }));
      setAllStudents(data);
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

    return () => {
      unsubStudents();
      unsubExams();
      unsubHomeworks();
      unsubVideos();
    };
  }, [currentUser]);

  // 지점별 학생 필터링
  useEffect(() => {
    if (selectedBranch && allStudents.length > 0) {
      const filtered = allStudents.filter(s => {
        // branch가 없는 기존 학생은 '광진'으로 처리
        const studentBranch = s.branch || 'gwangjin';
        return studentBranch === selectedBranch;
      });
      setStudents(filtered);
    } else {
      setStudents(allStudents);
    }
  }, [selectedBranch, allStudents]);

  // 지점 선택
  const handleSelectBranch = (branchId) => {
    setSelectedBranch(branchId);
    setShowBranchSelector(false);
  };

  // 로그아웃
  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setSelectedBranch(null);
    setShowBranchSelector(false);
    setActiveTab('dashboard');
  };

  // 현재 선택된 지점 정보
  const currentBranch = BRANCHES.find(b => b.id === selectedBranch);

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

  // 관리자 지점 선택 화면
  if (currentUser.type === 'admin' && showBranchSelector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl mb-4">
              <MapPin className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">지점 선택</h1>
            <p className="text-gray-500 mt-2">관리할 지점을 선택해주세요</p>
          </div>

          <div className="space-y-4">
            {BRANCHES.map(branch => (
              <button
                key={branch.id}
                onClick={() => handleSelectBranch(branch.id)}
                className={`w-full p-6 bg-gradient-to-r ${branch.color} text-white rounded-2xl hover:shadow-lg transition-all transform hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-2xl font-bold">{branch.name}</p>
                  </div>
                  <MapPin size={32} className="text-white/80" />
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-6 py-3 text-gray-500 hover:text-gray-700 transition"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  오늘의 국어 연구소
                </h1>
                {/* 지점 표시 (관리자용) */}
                {currentUser.type === 'admin' && currentBranch && (
                  <button
                    onClick={() => setShowBranchSelector(true)}
                    className={`px-4 py-1.5 bg-gradient-to-r ${currentBranch.color} text-white rounded-full text-sm font-medium flex items-center gap-1.5 hover:shadow-md transition`}
                  >
                    <MapPin size={14} />
                    {currentBranch.name}
                  </button>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                {currentUser.name}님, 환영합니다!
                {currentUser.type === 'admin' && currentBranch && (
                  <span className="text-gray-400 ml-2">
                    ({currentBranch.name} 지점 · 학생 {students.length}명)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/"
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                <Home size={18} />
                홈페이지
              </a>
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                로그아웃
              </button>
            </div>
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
              {activeTab === 'dashboard' && <StudentDashboard students={students} branch={selectedBranch} />}
              {activeTab === 'students' && <StudentManager students={students} branch={selectedBranch} />}
              {activeTab === 'exams' && <ExamManager exams={exams} students={students} branch={selectedBranch} />}
              {activeTab === 'videos' && <VideoManager videos={videos} students={students} branch={selectedBranch} />}
              {activeTab === 'omr' && <OMRBatchGrading exams={exams} students={students} branch={selectedBranch} />}
              {activeTab === 'statistics' && <StatisticsView students={students} exams={exams} branch={selectedBranch} />}
              {activeTab === 'homework' && <HomeworkManager students={students} branch={selectedBranch} />}
              {activeTab === 'workbook-analysis' && <WorkbookAnalysisManager students={students} branch={selectedBranch} />}
              {activeTab === 'question-manager' && <QuestionManager branch={selectedBranch} />}
              {activeTab === 'notification' && <NotificationManager students={students} branch={selectedBranch} />}
              {activeTab === 'curriculum' && <CurriculumManager students={students} branch={selectedBranch} />}
              {activeTab === 'attendance' && <AttendanceManager students={students} branch={selectedBranch} />}
              {activeTab === 'report' && <ReportGenerator students={students} branch={selectedBranch} />}
              {activeTab === 'problem-solver' && <ProblemSolver />}
              {activeTab === 'learning-materials' && <LearningMaterialManager branch={selectedBranch} />}
            </>
          )}

          {/* 학생 탭 */}
          {currentUser.type === 'student' && (
            <>
              {activeTab === 'exam' && <ExamTaking currentUser={currentUser} exams={exams} />}
              {activeTab === 'homework' && <HomeworkSubmission currentUser={currentUser} homeworks={homeworks} />}
              {activeTab === 'video-learning' && <VideoLearning currentUser={currentUser} />}
              {activeTab === 'concept-question' && <ConceptQuestion currentUser={currentUser} />}
              {activeTab === 'problem-solving' && <ProblemSolving currentUser={currentUser} />}
              {activeTab === 'mypage' && <MyGrades currentUser={currentUser} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
