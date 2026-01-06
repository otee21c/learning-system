import React from 'react';
import { User, FileText, Video, CheckCircle, BookOpen, Bell, Calendar, Users, BarChart3, Brain, ClipboardList, LayoutDashboard, MessageCircle, FolderOpen, HelpCircle, Target } from 'lucide-react';

export default function Navigation({ currentUser, activeTab, setActiveTab }) {
  // 관리자 탭 메뉴
  const adminTabs = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
    { id: 'students', label: '학생 관리', icon: User },
    { id: 'exams', label: '시험 관리', icon: FileText },
    { id: 'videos', label: '동영상 관리', icon: Video },
    { id: 'omr', label: 'OMR 채점', icon: CheckCircle },
    { id: 'statistics', label: '성적 통계', icon: BarChart3 },
    { id: 'homework', label: '숙제 관리', icon: BookOpen },
    { id: 'workbook-analysis', label: '교재 분석', icon: Target },
    { id: 'question-manager', label: '질문 관리', icon: MessageCircle },
    { id: 'notification', label: '알림 발송', icon: Bell },
    { id: 'curriculum', label: '커리큘럼', icon: Calendar },
    { id: 'attendance', label: '출석 관리', icon: Users },
    { id: 'report', label: '진단 리포트', icon: ClipboardList },
    { id: 'problem-solver', label: '오늘의 문제 풀이', icon: Brain },
    { id: 'learning-materials', label: '학습자료', icon: FolderOpen },
  ];

  // 학생 탭 메뉴
  const studentTabs = [
    { id: 'exam', label: '시험 보기', icon: FileText },
    { id: 'homework', label: '숙제', icon: BookOpen },
    { id: 'video-learning', label: '동영상 학습', icon: Video },
    { id: 'concept-question', label: '개념과 지문', icon: MessageCircle },
    { id: 'problem-solving', label: '문제 풀이', icon: HelpCircle },
    { id: 'mypage', label: '내 성적', icon: User },
  ];

  const tabs = currentUser.type === 'admin' ? adminTabs : studentTabs;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-2">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-medium ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
