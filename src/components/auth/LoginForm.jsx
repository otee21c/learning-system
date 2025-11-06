import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { BookOpen } from 'lucide-react';

export default function LoginForm() {
  const [loginForm, setLoginForm] = useState({ id: '', password: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      // 관리자 로그인
      if (loginForm.id === 'admin') {
        await signInWithEmailAndPassword(auth, 'admin@test.com', loginForm.password);
        return;
      }

      // 학생 로그인 - 학생 ID로 이메일 생성
      const email = `${loginForm.id}@student.com`;
      
      // Firebase Auth로 로그인 시도
      await signInWithEmailAndPassword(auth, email, loginForm.password);
      
    } catch (error) {
      console.error('로그인 오류:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        alert('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else if (error.code === 'auth/invalid-email') {
        alert('올바른 아이디 형식이 아닙니다.');
      } else {
        alert('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 메인 카드 */}
        <div className="text-center mb-8">
          {/* 책 아이콘 */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl mb-6">
            <BookOpen className="w-12 h-12 text-white" strokeWidth={2} />
          </div>
          
          {/* 타이틀 */}
          <h1 className="text-5xl font-bold text-white mb-3">
            오늘의 국어 연구소
          </h1>
          <p className="text-purple-100 text-xl">
            스마트한 학습 관리의 시작
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 아이디 입력 */}
          <div>
            <label className="block text-white text-sm font-medium mb-2 ml-1">
              아이디
            </label>
            <input
              type="text"
              value={loginForm.id}
              onChange={(e) => setLoginForm({ ...loginForm, id: e.target.value })}
              className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-2xl text-white placeholder-purple-200 focus:outline-none focus:border-white/60 transition-all"
              placeholder="아이디를 입력하세요"
              required
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-white text-sm font-medium mb-2 ml-1">
              비밀번호
            </label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full px-5 py-4 bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-2xl text-white placeholder-purple-200 focus:outline-none focus:border-white/60 transition-all"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            className="w-full bg-white text-purple-700 py-4 rounded-2xl hover:bg-purple-50 transition-all font-bold text-lg shadow-xl mt-6"
          >
            로그인
          </button>
        </form>

        {/* 하단 로고 */}
        <div className="mt-8 p-8 bg-white/10 backdrop-blur-sm rounded-3xl border-2 border-white/20">
          <div className="flex items-center justify-center">
            {/* 오늘의국어 로고 이미지 */}
            <img 
              src="/logo.png" 
              alt="오늘의 국어 연구소 로고" 
              className="h-48 w-48 object-contain drop-shadow-2xl" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
