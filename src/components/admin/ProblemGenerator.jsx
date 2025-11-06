import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase.js';
import { FileText, Sparkles, Trash2, CheckCircle } from 'lucide-react';
import OpenAI from 'openai';

const ProblemGenerator = () => {
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });
  const [problemSets, setProblemSets] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 폼 데이터
  const [weekNumber, setWeekNumber] = useState('');
  const [title, setTitle] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [generatedProblems, setGeneratedProblems] = useState(null);
  const [textContent, setTextContent] = useState('');
  
  // 문제 상세보기용 state 추가
  const [selectedProblemSet, setSelectedProblemSet] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 문제 세트 불러오기
  useEffect(() => {
    loadProblemSets();
  }, []);

  const loadProblemSets = async () => {
    try {
      const q = query(collection(db, 'problemSets'), orderBy('weekNumber', 'asc'));
      const querySnapshot = await getDocs(q);
      const sets = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProblemSets(sets);
    } catch (error) {
      console.error('문제 세트 로딩 실패:', error);
    }
  };

  // PDF 업로드 및 텍스트 추출
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
    } else {
      alert('PDF 파일만 업로드 가능합니다.');
    }
  };

  // AI 문제 생성
  const handleGenerateProblems = async () => {
    if (!weekNumber || !title || !textContent) {
      alert('주차, 제목, 지문 내용을 모두 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // PDF 업로드 (선택사항)
      let pdfUrl = null;
      if (pdfFile) {
        const storageRef = ref(storage, `problem-materials/${Date.now()}_${pdfFile.name}`);
        await uploadBytes(storageRef, pdfFile);
        pdfUrl = await getDownloadURL(storageRef);
      }

      alert('PDF가 업로드되었습니다. 잠시 후 문제가 생성됩니다...');

      // OpenAI로 문제 생성
      const prompt = `당신은 고등학교 국어 교사입니다. 다음 지문을 읽고 문제를 생성해주세요.

주제: ${title}

=== 지문 ===
${textContent}
=== 지문 끝 ===

위 지문을 읽고 다음 형식으로 문제를 생성해주세요:

1. OX 문제 20개 (지문 내용 이해 확인용)
- 각 문제는 지문의 세부 내용을 확인하는 진위형 문제
- 답은 true 또는 false
- 해설 포함

2. 객관식 5지선다 문제 5개 (심화형)
- 추론, 해석, 분석이 필요한 고난도 문제
- 5개의 선택지 (①②③④⑤)
- 정답 번호 (0-4)
- 해설 포함

다음 JSON 형식으로 응답해주세요:
{
  "oxProblems": [
    {
      "type": "ox",
      "number": 1,
      "question": "문제 내용",
      "answer": true,
      "explanation": "해설"
    }
  ],
  "multipleProblems": [
    {
      "type": "multiple",
      "number": 1,
      "question": "문제 내용",
      "options": ["① 선택지1", "② 선택지2", "③ 선택지3", "④ 선택지4", "⑤ 선택지5"],
      "answer": 0,
      "explanation": "해설"
    }
  ]
}

위 PDF의 지문을 기반으로 문제를 생성해주세요. 만약 지문이 짧아서 OX 20개가 불가능하면 가능한 만큼만 생성하되, 최소 10개 이상은 만들어주세요.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "당신은 고등학교 국어 교사입니다. 지문을 분석하고 학생들의 이해도를 평가할 수 있는 양질의 문제를 생성합니다."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      const result = JSON.parse(completion.choices[0].message.content);

      const generatedData = {
        weekNumber: parseInt(weekNumber),
        title: title,
        pdfUrl: pdfUrl,
        oxProblems: result.oxProblems || [],
        multipleProblems: result.multipleProblems || []
      };

      setGeneratedProblems(generatedData);
      alert(`문제 생성 완료!\nOX: ${result.oxProblems?.length || 0}개\n객관식: ${result.multipleProblems?.length || 0}개`);

    } catch (error) {
      console.error('문제 생성 실패:', error);
      alert('문제 생성에 실패했습니다. 다시 시도해주세요.\n오류: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 문제 저장
  const handleSaveProblems = async () => {
    if (!generatedProblems) return;

    try {
      await addDoc(collection(db, 'problemSets'), {
        ...generatedProblems,
        createdAt: new Date()
      });

      alert('문제 세트가 저장되었습니다!');
      setGeneratedProblems(null);
      setShowCreateForm(false);
      setWeekNumber('');
      setTitle('');
      setPdfFile(null);
      setTextContent('');
      loadProblemSets();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    }
  };

  // 문제 세트 삭제
  const handleDeleteProblemSet = async (id) => {
    if (!window.confirm('이 문제 세트를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'problemSets', id));
      alert('삭제되었습니다.');
      loadProblemSets();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 문제 세트 상세보기
  const handleViewProblemSet = (set) => {
    setSelectedProblemSet(set);
    setShowDetailModal(true);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={28} color="#6366f1" />
          AI 문제 생성
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          + 새 문제 생성
        </button>
      </div>

      {/* 문제 생성 폼 */}
      {showCreateForm && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>새 문제 세트 생성</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>주차</label>
            <input
              type="number"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="예: 1"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 진달래꽃 - 김소월"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>교재 PDF 업로드</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px'
              }}
            />
            {pdfFile && (
              <p style={{ marginTop: '5px', color: '#10b981', fontSize: '14px' }}>
                ✓ {pdfFile.name}
              </p>
            )}
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              지문 내용 입력 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="지문 내용을 입력하거나 붙여넣기 해주세요..."
              rows={10}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <p style={{ marginTop: '5px', color: '#666', fontSize: '12px' }}>
              💡 교재나 학습 자료의 지문을 복사해서 붙여넣기 해주세요.
            </p>
          </div>

          <button
            onClick={handleGenerateProblems}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#ccc' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={20} />
            {loading ? 'AI가 문제를 생성 중...' : 'AI 문제 생성하기'}
          </button>
        </div>
      )}

      {/* 생성된 문제 미리보기 */}
      {generatedProblems && (
        <div style={{
          backgroundColor: '#f0fdf4',
          padding: '30px',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '2px solid #10b981'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', color: '#10b981' }}>
            ✓ 문제 생성 완료!
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <p><strong>주차:</strong> {generatedProblems.weekNumber}주차</p>
            <p><strong>제목:</strong> {generatedProblems.title}</p>
            <p><strong>OX 문제:</strong> {generatedProblems.oxProblems.length}개</p>
            <p><strong>객관식 문제:</strong> {generatedProblems.multipleProblems.length}개</p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSaveProblems}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              저장하기
            </button>
            <button
              onClick={() => setGeneratedProblems(null)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 기존 문제 세트 목록 */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>생성된 문제 세트</h3>
        
        {problemSets.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
            아직 생성된 문제 세트가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {problemSets.map(set => (
              <div
                key={set.id}
                style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onClick={() => handleViewProblemSet(set)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                    {set.weekNumber}주차 - {set.title}
                  </h4>
                  <p style={{ color: '#666', fontSize: '14px' }}>
                    OX {set.oxProblems?.length || 0}개 | 객관식 {set.multipleProblems?.length || 0}개
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProblemSet(set.id);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Trash2 size={16} />
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 문제 상세보기 모달 */}
      {showDetailModal && selectedProblemSet && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '30px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {selectedProblemSet.weekNumber}주차 - {selectedProblemSet.title}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                닫기
              </button>
            </div>

            {/* OX 문제 */}
            <div style={{ marginBottom: '30px' }}>
              <h4 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#6366f1' }}>
                📝 OX 문제 ({selectedProblemSet.oxProblems?.length || 0}개)
              </h4>
              {selectedProblemSet.oxProblems?.map((problem, index) => (
                <div key={index} style={{
                  backgroundColor: '#f9fafb',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  borderLeft: '4px solid #6366f1'
                }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    {problem.number}. {problem.question}
                  </p>
                  <p style={{ color: '#10b981', fontWeight: 'bold' }}>
                    정답: {problem.answer ? 'O' : 'X'}
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
                    💡 {problem.explanation}
                  </p>
                </div>
              ))}
            </div>

            {/* 객관식 문제 */}
            <div>
              <h4 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#10b981' }}>
                ✏️ 객관식 문제 ({selectedProblemSet.multipleProblems?.length || 0}개)
              </h4>
              {selectedProblemSet.multipleProblems?.map((problem, index) => (
                <div key={index} style={{
                  backgroundColor: '#f0fdf4',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  borderLeft: '4px solid #10b981'
                }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                    {problem.number}. {problem.question}
                  </p>
                  <div style={{ marginBottom: '12px' }}>
                    {problem.options?.map((option, optIndex) => (
                      <p key={optIndex} style={{
                        padding: '8px',
                        marginBottom: '4px',
                        backgroundColor: optIndex === problem.answer ? '#d1fae5' : 'white',
                        borderRadius: '4px',
                        fontWeight: optIndex === problem.answer ? 'bold' : 'normal'
                      }}>
                        {option}
                      </p>
                    ))}
                  </div>
                  <p style={{ color: '#10b981', fontWeight: 'bold' }}>
                    정답: {problem.answer + 1}번
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
                    💡 {problem.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemGenerator;
