import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth, storage } from '../../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import '../Homepage.css';

export default function NewsPage() {
  const [newsList, setNewsList] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);

  // 이미지 관련 상태
  const [editThumbnail, setEditThumbnail] = useState(null); // 대표 이미지 {url, storagePath}
  const [editImages, setEditImages] = useState([]); // 본문 이미지 [{url, storagePath}]
  const [imageUploading, setImageUploading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

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
    setEditThumbnail(null);
    setEditImages([]);
    setIsEditing(true);
  };

  const handleEdit = (news) => {
    setEditingId(news.id);
    setEditTitle(news.title);
    setEditContent(news.content);
    // 기존 이미지 URL도 호환
    if (news.thumbnail) {
      setEditThumbnail(news.thumbnail);
    } else if (news.image) {
      setEditThumbnail({ url: news.image, storagePath: null });
    } else {
      setEditThumbnail(null);
    }
    setEditImages(news.images || []);
    setIsEditing(true);
    setSelectedNews(null);
  };

  // 대표 이미지 업로드
  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnailUploading(true);

    try {
      const fileName = `${Date.now()}_thumb_${file.name}`;
      const storageRef = ref(storage, `news-images/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // 기존 대표 이미지가 있으면 삭제
      if (editThumbnail?.storagePath) {
        const oldRef = ref(storage, editThumbnail.storagePath);
        await deleteObject(oldRef).catch(() => {});
      }

      setEditThumbnail({
        url: url,
        storagePath: `news-images/${fileName}`
      });
    } catch (error) {
      console.error('대표 이미지 업로드 실패:', error);
      alert('대표 이미지 업로드에 실패했습니다.');
    } finally {
      setThumbnailUploading(false);
      e.target.value = '';
    }
  };

  // 대표 이미지 삭제
  const handleRemoveThumbnail = async () => {
    if (editThumbnail?.storagePath) {
      try {
        const storageRef = ref(storage, editThumbnail.storagePath);
        await deleteObject(storageRef).catch(() => {});
      } catch (error) {
        console.log('Storage 삭제 실패 (무시됨):', error);
      }
    }
    setEditThumbnail(null);
  };

  // 본문 이미지 업로드
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImageUploading(true);

    try {
      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, `news-images/${fileName}`);
        
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        
        uploadedImages.push({
          url: url,
          storagePath: `news-images/${fileName}`
        });
      }

      setEditImages(prev => [...prev, ...uploadedImages]);
    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  // 본문 이미지 삭제
  const handleRemoveImage = async (index) => {
    const imageToRemove = editImages[index];
    
    if (imageToRemove.storagePath) {
      try {
        const storageRef = ref(storage, imageToRemove.storagePath);
        await deleteObject(storageRef).catch(() => {});
      } catch (error) {
        console.log('Storage 삭제 실패 (무시됨):', error);
      }
    }

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
        thumbnail: editThumbnail,
        image: editThumbnail?.url || '', // 기존 호환성
        images: editImages,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'news', editingId), saveData);
      } else {
        saveData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'news'), saveData);
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
        const news = newsList.find(n => n.id === id);
        
        // 대표 이미지 삭제
        if (news?.thumbnail?.storagePath) {
          const thumbRef = ref(storage, news.thumbnail.storagePath);
          await deleteObject(thumbRef).catch(() => {});
        }
        
        // 본문 이미지들 삭제
        if (news?.images) {
          for (const img of news.images) {
            if (img.storagePath) {
              const imgRef = ref(storage, img.storagePath);
              await deleteObject(imgRef).catch(() => {});
            }
          }
        }

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
      
      return part.split('\n').map((line, lineIndex) => (
        <p key={`${index}-${lineIndex}`}>{line || <br />}</p>
      ));
    });
  };

  // 뉴스 카드의 썸네일 URL 가져오기
  const getThumbnailUrl = (news) => {
    if (news.thumbnail?.url) return news.thumbnail.url;
    if (news.image) return news.image;
    return null;
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

              {/* 대표 이미지 업로드 */}
              <div className="hp-image-upload-section">
                <div className="hp-image-upload-header">
                  <span>🖼️ 대표 이미지 (카드에 표시됨)</span>
                  <label className="hp-btn hp-btn-secondary hp-btn-small">
                    {thumbnailUploading ? '업로드 중...' : editThumbnail ? '변경' : '선택'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      disabled={thumbnailUploading}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                
                {editThumbnail && (
                  <div className="hp-thumbnail-preview">
                    <img src={editThumbnail.url} alt="대표 이미지" />
                    <button
                      type="button"
                      onClick={handleRemoveThumbnail}
                      className="hp-btn-icon hp-btn-danger-icon"
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* 본문 이미지 업로드 */}
              <div className="hp-image-upload-section">
                <div className="hp-image-upload-header">
                  <span>📷 본문 이미지</span>
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
          ) : selectedNews ? (
            <div className="hp-content-view">
              <button onClick={handleBack} className="hp-btn hp-btn-back">← 목록으로</button>
              <h2>{selectedNews.title}</h2>
              <p className="hp-content-date">
                {new Date(selectedNews.createdAt).toLocaleDateString('ko-KR')}
              </p>
              {getThumbnailUrl(selectedNews) && (
                <img src={getThumbnailUrl(selectedNews)} alt={selectedNews.title} className="hp-content-image" />
              )}
              <div className="hp-content-body">
                {renderContent(selectedNews.content)}
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
                      {getThumbnailUrl(news) ? (
                        <img src={getThumbnailUrl(news)} alt={news.title} />
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
