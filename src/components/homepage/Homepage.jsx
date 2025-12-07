import React from 'react';
import { Link } from 'react-router-dom';
import './Homepage.css';

export default function Homepage() {
  return (
    <div className="homepage">
      {/* 헤더 */}
      <header className="hp-header">
        <div className="hp-header-container">
          <a href="/" className="hp-logo">
            <img src="/logo.png" alt="오늘의 국어 연구소" />
          </a>
          <nav className="hp-nav">
            <ul>
              <li><a href="#">메인 화면</a></li>
              <li><a href="#">오국 소개</a></li>
              <li><a href="#">입시 정보</a></li>
              <li><a href="#">공지 사항</a></li>
              <li><a href="#">문자 상담</a></li>
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

      {/* 프로그램 소개 띠 */}
      <section className="hp-program-banner">
        <div className="hp-program-banner-content">
          <p className="hp-subtitle">CONSULTING PROGRAM</p>
          <h2>오늘의 국어 연구소에서 만들었습니다.</h2>
          <p className="hp-desc">단 하나의 컨설팅 프로그램, <strong>[실전적 국어 원리]</strong></p>
          <p className="hp-desc">학생 개개인의 현재 실력을 정확히 진단하고, 맞춤형 학습 전략을 수립하여 목표 달성까지 함께 합니다.</p>
        </div>
      </section>

      {/* 지점 섹션 */}
      <section className="hp-branches">
        {/* 가로 3개: 광진원 - 연구소 - 배곧원 */}
        <div className="hp-branches-row">
          {/* 광진원 */}
          <a href="https://m.blog.naver.com/today_personal" target="_blank" rel="noopener noreferrer" className="hp-branch-card hp-sub">
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

          {/* 대치 연구소 */}
          <div className="hp-branch-card hp-main">
            <div className="hp-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
              </svg>
            </div>
            <h3>대치 연구소</h3>
            <p className="hp-location">서울 강남구 대치동</p>
            <p className="hp-description">오늘의 국어 연구소 본원입니다.<br />단 하나의 컨설팅 프로그램으로<br />실전적 국어 원리를 가르칩니다.</p>
          </div>

          {/* 배곧원 */}
          <a href="https://m.blog.naver.com/today_korea" target="_blank" rel="noopener noreferrer" className="hp-branch-card hp-sub">
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

        {/* 청년다락방 */}
        <div className="hp-branch-bottom">
          <div className="hp-connector-line"></div>
          <div className="hp-branch-card hp-mini">
            <p className="hp-mini-line">오늘의 국어가 실천하는</p>
            <p className="hp-mini-line">사회적 가치 창조 공간</p>
            <p className="hp-mini-line hp-mini-highlight">청년 다락방</p>
          </div>
        </div>
      </section>

      {/* 연락처 */}
      <section className="hp-contact">
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
        <p>© 2024 오늘의 국어 연구소. All rights reserved.</p>
      </footer>
    </div>
  );
}
