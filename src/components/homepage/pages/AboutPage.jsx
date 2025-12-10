import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../Homepage.css';

export default function AboutPage() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('오늘의 국어 연구소를 소개합니다');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const docRef = doc(db, 'pages', 'about');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTitle(docSnap.data().title || '오늘의 국어 연구소를 소개합니다');
          setContent(docSnap.data().content || '');
        }
      } catch (error) {
        console.error('Error fetching about:', error);
      }
      setLoading(false);
    };
    fetchContent();
  }, []);

  const handleEdit = () => {
    setEditTitle(title);
    setEditContent(content);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await setDoc(doc(db, 'pages', 'about'), {
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
      <header className="hp-header">
        <div className="hp-header-container">
          <Link to="/" className="hp-logo">
            <img src="/logo.png" alt="오늘의 국어 연구소" />
          </Link>
          <nav className="hp-nav">
            <ul>
              <li><Link to="/">메인 화면</Link></li>
              <li><Link to="/about" className="hp-active">오국 소개</Link></li>
              <li><Link to="/news">입시 정보</Link></li>
              <li><Link to="/notice">공지 사항</Link></li>
              <li><Link to="/contact">문자 상담</Link></li>
              <li><Link to="/lms" className="hp-highlight">회원 전용</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <div className="hp-page-container">
        <div className="hp-page-header">
          <h1>오국 소개</h1>
        </div>

        <div className="hp-page-content">
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
              <h2>{title}</h2>
              <div className="hp-content-body">
                {content ? (
                  content.split('\n').map((line, index) => (
                    <p key={index}>{line || <br />}</p>
                  ))
                ) : (
                  <p className="hp-no-content">아직 작성된 내용이 없습니다.</p>
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

      <footer className="hp-footer">
        <div className="hp-footer-content">
          <div className="hp-footer-info">
            <p><strong>오늘의 국어</strong></p>
            <p>대표: 김봉관 | 사업자등록번호: 296-93-02203 | 주소: 서울시 강남구 도곡로73길 13, 1층 101호</p>
          </div>
          <div className="hp-footer-info">
            <p><strong>오늘의 국어(퍼스널) 학원</strong></p>
            <p>대표: 문옥정 | 사업자등록번호: 761-93-00825 | 주소: 서울시 광진구 광나루로 586, 4층</p>
          </div>
          <p className="hp-footer-phone">대표전화: 02-562-5559</p>
          <div className="hp-footer-links">
            <Link to="/privacy">개인정보처리방침</Link>
          </div>
          <p className="hp-footer-copyright">© 2024 오늘의 국어 연구소. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
