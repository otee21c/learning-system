/**
 * OMR 좌표 기반 채점 유틸리티
 * 오늘의 국어 학원 - 45문항 OMR 양식
 * 
 * 사용법:
 * import { gradeOMRFromCanvas, OMR_CONFIG } from '../utils/omrCoordinates';
 * const results = gradeOMRFromCanvas(canvas, answerKey);
 */

// ========================================
// 좌표 설정 (가로 방향 3508 x 2481 기준)
// ========================================
export const OMR_CONFIG = {
  // 이미지 기준 크기
  referenceSize: {
    landscape: { width: 3508, height: 2481 },
    portrait: { width: 2481, height: 3508 }
  },
  
  // Q1-20 (공통과목 - 왼쪽 열)
  Q1_20: {
    choice_1_x: 1805,
    choice_gap: 62,
    first_y: 427,
    question_gap: 93,
    num_questions: 20
  },
  
  // Q21-34 (공통과목 - 가운데 열)
  Q21_34: {
    choice_1_x: 2360,
    choice_gap: 61,
    first_y: 400,
    question_gap: 93,
    num_questions: 14
  },
  
  // Q35-45 (선택과목 - 오른쪽 열)
  Q35_45: {
    choice_1_x: 2955,
    choice_gap: 67,
    first_y: 660,
    question_gap: 99,
    num_questions: 11
  },
  
  // 버블 크기
  bubble: {
    width: 25,
    height: 25
  },
  
  // 인식 임계값 (이 값보다 작으면 마킹으로 인식)
  threshold: 250
};

// ========================================
// 이미지 방향 감지
// ========================================
export function detectOrientation(width, height) {
  return width > height ? 'landscape' : 'portrait';
}

// ========================================
// 좌표 스케일 조정
// ========================================
export function scaleCoordinates(config, actualWidth, actualHeight) {
  const orientation = detectOrientation(actualWidth, actualHeight);
  const refSize = OMR_CONFIG.referenceSize[orientation];
  
  const scaleX = actualWidth / refSize.width;
  const scaleY = actualHeight / refSize.height;
  
  return {
    choice_1_x: Math.round(config.choice_1_x * scaleX),
    choice_gap: Math.round(config.choice_gap * scaleX),
    first_y: Math.round(config.first_y * scaleY),
    question_gap: Math.round(config.question_gap * scaleY),
    num_questions: config.num_questions,
    bubble_w: Math.round(OMR_CONFIG.bubble.width * scaleX),
    bubble_h: Math.round(OMR_CONFIG.bubble.height * scaleY)
  };
}

// ========================================
// 특정 영역의 평균 밝기 계산
// ========================================
export function getRegionBrightness(imageData, x, y, width, height, imgWidth) {
  let sum = 0;
  let count = 0;
  
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(imgWidth, Math.floor(x + width));
  const endY = Math.min(imageData.length / (imgWidth * 4), Math.floor(y + height));
  
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const idx = (py * imgWidth + px) * 4;
      // 그레이스케일 변환: 0.299*R + 0.587*G + 0.114*B
      const gray = imageData[idx] * 0.299 + imageData[idx + 1] * 0.587 + imageData[idx + 2] * 0.114;
      sum += gray;
      count++;
    }
  }
  
  return count > 0 ? sum / count : 255;
}

// ========================================
// 단일 문제 채점
// ========================================
export function gradeQuestion(imageData, imgWidth, config, questionIndex) {
  const y = config.first_y + questionIndex * config.question_gap;
  
  const brightnesses = {};
  for (let choice = 1; choice <= 5; choice++) {
    const x = config.choice_1_x + (choice - 1) * config.choice_gap;
    brightnesses[choice] = getRegionBrightness(
      imageData, x, y, config.bubble_w, config.bubble_h, imgWidth
    );
  }
  
  // 가장 어두운 선지 찾기
  let darkestChoice = 1;
  let darkestValue = brightnesses[1];
  
  for (let choice = 2; choice <= 5; choice++) {
    if (brightnesses[choice] < darkestValue) {
      darkestValue = brightnesses[choice];
      darkestChoice = choice;
    }
  }
  
  // 신뢰도 계산 (두 번째로 어두운 값과의 차이)
  const sortedValues = Object.values(brightnesses).sort((a, b) => a - b);
  const confidence = sortedValues.length > 1 ? sortedValues[1] - sortedValues[0] : 0;
  
  return {
    answer: darkestValue < OMR_CONFIG.threshold ? darkestChoice : null,
    confidence: confidence,
    brightnesses: brightnesses,
    isDark: darkestValue < OMR_CONFIG.threshold
  };
}

// ========================================
// 캔버스에서 전체 OMR 채점
// ========================================
export function gradeOMRFromCanvas(canvas, answerKey = null) {
  const ctx = canvas.getContext('2d');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight).data;
  
  const orientation = detectOrientation(imgWidth, imgHeight);
  
  const results = {
    orientation: orientation,
    imageSize: { width: imgWidth, height: imgHeight },
    answers: {},
    details: [],
    score: null,
    total: null,
    percentage: null,
    wrongAnswers: []
  };
  
  // Q1-20 채점
  const config1_20 = scaleCoordinates(OMR_CONFIG.Q1_20, imgWidth, imgHeight);
  for (let i = 0; i < config1_20.num_questions; i++) {
    const qNum = i + 1;
    const result = gradeQuestion(imageData, imgWidth, config1_20, i);
    results.answers[qNum] = result.answer;
    results.details.push({
      question: qNum,
      section: 'Q1-20',
      ...result
    });
  }
  
  // Q21-34 채점
  const config21_34 = scaleCoordinates(OMR_CONFIG.Q21_34, imgWidth, imgHeight);
  for (let i = 0; i < config21_34.num_questions; i++) {
    const qNum = 21 + i;
    const result = gradeQuestion(imageData, imgWidth, config21_34, i);
    results.answers[qNum] = result.answer;
    results.details.push({
      question: qNum,
      section: 'Q21-34',
      ...result
    });
  }
  
  // Q35-45 채점
  const config35_45 = scaleCoordinates(OMR_CONFIG.Q35_45, imgWidth, imgHeight);
  for (let i = 0; i < config35_45.num_questions; i++) {
    const qNum = 35 + i;
    const result = gradeQuestion(imageData, imgWidth, config35_45, i);
    results.answers[qNum] = result.answer;
    results.details.push({
      question: qNum,
      section: 'Q35-45',
      ...result
    });
  }
  
  // 정답과 비교
  if (answerKey) {
    let correct = 0;
    const total = Object.keys(answerKey).length;
    
    for (const [qNum, expected] of Object.entries(answerKey)) {
      const detected = results.answers[parseInt(qNum)];
      if (detected === expected) {
        correct++;
      } else {
        results.wrongAnswers.push({
          question: parseInt(qNum),
          detected: detected,
          expected: expected
        });
      }
    }
    
    results.score = correct;
    results.total = total;
    results.percentage = Math.round((correct / total) * 1000) / 10;
  }
  
  return results;
}

// ========================================
// 이미지 URL에서 OMR 채점
// ========================================
export async function gradeOMRFromImageUrl(imageUrl, answerKey = null) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      try {
        const results = gradeOMRFromCanvas(canvas, answerKey);
        resolve(results);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = imageUrl;
  });
}

// ========================================
// Base64 이미지에서 OMR 채점
// ========================================
export async function gradeOMRFromBase64(base64Data, answerKey = null) {
  const imageUrl = base64Data.startsWith('data:') 
    ? base64Data 
    : `data:image/jpeg;base64,${base64Data}`;
  
  return gradeOMRFromImageUrl(imageUrl, answerKey);
}

// ========================================
// 디버그용: 그리드 시각화
// ========================================
export function drawDebugGrid(canvas) {
  const ctx = canvas.getContext('2d');
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  
  const sections = [
    { config: OMR_CONFIG.Q1_20, startQ: 1, color: 'red' },
    { config: OMR_CONFIG.Q21_34, startQ: 21, color: 'blue' },
    { config: OMR_CONFIG.Q35_45, startQ: 35, color: 'green' }
  ];
  
  sections.forEach(({ config, startQ, color }) => {
    const scaled = scaleCoordinates(config, imgWidth, imgHeight);
    
    for (let i = 0; i < scaled.num_questions; i++) {
      const y = scaled.first_y + i * scaled.question_gap;
      
      for (let choice = 1; choice <= 5; choice++) {
        const x = scaled.choice_1_x + (choice - 1) * scaled.choice_gap;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + scaled.bubble_w / 2, y + scaled.bubble_h / 2, scaled.bubble_w / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // 문제 번호
      ctx.fillStyle = color;
      ctx.font = '12px Arial';
      ctx.fillText(`Q${startQ + i}`, scaled.choice_1_x - 30, y + scaled.bubble_h / 2 + 4);
    }
  });
}

// ========================================
// 결과 포맷팅 (표시용)
// ========================================
export function formatResults(results) {
  const lines = [];
  
  lines.push(`[공통과목 Q1-20]`);
  for (let i = 1; i <= 20; i++) {
    const ans = results.answers[i];
    lines.push(`${i}.${ans || '-'}`);
  }
  
  lines.push(`\n[공통과목 Q21-34]`);
  for (let i = 21; i <= 34; i++) {
    const ans = results.answers[i];
    lines.push(`${i}.${ans || '-'}`);
  }
  
  lines.push(`\n[선택과목 Q35-45]`);
  for (let i = 35; i <= 45; i++) {
    const ans = results.answers[i];
    lines.push(`${i}.${ans || '-'}`);
  }
  
  if (results.score !== null) {
    lines.push(`\n점수: ${results.score}/${results.total} (${results.percentage}%)`);
  }
  
  return lines.join(' ');
}

export default {
  OMR_CONFIG,
  gradeOMRFromCanvas,
  gradeOMRFromImageUrl,
  gradeOMRFromBase64,
  drawDebugGrid,
  formatResults
};
