import React, { useState, useEffect } from 'react';

const BannerSlider = ({ banners = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 2개씩 보여주기
  const itemsPerPage = 2;
  const totalPages = Math.ceil(banners.length / itemsPerPage);

  // 자동 슬라이드 (2.5초마다)
  useEffect(() => {
    if (totalPages <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalPages);
    }, 2500);
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

  if (banners.length === 0) {
    return null;
  }

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
                  style={{ backgroundColor: '#8B4513' }}
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
      {totalPages > 1 && (
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
      )}
    </div>
  );
};

export default BannerSlider;
