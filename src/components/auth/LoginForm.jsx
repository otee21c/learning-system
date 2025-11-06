import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            오늘의 국어 연구소
          </h1>
          <p className="text-gray-600">학습 관리 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              아이디
            </label>
            <input
              type="text"
              value={loginForm.id}
              onChange={(e) => setLoginForm({ ...loginForm, id: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="아이디를 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl hover:shadow-lg transition-all font-semibold text-lg"
          >
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
