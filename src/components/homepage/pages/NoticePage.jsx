import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth, storage } from '../../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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

  // 이미지 관련 상태
  const [editImages, setEditImages] = useState([]); // [{url, storagePath}]
  const [imageUploading, setImageUploading] = useState(false);

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

  const handleNew = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditImages([]);
    setIsEditing(true);
  };

  const handleEdit = (notice) => {
    setEditingId(notice.id);
    setEditTitle(notice.title);
    setEditContent(notice.content);
    setEditImages(notice.images || []);
    setIsEditing(true);
    setSelectedNotice(null);
  };

  // 이미지 업로드 처리
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImageUploading(true);

    try {
      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, `notice-images/${fileName}`);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        uploadedImages.push({
          url: url,
          storagePath: `notice-images/${fileName}`
        });
      }

      setEditImages(prev => [...prev, ...uploadedImages]);
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
      e.target.value = ''; // 파일 input 초기화
    }
  };

  // 이미지 삭제
  const handleRemoveImage = async (index) => {
    const imageToRemove = editImages[index];
    
    try {
      // Storage에서 삭제 시도
      if (imageToRemove.storagePath) {
        const storageRef = ref(storage, imageToRemove.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }
    } catch (error) {
      console.log('Storage 삭제 실패 (무시됨):', error);
    }

    // 상태에서 제거
    setEditImages(prev => prev.filter((_, i) => i !== index));
  };

  // 본문에 이미지 삽입
  const insertImageToContent = (imageUrl) => {
    const imageTag = `[이미지:${imageUrl}]`;
    setEditContent(prev => prev + '\n' + imageTag + '\n');
  };

  const handleSave = async () => {
    try {
      const saveData = {
        title: editTitle,
        content: editContent,
        images: editImages,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'notices', editingId), saveData);
      } else {
        saveData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'notices'), saveData);
      }
      setIsEditing(false);
      fetchNotices();
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        // 관련 이미지도 삭제
        const notice = noticeList.find(n => n.id === id);
        if (notice?.images) {
          for (const img of notice.images) {
            if (img.storagePath) {
              const storageRef = ref(storage, img.storagePath);
              await deleteObject(storageRef).catch(() => {});
            }
          }
        }

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

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleView = (notice) => {
    setSelectedNotice(notice);
  };

  const handleBack = () => {
    setSelectedNotice(null);
  };

  // 내용 렌더링 (이미지 태그 처리)
  const renderContent = (content) => {
    if (!content) return null;
    
    const parts = content.split(/(\[이미지:[^\]]+\])/g);
    
    return parts.map((part, index) => {
      const imageMatch = part.match(/\[이미지:([^\]]+)\]/);
      if (imageMatch) {
        return (
          <div key={index} className="hp-content-inline-image">
            <img src={imageMatch[1]} alt="첨부 이미지" />
          </div>
        );
      }
      
      // 일반 텍스트 처리
      return part.split('\n').map((line, lineIndex) => (
        <p key={`${index}-${lineIndex}`}>{line || <br />}</p>
      ));
    });
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
              <li><Link to="/news">입시 정보</Link></li>
              <li><Link to="/notice" className="hp-active">공지 사항</Link></li>
              <li><Link to="/contact">문자 상담</Link></li>
              <li><Link to="/lms" className="hp-highlight">회원 전용</Link></li>
            </ul>
          </nav>
        </div>
      </header>

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

              {/* 이미지 업로드 영역 */}
              <div className="hp-image-upload-section">
                <div className="hp-image-upload-header">
                  <span>📷 이미지 첨부</span>
                  <label className="hp-btn hp-btn-secondary hp-btn-small">
                    {imageUploading ? '업로드 중...' : '이미지 추가'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={imageUploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                
                {editImages.length > 0 && (
                  <div className="hp-image-preview-grid">
                    {editImages.map((img, idx) => (
                      <div key={idx} className="hp-image-preview-item">
                        <img src={img.url} alt={`첨부 ${idx + 1}`} />
                        <div className="hp-image-preview-actions">
                          <button
                            type="button"
                            onClick={() => insertImageToContent(img.url)}
                            className="hp-btn-icon"
                            title="본문에 삽입"
                          >
                            📝
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="hp-btn-icon hp-btn-danger-icon"
                            title="삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="hp-image-hint">💡 이미지를 업로드한 후 📝 버튼을 클릭하면 본문에 삽입됩니다.</p>
              </div>

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
                {renderContent(selectedNotice.content)}
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
                        <td>
                          {notice.title}
                          {notice.images && notice.images.length > 0 && (
                            <span className="hp-image-badge">📷</span>
                          )}
                        </td>
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
