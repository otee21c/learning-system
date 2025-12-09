import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../Homepage.css';

export default function NoticePage() {
  const [noticeList, setNoticeList] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState(null);

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
  const fetchNotices = async () => {
    try {
      const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNoticeList(data);
    } catch (error) {
      console.error('Error fetching notices:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // 새 글 작성
  const handleNew = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setIsEditing(true);
  };

  // 수정
  const handleEdit = (notice) => {
    setEditingId(notice.id);
    setEditTitle(notice.title);
    setEditContent(notice.content);
    setIsEditing(true);
    setSelectedNotice(null);
  };

  // 저장
  const handleSave = async () => {
    try {
      if (editingId) {
        await updateDoc(doc(db, 'notices', editingId), {
          title: editTitle,
          content: editContent,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'notices'), {
          title: editTitle,
          content: editContent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      setIsEditing(false);
      fetchNotices();
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 삭제
  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'notices', id));
        fetchNotices();
        setSelectedNotice(null);
        alert('삭제되었습니다.');
      } catch (error) {
        console.error('Error deleting:', error);
        alert('삭제에 실패했습니다.');
      }
    }
  };

  // 취소
  const handleCancel = () => {
    setIsEditing(false);
  };

  // 상세 보기
  const handleView = (notice) => {
    setSelectedNotice(notice);
  };

  // 목록으로
  const handleBack = () => {
    setSelectedNotice(null);
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
              <li><Link to="/notice" className="hp-active">공지 사항</Link></li>
              <li><Link to="/contact">문자 상담</Link></li>
              <li><Link to="/lms" className="hp-highlight">회원 전용</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* 페이지 내용 */}
      <div className="hp-page-container">
        <div className="hp-page-header">
          <h1>공지 사항</h1>
          {isAdmin && !isEditing && !selectedNotice && (
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
          ) : selectedNotice ? (
            <div className="hp-content-view">
              <button onClick={handleBack} className="hp-btn hp-btn-back">← 목록으로</button>
              <h2>{selectedNotice.title}</h2>
              <p className="hp-content-date">
                {new Date(selectedNotice.createdAt).toLocaleDateString('ko-KR')}
              </p>
              <div className="hp-content-body">
                {selectedNotice.content.split('\n').map((line, index) => (
                  <p key={index}>{line || <br />}</p>
                ))}
              </div>
              {isAdmin && (
                <div className="hp-admin-buttons">
                  <button onClick={() => handleEdit(selectedNotice)} className="hp-btn hp-btn-primary">수정</button>
                  <button onClick={() => handleDelete(selectedNotice.id)} className="hp-btn hp-btn-danger">삭제</button>
                </div>
              )}
            </div>
          ) : (
            <div className="hp-list">
              {noticeList.length > 0 ? (
                <table className="hp-table">
                  <thead>
                    <tr>
                      <th>번호</th>
                      <th>제목</th>
                      <th>작성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticeList.map((notice, index) => (
                      <tr key={notice.id} onClick={() => handleView(notice)}>
                        <td>{noticeList.length - index}</td>
                        <td>{notice.title}</td>
                        <td>{new Date(notice.createdAt).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="hp-no-content">아직 작성된 공지사항이 없습니다.</p>
              )}
            </div>
          )}
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
