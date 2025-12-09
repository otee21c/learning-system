import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../Homepage.css';

export default function DarakbangPage() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('청년 다락방');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);

  // 관리자 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === 'admin@test.com') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 데이터 불러오기
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const docRef = doc(db, 'pages', 'darakbang');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTitle(docSnap.data().title || '청년 다락방');
          setContent(docSnap.data().content || '');
        }
      } catch (error) {
        console.error('Error fetching darakbang:', error);
      }
      setLoading(false);
    };
    fetchContent();
  }, []);

  // 수정 시작
  const handleEdit = () => {
    setEditTitle(title);
    setEditContent(content);
    setIsEditing(true);
  };

  // 저장
  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'pages', 'darakbang'), {
        title: editTitle,
        content: editContent,
        updatedAt: new Date().toISOString()
      });
      setTitle(editTitle);
      setContent(editContent);
      setIsEditing(false);
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 취소
  const handleCancel = () => {
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="hp-page">
        <div className="hp-page-loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="homepage">
      {/* 헤더 */}
      <header className="hp-header">
        <div className="hp-header-container">
          <Link to="/" className="hp-logo">
            <img src="/logo.png" alt="오늘의 국어 연구소" />
          </Link>
          <nav className="hp-nav">
            <ul>
              <li><Link to="/">메인 화면</Link></li>
              <li><Link to="/about">오국 소개</Link></li>
              <li><Link to="/news">입시 정보</Link></li>
              <li><Link to="/notice">공지 사항</Link></li>
              <li><Link to="/contact">문자 상담</Link></li>
              <li><Link to="/lms" className="hp-highlight">회원 전용</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* 페이지 내용 */}
      <div className="hp-page-container">
        <div className="hp-page-header">
          <Link to="/" className="hp-btn hp-btn-back">← 메인으로</Link>
          <h1>청년 다락방</h1>
        </div>

        <div className="hp-page-content">
          <div className="hp-branch-detail hp-darakbang">
            <div className="hp-branch-detail-header hp-darakbang-header">
              <div className="hp-darakbang-title">
                <p>오늘의 국어가 실천하는</p>
                <p>사회적 가치 창조 공간</p>
                <h2>청년 다락방</h2>
              </div>
            </div>

            {isEditing ? (
              <div className="hp-editor">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="hp-editor-title"
                  placeholder="제목을 입력하세요"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="hp-editor-content"
                  placeholder="내용을 입력하세요"
                  rows={15}
                />
                <div className="hp-editor-buttons">
                  <button onClick={handleSave} className="hp-btn hp-btn-primary">저장</button>
                  <button onClick={handleCancel} className="hp-btn hp-btn-secondary">취소</button>
                </div>
              </div>
            ) : (
              <div className="hp-content-view">
                <h3>{title}</h3>
                <div className="hp-content-body">
                  {content ? (
                    content.split('\n').map((line, index) => (
                      <p key={index}>{line || <br />}</p>
                    ))
                  ) : (
                    <div className="hp-default-content">
                      <p>오늘의 국어가 실천하는 사회적 가치 창조 공간입니다.</p>
                      <br />
                      <p className="hp-no-content">관리자 로그인 후 내용을 수정할 수 있습니다.</p>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="hp-admin-buttons">
                    <button onClick={handleEdit} className="hp-btn hp-btn-primary">수정하기</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="hp-footer">
        <div className="hp-footer-content">
          <div className="hp-footer-info">
            <p><strong>오늘의 국어</strong></p>
            <p>대표: 김봉관 | 사업자등록번호: 296-93-02203</p>
            <p>주소: 서울시 강남구 도곡로73길 13, 1층 101호</p>
            <p>대표전화: 02-562-5559</p>
          </div>
          <p className="hp-footer-copyright">© 2024 오늘의 국어 연구소. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
