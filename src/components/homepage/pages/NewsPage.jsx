import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../Homepage.css';

export default function NewsPage() {
  const [newsList, setNewsList] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImage, setEditImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);

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

  const fetchNews = async () => {
    try {
      const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNewsList(data);
    } catch (error) {
      console.error('Error fetching news:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleNew = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditImage('');
    setIsEditing(true);
  };

  const handleEdit = (news) => {
    setEditingId(news.id);
    setEditTitle(news.title);
    setEditContent(news.content);
    setEditImage(news.image || '');
    setIsEditing(true);
    setSelectedNews(null);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDoc(doc(db, 'news', editingId), {
          title: editTitle,
          content: editContent,
          image: editImage,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'news'), {
          title: editTitle,
          content: editContent,
          image: editImage,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setIsEditing(false);
      fetchNews();
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'news', id));
        fetchNews();
        setSelectedNews(null);
        alert('삭제되었습니다.');
      } catch (error) {
        console.error('Error deleting:', error);
        alert('삭제에 실패했습니다.');
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleView = (news) => {
    setSelectedNews(news);
  };

  const handleBack = () => {
    setSelectedNews(null);
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
              <li><Link to="/about">오국 소개</Link></li>
              <li><Link to="/news" className="hp-active">입시 정보</Link></li>
              <li><Link to="/notice">공지 사항</Link></li>
              <li><Link to="/contact">문자 상담</Link></li>
              <li><Link to="/lms" className="hp-highlight">회원 전용</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <div className="hp-page-container">
        <div className="hp-page-header">
          <h1>입시 정보</h1>
          {isAdmin && !isEditing && !selectedNews && (
            <button onClick={handleNew} className="hp-btn hp-btn-primary">새 글 작성</button>
          )}
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
              <input
                type="text"
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
                className="hp-editor-image"
                placeholder="대표 이미지 URL (선택사항)"
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
          ) : selectedNews ? (
            <div className="hp-content-view">
              <button onClick={handleBack} className="hp-btn hp-btn-back">← 목록으로</button>
              <h2>{selectedNews.title}</h2>
              <p className="hp-content-date">
                {new Date(selectedNews.createdAt).toLocaleDateString('ko-KR')}
              </p>
              {selectedNews.image && (
                <img src={selectedNews.image} alt={selectedNews.title} className="hp-content-image" />
              )}
              <div className="hp-content-body">
                {selectedNews.content.split('\n').map((line, index) => (
                  <p key={index}>{line || <br />}</p>
                ))}
              </div>
              {isAdmin && (
                <div className="hp-admin-buttons">
                  <button onClick={() => handleEdit(selectedNews)} className="hp-btn hp-btn-primary">수정</button>
                  <button onClick={() => handleDelete(selectedNews.id)} className="hp-btn hp-btn-danger">삭제</button>
                </div>
              )}
            </div>
          ) : (
            <div className="hp-card-grid">
              {newsList.length > 0 ? (
                newsList.map((news) => (
                  <div key={news.id} className="hp-card" onClick={() => handleView(news)}>
                    <div className="hp-card-image">
                      {news.image ? (
                        <img src={news.image} alt={news.title} />
                      ) : (
                        <div className="hp-card-placeholder">
                          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="hp-card-content">
                      <h3>{news.title}</h3>
                      <p className="hp-card-date">
                        {new Date(news.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="hp-no-content">아직 작성된 입시 정보가 없습니다.</p>
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
