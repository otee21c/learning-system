import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { BookOpen, CheckCircle, XCircle, Sparkles } from 'lucide-react';

const ProblemSolver = ({ studentId }) => {
  const [problemSets, setProblemSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(null);
  const [solving, setSolving] = useState(false);
  const [myResults, setMyResults] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [viewingResult, setViewingResult] = useState(null);

  // 문제 세트 불러오기
  useEffect(() => {
    loadProblemSets();
    if (studentId) {
      loadMyResults();
    }
  }, [studentId]);

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

  // 내 풀이 기록 불러오기
  const loadMyResults = async () => {
    try {
      const q = query(
        collection(db, 'problemResults'),
        where('studentId', '==', studentId)
      );
      const querySnapshot = await getDocs(q);
      const results = {};
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        // 각 문제 세트별로 가장 최근 결과만 저장
        if (!results[data.problemSetId] || 
            new Date(data.submittedAt.toDate()) > new Date(results[data.problemSetId].submittedAt.toDate())) {
          results[data.problemSetId] = {
            id: doc.id,
            ...data
          };
        }
      });
      setMyResults(results);
    } catch (error) {
      console.error('풀이 기록 로딩 실패:', error);
    }
  };

  // 해설 보기
  const handleViewExplanation = (set) => {
    setSelectedSet(set);
    setShowExplanation(true);
  };

  // 이전 풀이 기록 보기
  const handleViewPreviousResult = (set) => {
    console.log('클릭됨!', set, myResults);  // ← 이 줄 추가!
    const result = myResults[set.id];
    if (result) {
      setSelectedSet(set);
      setAnswers(result.answers);
      setScore({
        correct: result.correctCount,
        total: result.totalCount,
        percentage: result.score
      });
      setViewingResult(true);
      setShowResult(true);
      setSolving(true);
    }
  };

  // 문제 풀이 시작
  const handleStartSolving = (set) => {
    setSelectedSet(set);
    setSolving(true);
    setCurrentProblemIndex(0);
    setAnswers({});
    setShowResult(false);
    setViewingResult(false);
  };

  // OX 답안 선택
  const handleOXAnswer = (problemIndex, answer) => {
    setAnswers({
      ...answers,
      [`ox_${problemIndex}`]: answer
    });
  };

  // 객관식 답안 선택
  const handleMultipleAnswer = (problemIndex, answer) => {
    setAnswers({
      ...answers,
      [`multiple_${problemIndex}`]: answer
    });
  };

  // 제출 및 채점
  const handleSubmit = async () => {
    if (!selectedSet) return;

    let correctCount = 0;
    let totalCount = 0;

    // OX 문제 채점
    selectedSet.oxProblems?.forEach((problem, index) => {
      totalCount++;
      if (answers[`ox_${index}`] === problem.answer) {
        correctCount++;
      }
    });

    // 객관식 문제 채점
    selectedSet.multipleProblems?.forEach((problem, index) => {
      totalCount++;
      if (answers[`multiple_${index}`] === problem.answer) {
        correctCount++;
      }
    });

    const finalScore = Math.round((correctCount / totalCount) * 100);
    setScore({
      correct: correctCount,
      total: totalCount,
      percentage: finalScore
    });

    // Firebase에 결과 저장
    try {
      await addDoc(collection(db, 'problemResults'), {
        studentId: studentId,
        problemSetId: selectedSet.id,
        weekNumber: selectedSet.weekNumber,
        title: selectedSet.title,
        answers: answers,
        score: finalScore,
        correctCount: correctCount,
        totalCount: totalCount,
        submittedAt: new Date()
      });
    } catch (error) {
      console.error('결과 저장 실패:', error);
    }

    setShowResult(true);
  };

  // 다시 풀기
  const handleReset = () => {
    setSelectedSet(null);
    setSolving(false);
    setAnswers({});
    setShowResult(false);
    setScore(null);
    setViewingResult(false);
    setShowExplanation(false);
    loadMyResults(); // 목록 새로고침
  };

  // 해설 보기 모달
  if (showExplanation && selectedSet) {
    return (
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '16px'
          }}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: 'bold'
            }}>
              📖 {selectedSet.weekNumber}주차 - {selectedSet.title} 해설
            </h2>
            <button
              onClick={() => {
                setShowExplanation(false);
                setSelectedSet(null);
              }}
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

          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ 
              fontSize: '22px',
              fontWeight: 'bold',
              marginBottom: '20px',
              color: '#6366f1'
            }}>
              📝 OX 문제 해설
            </h3>
            {selectedSet.oxProblems?.map((problem, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#f9fafb',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  borderLeft: '4px solid #6366f1'
                }}
              >
                <p style={{ 
                  fontWeight: 'bold',
                  fontSize: '16px',
                  marginBottom: '12px',
                  lineHeight: '1.6'
                }}>
                  {problem.number}. {problem.question}
                </p>
                <div style={{ 
                  display: 'inline-block',
                  padding: '6px 16px',
                  backgroundColor: problem.answer ? '#d1fae5' : '#fecaca',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  marginBottom: '12px',
                  fontSize: '18px'
                }}>
                  정답: {problem.answer ? 'O' : 'X'}
                </div>
                <p style={{ 
                  color: '#374151',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  backgroundColor: '#fff',
                  padding: '12px',
                  borderRadius: '6px',
                  marginTop: '8px'
                }}>
                  💡 <strong>해설:</strong> {problem.explanation}
                </p>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ 
              fontSize: '22px',
              fontWeight: 'bold',
              marginBottom: '20px',
              color: '#10b981'
            }}>
              ✏️ 객관식 문제 해설
            </h3>
            {selectedSet.multipleProblems?.map((problem, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: '#f0fdf4',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  borderLeft: '4px solid #10b981'
                }}
              >
                <p style={{ 
                  fontWeight: 'bold',
                  fontSize: '16px',
                  marginBottom: '16px',
                  lineHeight: '1.6'
                }}>
                  {problem.number}. {problem.question}
                </p>
                <div style={{ marginBottom: '12px' }}>
                  {problem.options?.map((option, optIndex) => (
                    <p
                      key={optIndex}
                      style={{
                        padding: '10px 16px',
                        marginBottom: '6px',
                        backgroundColor: optIndex === problem.answer ? '#d1fae5' : 'white',
                        borderRadius: '6px',
                        border: optIndex === problem.answer ? '2px solid #10b981' : '1px solid #e5e7eb',
                        fontWeight: optIndex === problem.answer ? 'bold' : 'normal',
                        fontSize: '15px'
                      }}
                    >
                      {option} {optIndex === problem.answer && '✓'}
                    </p>
                  ))}
                </div>
                <p style={{ 
                  color: '#374151',
                  fontSize: '15px',
                  lineHeight: '1.7',
                  backgroundColor: '#fff',
                  padding: '12px',
                  borderRadius: '6px',
                  marginTop: '8px'
                }}>
                  💡 <strong>해설:</strong> {problem.explanation}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setShowExplanation(false);
              setSelectedSet(null);
            }}
            style={{
              marginTop: '32px',
              padding: '12px 32px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              width: '100%'
            }}
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  // 문제 세트 선택 화면
  if (!solving) {
    return (
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <BookOpen size={28} color="#6366f1" />
          AI 문제 풀이
        </h2>

        {problemSets.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px'
          }}>
            <p style={{ color: '#6b7280', fontSize: '16px' }}>
              아직 선생님이 문제를 등록하지 않았습니다.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {problemSets.map(set => {
              const myResult = myResults[set.id];
              return (
                <div
                  key={set.id}
                  style={{
                    backgroundColor: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '2px solid #e5e7eb',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold',
                      marginBottom: '8px'
                    }}>
                      {set.weekNumber}주차 - {set.title}
                    </h3>
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px',
                      color: '#6b7280',
                      fontSize: '14px',
                      marginBottom: '12px'
                    }}>
                      <span>📝 OX 문제: {set.oxProblems?.length || 0}개</span>
                      <span>✏️ 객관식: {set.multipleProblems?.length || 0}개</span>
                      <span>⏱️ 총 {(set.oxProblems?.length || 0) + (set.multipleProblems?.length || 0)}문제</span>
                    </div>
                    
                    {/* 내 풀이 기록 표시 */}
                    {myResult && (
                      <div style={{
                        backgroundColor: myResult.score >= 80 ? '#f0fdf4' : myResult.score >= 60 ? '#fef3c7' : '#fef2f2',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        borderLeft: `4px solid ${myResult.score >= 80 ? '#10b981' : myResult.score >= 60 ? '#f59e0b' : '#ef4444'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            내 점수: {myResult.score}점
                          </span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            ({myResult.correctCount}/{myResult.totalCount}개 정답)
                          </span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            • {new Date(myResult.submittedAt.toDate()).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleStartSolving(set)}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}
                    >
                      {myResult ? '다시 풀기' : '문제 풀기'}
                    </button>
                    
                    <button
                      onClick={() => handleViewExplanation(set)}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}
                    >
                      📖 해설 보기
                    </button>
                    
                    {myResult && (
                      <button
                        onClick={() => handleViewPreviousResult(set)}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '16px'
                        }}
                      >
                        📊 내 풀이 보기
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 결과 화면
  if (showResult && score) {
    return (
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          {viewingResult && (
            <div style={{
              backgroundColor: '#eff6ff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '2px solid #3b82f6'
            }}>
              <p style={{ color: '#1e40af', fontWeight: 'bold' }}>
                📊 이전 풀이 기록을 보고 있습니다
              </p>
            </div>
          )}
          <div style={{ 
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            {score.percentage >= 80 ? '🎉' : score.percentage >= 60 ? '👍' : '💪'}
          </div>
          <h2 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold',
            marginBottom: '16px',
            color: score.percentage >= 80 ? '#10b981' : score.percentage >= 60 ? '#f59e0b' : '#ef4444'
          }}>
            {score.percentage}점
          </h2>
          <p style={{ 
            fontSize: '18px',
            color: '#6b7280',
            marginBottom: '32px'
          }}>
            {score.correct}개 / {score.total}개 정답
          </p>

          {/* 틀린 문제 피드백 */}
          <div style={{ 
            marginTop: '32px',
            textAlign: 'left',
            borderTop: '2px solid #e5e7eb',
            paddingTop: '32px'
          }}>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold',
              marginBottom: '20px'
            }}>
              📋 문제별 결과
            </h3>

            {/* OX 문제 결과 */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ 
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '12px',
                color: '#6366f1'
              }}>
                OX 문제
              </h4>
              {selectedSet.oxProblems?.map((problem, index) => {
                const userAnswer = answers[`ox_${index}`];
                const isCorrect = userAnswer === problem.answer;
                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      borderLeft: `4px solid ${isCorrect ? '#10b981' : '#ef4444'}`
                    }}
                  >
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      {isCorrect ? (
                        <CheckCircle size={20} color="#10b981" />
                      ) : (
                        <XCircle size={20} color="#ef4444" />
                      )}
                      <span style={{ fontWeight: 'bold' }}>
                        {problem.number}. {problem.question}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '14px',
                      color: '#6b7280',
                      marginLeft: '28px'
                    }}>
                      <p>내 답: {userAnswer !== undefined ? (userAnswer ? 'O' : 'X') : '미응답'}</p>
                      <p>정답: {problem.answer ? 'O' : 'X'}</p>
                      {!isCorrect && (
                        <p style={{ 
                          marginTop: '8px',
                          color: '#374151',
                          fontWeight: '500'
                        }}>
                          💡 {problem.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 객관식 문제 결과 */}
            <div>
              <h4 style={{ 
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '12px',
                color: '#10b981'
              }}>
                객관식 문제
              </h4>
              {selectedSet.multipleProblems?.map((problem, index) => {
                const userAnswer = answers[`multiple_${index}`];
                const isCorrect = userAnswer === problem.answer;
                return (
                  <div
                    key={index}
                    style={{
                      backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2',
                      padding: '16px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      borderLeft: `4px solid ${isCorrect ? '#10b981' : '#ef4444'}`
                    }}
                  >
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      {isCorrect ? (
                        <CheckCircle size={20} color="#10b981" />
                      ) : (
                        <XCircle size={20} color="#ef4444" />
                      )}
                      <span style={{ fontWeight: 'bold' }}>
                        {problem.number}. {problem.question}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '14px',
                      color: '#6b7280',
                      marginLeft: '28px'
                    }}>
                      <p>내 답: {userAnswer !== undefined ? `${userAnswer + 1}번` : '미응답'}</p>
                      <p>정답: {problem.answer + 1}번</p>
                      {!isCorrect && (
                        <p style={{ 
                          marginTop: '8px',
                          color: '#374151',
                          fontWeight: '500'
                        }}>
                          💡 {problem.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleReset}
            style={{
              marginTop: '32px',
              padding: '12px 32px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 문제 풀이 화면
  const allProblems = [
    ...(selectedSet?.oxProblems?.map((p, i) => ({ ...p, type: 'ox', index: i })) || []),
    ...(selectedSet?.multipleProblems?.map((p, i) => ({ ...p, type: 'multiple', index: i })) || [])
  ];

  const currentProblem = allProblems[currentProblemIndex];
  const progress = ((currentProblemIndex + 1) / allProblems.length) * 100;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* 진행 바 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            {selectedSet?.weekNumber}주차 - {selectedSet?.title}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#6366f1' }}>
            {currentProblemIndex + 1} / {allProblems.length}
          </span>
        </div>
        <div style={{ 
          width: '100%',
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#6366f1',
            transition: 'width 0.3s'
          }} />
        </div>
      </div>

      {/* 문제 */}
      <div style={{
        backgroundColor: 'white',
        padding: '32px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        minHeight: '400px'
      }}>
        <h3 style={{ 
          fontSize: '20px',
          fontWeight: 'bold',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          {currentProblem?.number}. {currentProblem?.question}
        </h3>

        {/* OX 문제 */}
        {currentProblem?.type === 'ox' && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => handleOXAnswer(currentProblem.index, true)}
              style={{
                flex: 1,
                padding: '24px',
                fontSize: '24px',
                fontWeight: 'bold',
                border: `3px solid ${answers[`ox_${currentProblem.index}`] === true ? '#10b981' : '#e5e7eb'}`,
                backgroundColor: answers[`ox_${currentProblem.index}`] === true ? '#f0fdf4' : 'white',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              O
            </button>
            <button
              onClick={() => handleOXAnswer(currentProblem.index, false)}
              style={{
                flex: 1,
                padding: '24px',
                fontSize: '24px',
                fontWeight: 'bold',
                border: `3px solid ${answers[`ox_${currentProblem.index}`] === false ? '#ef4444' : '#e5e7eb'}`,
                backgroundColor: answers[`ox_${currentProblem.index}`] === false ? '#fef2f2' : 'white',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              X
            </button>
          </div>
        )}

        {/* 객관식 문제 */}
        {currentProblem?.type === 'multiple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentProblem.options?.map((option, optIndex) => (
              <button
                key={optIndex}
                onClick={() => handleMultipleAnswer(currentProblem.index, optIndex)}
                style={{
                  padding: '16px 20px',
                  fontSize: '16px',
                  textAlign: 'left',
                  border: `2px solid ${answers[`multiple_${currentProblem.index}`] === optIndex ? '#6366f1' : '#e5e7eb'}`,
                  backgroundColor: answers[`multiple_${currentProblem.index}`] === optIndex ? '#f0f9ff' : 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: answers[`multiple_${currentProblem.index}`] === optIndex ? 'bold' : 'normal'
                }}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 네비게이션 버튼 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginTop: '24px'
      }}>
        <button
          onClick={() => setCurrentProblemIndex(Math.max(0, currentProblemIndex - 1))}
          disabled={currentProblemIndex === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: currentProblemIndex === 0 ? '#e5e7eb' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: currentProblemIndex === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← 이전
        </button>

        {currentProblemIndex === allProblems.length - 1 ? (
          <button
            onClick={handleSubmit}
            style={{
              padding: '12px 32px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            제출하기
          </button>
        ) : (
          <button
            onClick={() => setCurrentProblemIndex(Math.min(allProblems.length - 1, currentProblemIndex + 1))}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            다음 →
          </button>
        )}
      </div>
    </div>
  );
};

export default ProblemSolver;
