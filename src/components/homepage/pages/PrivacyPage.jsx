import React from 'react';
import { Link } from 'react-router-dom';
import '../Homepage.css';

export default function PrivacyPage() {
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
          <h1>개인정보처리방침</h1>
        </div>

        <div className="hp-page-content hp-privacy">
          <p className="hp-privacy-intro">
            오늘의 국어(이하 "학원")는 개인정보보호법에 따라 이용자의 개인정보 보호 및 권익을 보호하고, 
            개인정보와 관련한 이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은 처리방침을 두고 있습니다.
          </p>

          <div className="hp-privacy-section">
            <h2>제1조 (개인정보의 수집 항목 및 수집 방법)</h2>
            <p>학원은 상담 및 서비스 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
            <p><strong>1. 수집 항목</strong></p>
            <ul>
              <li>필수 항목: 학생 이름, 학교/학년, 전화번호</li>
              <li>선택 항목: 통화 가능 시간, 상담 내용</li>
            </ul>
            <p><strong>2. 수집 방법</strong></p>
            <ul>
              <li>홈페이지 문자 상담 신청</li>
              <li>전화 및 방문 상담</li>
            </ul>
          </div>

          <div className="hp-privacy-section">
            <h2>제2조 (개인정보의 수집 및 이용 목적)</h2>
            <p>학원은 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
            <ul>
              <li>상담 서비스 제공 및 상담 일정 조율</li>
              <li>학습 컨설팅 및 수업 안내</li>
              <li>문의사항 응대 및 처리</li>
            </ul>
          </div>

          <div className="hp-privacy-section">
            <h2>제3조 (개인정보의 보유 및 이용 기간)</h2>
            <p>학원은 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</p>
            <ul>
              <li>상담 신청 정보: 상담 완료 후 1년</li>
              <li>단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</li>
            </ul>
          </div>

          <div className="hp-privacy-section">
            <h2>제4조 (개인정보의 제3자 제공)</h2>
            <p>학원은 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.</p>
            <ul>
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </div>

          <div className="hp-privacy-section">
            <h2>제5조 (개인정보의 파기 절차 및 방법)</h2>
            <p>학원은 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</p>
            <ul>
              <li>전자적 파일 형태: 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
              <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </div>

          <div className="hp-privacy-section">
            <h2>제6조 (이용자의 권리와 행사 방법)</h2>
            <p>이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.</p>
            <p>위 권리 행사는 학원에 대해 서면, 전화, 이메일 등을 통해 하실 수 있으며, 학원은 이에 대해 지체 없이 조치하겠습니다.</p>
          </div>

          <div className="hp-privacy-section">
            <h2>제7조 (개인정보 보호책임자)</h2>
            <p>학원은 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
            <div className="hp-privacy-info-box">
              <p><strong>개인정보 보호책임자</strong></p>
              <p>성명: 김봉관</p>
              <p>직책: 대표</p>
              <p>연락처: 02-562-5559</p>
            </div>
          </div>

          <div className="hp-privacy-section">
            <h2>제8조 (개인정보처리방침 변경)</h2>
            <p>이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.</p>
          </div>

          <div className="hp-privacy-footer">
            <p>본 방침은 2024년 12월 10일부터 시행됩니다.</p>
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
          <div className="hp-footer-links">
            <Link to="/privacy">개인정보처리방침</Link>
          </div>
          <p className="hp-footer-copyright">© 2024 오늘의 국어 연구소. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
