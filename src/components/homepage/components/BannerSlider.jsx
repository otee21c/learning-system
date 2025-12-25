import React, { useState, useEffect } from 'react';

// 성적 향상 사례 데이터
const defaultBanners = [
  {
    id: 1,
    category: '교과디렉션',
    categoryColor: '#8B4513',
    title: '2년째 국어 반타작',
    result: '내신 원점수',
    highlight: '30점 이상 상승!',
    info: '- 특목고 2학년 -'
  },
  {
    id: 2,
    category: '수능솔루션',
    categoryColor: '#8B4513',
    title: '국어 모의 만년 4등급',
    result: '2023 불수능',
    highlight: '2등급 안착!',
    info: '- 8학군 재수생 -'
  },
  {
    id: 3,
    category: '교과디렉션',
    categoryColor: '#8B4513',
    title: '국어 3등급 정체',
    result: '내신 평균',
    highlight: '1등급 달성!',
    info: '- 강남 고2 -'
  },
  {
    id: 4,
    category: '수능솔루션',
    categoryColor: '#8B4513',
    title: '6월 모의 5등급',
    result: '수능 국어',
    highlight: '1등급 달성!',
    info: '- 대치 재수생 -'
  },
  {
    id: 5,
    category: '교과디렉션',
    categoryColor: '#8B4513',
    title: '국어 60점대 고정',
    result: '기말고사',
    highlight: '90점 돌파!',
    info: '- 중3 학생 -'
  },
  {
    id: 6,
    category: '수능솔루션',
    categoryColor: '#8B4513',
    title: '독서 영역 취약',
    result: '수능 국어',
    highlight: '만점 달성!',
    info: '- N수생 -'
  }
];

const BannerSlider = ({ banners = defaultBanners }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 2개씩 보여주기
  const itemsPerPage = 2;
  const totalPages = Math.ceil(banners.length / itemsPerPage);

  // 자동 슬라이드 (5초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalPages);
    }, 5000);
    return () => clearInterval(interval);
  }, [totalPages]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalPages);
  };

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  // 현재 페이지에 보여줄 배너들
  const startIndex = currentIndex * itemsPerPage;
  const visibleBanners = banners.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="hp-banner-slider">
      <div className="hp-banner-slider-container">
        {/* 이전 버튼 */}
        <button 
          className="hp-banner-arrow hp-banner-arrow-left"
          onClick={handlePrev}
          aria-label="이전"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        {/* 배너 카드들 */}
        <div className="hp-banner-cards-wrapper">
          <div className="hp-banner-cards">
            {visibleBanners.map((banner) => (
              <div key={banner.id} className="hp-banner-card">
                <div 
                  className="hp-banner-category"
                  style={{ backgroundColor: banner.categoryColor }}
                >
                  {banner.category}
                </div>
                <h3 className="hp-banner-title">{banner.title}</h3>
                <div className="hp-banner-arrow-down">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                  </svg>
                </div>
                <p className="hp-banner-result">{banner.result}</p>
                <p className="hp-banner-highlight">{banner.highlight}</p>
                <p className="hp-banner-info">{banner.info}</p>
                <div className="hp-banner-logo">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <circle cx="6" cy="6" r="2" fill="#8B4513"/>
                    <circle cx="12" cy="6" r="2" fill="#8B4513"/>
                    <circle cx="18" cy="6" r="2" fill="#8B4513"/>
                    <circle cx="6" cy="12" r="2" fill="#8B4513"/>
                    <circle cx="12" cy="12" r="2" fill="#8B4513"/>
                    <circle cx="18" cy="12" r="2" fill="#8B4513"/>
                    <circle cx="6" cy="18" r="2" fill="#8B4513"/>
                    <circle cx="12" cy="18" r="2" fill="#8B4513"/>
                    <circle cx="18" cy="18" r="2" fill="#8B4513"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 다음 버튼 */}
        <button 
          className="hp-banner-arrow hp-banner-arrow-right"
          onClick={handleNext}
          aria-label="다음"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>

      {/* 페이지 인디케이터 */}
      <div className="hp-banner-dots">
        {Array.from({ length: totalPages }).map((_, index) => (
          <button
            key={index}
            className={`hp-banner-dot ${currentIndex === index ? 'active' : ''}`}
            onClick={() => handleDotClick(index)}
            aria-label={`${index + 1}번째 페이지`}
          />
        ))}
      </div>
    </div>
  );
};

export default BannerSlider;
