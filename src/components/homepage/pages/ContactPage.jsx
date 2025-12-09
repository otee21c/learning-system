import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import '../Homepage.css';

export default function ContactPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  
  // 폼 데이터
  const [studentName, setStudentName] = useState('');
  const [schoolGrade, setSchoolGrade] = useState('');
  const [phone, setPhone] = useState('');
  const [availableTime, setAvailableTime] = useState('');
  const [message, setMessage] = useState('');

  // 관리자 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === 'admin@test.com') {
        setIsAdmin(true);
        fetchInquiries();
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 상담 신청 목록 불러오기 (관리자용)
  const fetchInquiries = async () => {
    try {
      const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInquiries(data);
    } catch (error) {
      console.error('Error fetching inquiries:', error);
    }
  };

  // 상담 신청 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!studentName || !schoolGrade || !phone) {
      alert('학생 이름, 학교/학년, 전화번호는 필수입니다.');
      return;
    }

    try {
      await addDoc(collection(db, 'inquiries'), {
        studentName,
        schoolGrade,
        phone,
        availableTime,
        message,
        createdAt: new Date().toISOString(),
        status: '대기'
      });
      setSubmitted(true);
      // 폼 초기화
      setStudentName('');
      setSchoolGrade('');
      setPhone('');
      setAvailableTime('');
      setMessage('');
    } catch (error) {
      console.error('Error submitting:', error);
      alert('제출에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 상담 삭제 (관리자용)
  const handleDelete = async (id) => {
    if (window.confirm('이 상담 신청을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'inquiries', id));
        fetchInquiries();
        alert('삭제되었습니다.');
      } catch (error) {
        console.error('Error deleting:', error);
        alert('삭제에 실패했습니다.');
      }
    }
  };

  // 다시 작성
  const handleReset = () => {
    setSubmitted(false);
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
              <li><Link to="/notice">공지 사항</Link></li>
              <li><Link to="/contact" className="hp-active">문자 상담</Link></li>
              <li><Link to="/lms" className="hp-highlight">회원 전용</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* 페이지 내용 */}
      <div className="hp-page-container">
        <div className="hp-page-header">
          <h1>문자 상담</h1>
        </div>

        <div className="hp-page-content">
          {isAdmin ? (
            // 관리자: 상담 신청 목록
            <div className="hp-inquiries">
              <h2>상담 신청 목록</h2>
              {inquiries.length > 0 ? (
                <div className="hp-inquiry-list">
                  {inquiries.map((inquiry) => (
                    <div key={inquiry.id} className="hp-inquiry-card">
                      <div className="hp-inquiry-header">
                        <span className="hp-inquiry-name">{inquiry.studentName}</span>
                        <span className="hp-inquiry-date">
                          {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <div className="hp-inquiry-body">
                        <p><strong>학교/학년:</strong> {inquiry.schoolGrade}</p>
                        <p><strong>연락처:</strong> {inquiry.phone}</p>
                        <p><strong>통화 가능 시간:</strong> {inquiry.availableTime || '-'}</p>
                        <p><strong>상담 내용:</strong> {inquiry.message || '-'}</p>
                      </div>
                      <div className="hp-inquiry-footer">
                        <button 
                          onClick={() => handleDelete(inquiry.id)} 
                          className="hp-btn hp-btn-danger hp-btn-small"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hp-no-content">아직 상담 신청이 없습니다.</p>
              )}
            </div>
          ) : submitted ? (
            // 제출 완료
            <div className="hp-submit-success">
              <div className="hp-success-icon">✓</div>
              <h2>상담 신청이 완료되었습니다!</h2>
              <p>빠른 시일 내에 연락드리겠습니다.</p>
              <button onClick={handleReset} className="hp-btn hp-btn-primary">
                새로운 상담 신청
              </button>
            </div>
          ) : (
            // 방문자: 상담 신청 폼
            <form className="hp-contact-form" onSubmit={handleSubmit}>
              <p className="hp-form-desc">
                상담을 원하시면 아래 내용을 작성해주세요. 빠른 시일 내에 연락드리겠습니다.
              </p>
              
              <div className="hp-form-group">
                <label>학생 이름 <span className="hp-required">*</span></label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="학생 이름을 입력하세요"
                  required
                />
              </div>

              <div className="hp-form-group">
                <label>학교 / 학년 (N수생) <span className="hp-required">*</span></label>
                <input
                  type="text"
                  value={schoolGrade}
                  onChange={(e) => setSchoolGrade(e.target.value)}
                  placeholder="예: OO고 2학년, N수생"
                  required
                />
              </div>

              <div className="hp-form-group">
                <label>전화번호 <span className="hp-required">*</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  required
                />
              </div>

              <div className="hp-form-group">
                <label>통화 가능 시간</label>
                <input
                  type="text"
                  value={availableTime}
                  onChange={(e) => setAvailableTime(e.target.value)}
                  placeholder="예: 평일 오후 3시 이후"
                />
              </div>

              <div className="hp-form-group">
                <label>상담 받고 싶은 내용</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="간단히 작성해주세요"
                  rows={4}
                />
              </div>

              <button type="submit" className="hp-btn hp-btn-primary hp-btn-large">
                상담 신청하기
              </button>
            </form>
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
