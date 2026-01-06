import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import BannerSlider from './components/BannerSlider';
import './Homepage.css';

// 기본 배너 데이터 (Firebase에 데이터 없을 때 사용)
const defaultBanners = [
  {
    id: 'default1',
    category: '교과디렉션',
    title: '2년째 국어 반타작',
    result: '내신 원점수',
    highlight: '30점 이상 상승!',
    info: '- 특목고 2학년 -'
  },
  {
    id: 'default2',
    category: '수능솔루션',
    title: '국어 모의 만년 4등급',
    result: '2023 불수능',
    highlight: '2등급 안착!',
    info: '- 8학군 재수생 -'
  },
  {
    id: 'default3',
    category: '교과디렉션',
    title: '국어 3등급 정체',
    result: '내신 평균',
    highlight: '1등급 달성!',
    info: '- 강남 고2 -'
  },
  {
    id: 'default4',
    category: '수능솔루션',
    title: '6월 모의 5등급',
    result: '수능 국어',
    highlight: '1등급 달성!',
    info: '- 대치 재수생 -'
  },
  {
    id: 'default5',
    category: '교과디렉션',
    title: '국어 60점대 고정',
    result: '기말고사',
    highlight: '90점 돌파!',
    info: '- 중3 학생 -'
  },
  {
    id: 'default6',
    category: '수능솔루션',
    title: '독서 영역 취약',
    result: '수능 국어',
    highlight: '만점 달성!',
    info: '- N수생 -'
  }
];

export default function Homepage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [banners, setBanners] = useState([]);
  const [showBannerManager, setShowBannerManager] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState({
    category: '교과디렉션',
    title: '',
    result: '',
    highlight: '',
    info: ''
  });

  // 스크롤 애니메이션을 위한 ref
  const branchesRef = useRef(null);
  const programBannerRef = useRef(null);
  const contactRef = useRef(null);
  const bannerSliderRef = useRef(null);

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

  // 배너 데이터 불러오기
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const q = query(collection(db, 'banners'), orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > 0) {
          setBanners(data);
        } else {
          setBanners(defaultBanners);
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
        setBanners(defaultBanners);
      }
    };
    fetchBanners();
  }, []);

  // 스크롤 애니메이션 효과
  useEffect(() => {
    // 약간의 지연 후 애니메이션 시작 (페이지 로드 후)
    const timer = setTimeout(() => {
      const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
      };

      const observerCallback = (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('hp-animate-visible');
            // 카드에 흔들기 애니메이션 추가
            if (entry.target.classList.contains('hp-animate-card')) {
              setTimeout(() => {
                entry.target.classList.add('hp-shake');
              }, 800);
            }
          }
        });
      };

      const observer = new IntersectionObserver(observerCallback, observerOptions);

      // 관찰할 요소들 등록
      const elementsToObserve = [
        branchesRef.current,
        programBannerRef.current,
        contactRef.current,
        bannerSliderRef.current
      ];

      elementsToObserve.forEach((el) => {
        if (el) observer.observe(el);
      });

      // 지점 카드들 관찰 (개별적으로)
      const cards = document.querySelectorAll('.hp-branch-card');
      cards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.2}s`;
        observer.observe(card);
      });

      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 배너 저장
  const handleSaveBanner = async () => {
    if (!bannerForm.title || !bannerForm.highlight) {
      alert('제목과 성과는 필수입니다.');
      return;
    }

    try {
      if (editingBanner && !editingBanner.id.startsWith('default')) {
        // Firebase에 저장된 배너 수정
        await updateDoc(doc(db, 'banners', editingBanner.id), {
          ...bannerForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        // 새 배너 추가 (기본 배너 수정 시에도 새로 추가)
        await addDoc(collection(db, 'banners'), {
          ...bannerForm,
          createdAt: new Date().toISOString()
        });
      }
      
      // 목록 새로고침
      const q = query(collection(db, 'banners'), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBanners(data.length > 0 ? data : defaultBanners);
      
      // 초기화
      setEditingBanner(null);
      setBannerForm({ category: '교과디렉션', title: '', result: '', highlight: '', info: '' });
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 배너 삭제
  const handleDeleteBanner = async (banner) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      if (banner.id.startsWith('default')) {
        // 기본 배너는 목록에서만 제거 (새로고침하면 다시 나타남)
        // Firebase에 빈 데이터라도 저장해서 기본 배너 안 보이게
        const newBanners = banners.filter(b => b.id !== banner.id);
        setBanners(newBanners);
        
        // 남은 배너들을 Firebase에 저장 (기본 배너 제외)
        if (newBanners.filter(b => !b.id.startsWith('default')).length === 0 && newBanners.length > 0) {
          // 기본 배너만 남았다면, 남은 기본 배너들을 Firebase에 저장
          for (const b of newBanners) {
            if (b.id.startsWith('default')) {
              await addDoc(collection(db, 'banners'), {
                category: b.category,
                title: b.title,
                result: b.result,
                highlight: b.highlight,
                info: b.info,
                createdAt: new Date().toISOString()
              });
            }
          }
          // 다시 불러오기
          const q = query(collection(db, 'banners'), orderBy('createdAt', 'asc'));
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setBanners(data);
        }
      } else {
        // Firebase에서 삭제
        await deleteDoc(doc(db, 'banners', banner.id));
        
        // 목록 새로고침
        const q = query(collection(db, 'banners'), orderBy('createdAt', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBanners(data.length > 0 ? data : defaultBanners);
      }
      
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting banner:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 배너 수정 모드
  const handleEditBanner = (banner) => {
    setEditingBanner(banner);
    setBannerForm({
      category: banner.category,
      title: banner.title,
      result: banner.result,
      highlight: banner.highlight,
      info: banner.info
    });
  };

  // 배너 폼 초기화
  const handleCancelEdit = () => {
    setEditingBanner(null);
    setBannerForm({ category: '교과디렉션', title: '', result: '', highlight: '', info: '' });
  };

  // 모든 기본 배너를 Firebase로 마이그레이션
  const handleMigrateToFirebase = async () => {
    if (!window.confirm('현재 배너들을 저장하시겠습니까? (저장 후에는 자유롭게 수정/삭제할 수 있습니다)')) return;
    
    try {
      // 기본 배너들을 Firebase에 저장
      for (const banner of banners) {
        if (banner.id.startsWith('default')) {
          await addDoc(collection(db, 'banners'), {
            category: banner.category,
            title: banner.title,
            result: banner.result,
            highlight: banner.highlight,
            info: banner.info,
            createdAt: new Date().toISOString()
          });
        }
      }
      
      // 다시 불러오기
      const q = query(collection(db, 'banners'), orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBanners(data);
      
      alert('저장되었습니다. 이제 자유롭게 수정/삭제할 수 있습니다.');
    } catch (error) {
      console.error('Error migrating banners:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 기본 배너인지 확인
  const hasDefaultBanners = banners.some(b => b.id.startsWith('default'));

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

      {/* 히어로 섹션 */}
      <section className="hp-hero">
        <h1>오늘의 국어 연구소</h1>
        <p>실전적 국어 원리로 진짜 실력을 만들어 갑니다</p>
      </section>

      {/* 배너 슬라이더 (성적 향상 사례) */}
      <section className="hp-banner-section hp-animate-section" ref={bannerSliderRef}>
        {isAdmin && (
          <div className="hp-banner-admin-toggle">
            <button 
              onClick={() => setShowBannerManager(!showBannerManager)}
              className="hp-btn hp-btn-secondary"
            >
              {showBannerManager ? '배너 관리 닫기' : '⚙️ 배너 관리'}
            </button>
          </div>
        )}

        {/* 배너 관리 패널 (관리자 전용) */}
        {isAdmin && showBannerManager && (
          <div className="hp-banner-manager">
            <h3>{editingBanner ? '배너 수정' : '새 배너 추가'}</h3>
            
            {/* 기본 배너 마이그레이션 안내 */}
            {hasDefaultBanners && (
              <div className="hp-banner-migrate-notice">
                <p>💡 현재 기본 배너를 사용 중입니다. 아래 버튼을 클릭하면 저장되어 자유롭게 수정/삭제할 수 있습니다.</p>
                <button onClick={handleMigrateToFirebase} className="hp-btn hp-btn-primary">
                  배너 저장하기
                </button>
              </div>
            )}
            
            <div className="hp-banner-form">
              <div className="hp-form-row">
                <label>카테고리</label>
                <input 
                  type="text"
                  value={bannerForm.category}
                  onChange={(e) => setBannerForm({...bannerForm, category: e.target.value})}
                  placeholder="예: 교과디렉션, 수능솔루션"
                />
              </div>
              
              <div className="hp-form-row">
                <label>상황 (전)</label>
                <input 
                  type="text" 
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm({...bannerForm, title: e.target.value})}
                  placeholder="예: 국어 모의 만년 4등급"
                />
              </div>
              
              <div className="hp-form-row">
                <label>시험/과목</label>
                <input 
                  type="text" 
                  value={bannerForm.result}
                  onChange={(e) => setBannerForm({...bannerForm, result: e.target.value})}
                  placeholder="예: 2023 불수능"
                />
              </div>
              
              <div className="hp-form-row">
                <label>성과 (후)</label>
                <input 
                  type="text" 
                  value={bannerForm.highlight}
                  onChange={(e) => setBannerForm({...bannerForm, highlight: e.target.value})}
                  placeholder="예: 2등급 안착!"
                />
              </div>
              
              <div className="hp-form-row">
                <label>학생 정보</label>
                <input 
                  type="text" 
                  value={bannerForm.info}
                  onChange={(e) => setBannerForm({...bannerForm, info: e.target.value})}
                  placeholder="예: - 8학군 재수생 -"
                />
              </div>
              
              <div className="hp-form-buttons">
                <button onClick={handleSaveBanner} className="hp-btn hp-btn-primary">
                  {editingBanner ? '수정 완료' : '추가'}
                </button>
                {editingBanner && (
                  <button onClick={handleCancelEdit} className="hp-btn hp-btn-secondary">
                    취소
                  </button>
                )}
              </div>
            </div>

            {/* 배너 목록 */}
            <div className="hp-banner-list">
              <h4>현재 배너 목록 ({banners.length}개)</h4>
              {banners.map((banner, index) => (
                <div key={banner.id} className="hp-banner-list-item">
                  <span className="hp-banner-list-num">{index + 1}</span>
                  <span className="hp-banner-list-category">{banner.category}</span>
                  <span className="hp-banner-list-title">{banner.title} → {banner.highlight}</span>
                  <div className="hp-banner-list-actions">
                    <button onClick={() => handleEditBanner(banner)} className="hp-btn-small">수정</button>
                    <button onClick={() => handleDeleteBanner(banner)} className="hp-btn-small hp-btn-danger">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <BannerSlider banners={banners} />
      </section>

      {/* 프로그램 소개 띠 */}
      <section className="hp-program-banner hp-animate-section" ref={programBannerRef}>
        <div className="hp-program-banner-content">
          <p className="hp-subtitle">CONSULTING PROGRAM</p>
          <h2>오늘의 국어 연구소에서 만들었습니다.</h2>
          <p className="hp-desc">단 하나의 컨설팅 프로그램, <strong>[실전적 국어 원리]</strong></p>
          <p className="hp-desc">학생 개개인의 현재 실력을 정확히 진단하고, 맞춤형 학습 전략을 수립하여 목표 달성까지 함께 합니다.</p>
        </div>
      </section>

      {/* 지점 섹션 (브랜치 카드) */}
      <section className="hp-branches hp-animate-section" ref={branchesRef}>
        {/* 가로 3개: 광진원 - 연구소 - 배곧원 */}
        <div className="hp-branches-row">
          {/* 광진원 */}
          <a href="https://m.blog.naver.com/today_personal" target="_blank" rel="noopener noreferrer" className="hp-branch-card hp-sub hp-animate-card">
            <div className="hp-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
              </svg>
            </div>
            <h3>광진원</h3>
            <p className="hp-location">서울 광진구</p>
            <p className="hp-description">퍼스널 진단과 목표 달성</p>
            <span className="hp-blog-link">
              블로그 보기
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </span>
          </a>

          {/* 대치 연구소 - 클릭 가능 */}
          <Link to="/daechi" className="hp-branch-card hp-main hp-clickable hp-animate-card">
            <div className="hp-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
              </svg>
            </div>
            <h3>대치 연구소</h3>
            <p className="hp-location">서울 강남구 대치동</p>
            <p className="hp-description">오늘의 국어 연구소 본원입니다.<br />단 하나의 컨설팅 프로그램으로<br />실전적 국어 원리를 가르칩니다.</p>
            <span className="hp-detail-link">자세히 보기</span>
          </Link>

          {/* 배곧원 */}
          <a href="https://m.blog.naver.com/today_korea" target="_blank" rel="noopener noreferrer" className="hp-branch-card hp-sub hp-animate-card">
            <div className="hp-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
              </svg>
            </div>
            <h3>배곧원</h3>
            <p className="hp-location">경기 시흥시 배곧</p>
            <p className="hp-description">오늘의 국어학원</p>
            <span className="hp-blog-link">
              블로그 보기
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </span>
          </a>
        </div>

        {/* 청년다락방 - 클릭 가능 */}
        <div className="hp-branch-bottom">
          <div className="hp-connector-line"></div>
          <Link to="/darakbang" className="hp-branch-card hp-mini hp-clickable hp-animate-card">
            <p className="hp-mini-line">오늘의 국어가 실천하는</p>
            <p className="hp-mini-line">사회적 가치 창조 공간</p>
            <p className="hp-mini-line hp-mini-highlight">청년 다락방</p>
          </Link>
        </div>
      </section>

      {/* 연락처 */}
      <section className="hp-contact hp-animate-section" ref={contactRef}>
        <h2>궁금한 점은 언제나 문의해 주세요</h2>
        <div className="hp-contact-info">
          <div className="hp-phone-number">02-562-5559</div>
          <p className="hp-phone-sub">(통합 번호)</p>

          <div className="hp-contact-details">
            <div className="hp-contact-item">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              월~금 오후 3시~9시
            </div>
            <div className="hp-contact-item">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              토~일 오전 10시~오후 6시
            </div>
          </div>

          <p className="hp-contact-note">
            문자로도 가능합니다. (홈페이지 상단 메뉴 [문자 상담]에 남겨주시길 바랍니다.)
          </p>
        </div>
      </section>

      {/* 푸터 */}
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
