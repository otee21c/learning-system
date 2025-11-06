/**
 * 날짜 관련 유틸리티 함수들
 */

/**
 * 날짜 문자열을 받아서 월/주차 정보를 반환
 * @param {string|Date} dateInput - 날짜 문자열 또는 Date 객체
 * @returns {object} { month: number, week: number }
 */
export const getMonthWeek = (dateInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  
  const month = date.getMonth() + 1; // 1-12
  const dayOfMonth = date.getDate();
  const week = Math.ceil(dayOfMonth / 7); // 1-5
  
  return { month, week };
};

/**
 * 월/주차 정보를 문자열로 반환
 * @param {number} month - 월 (1-12)
 * @param {number} week - 주차 (1-5)
 * @returns {string} "11월 2주차"
 */
export const formatMonthWeek = (month, week) => {
  return `${month}월 ${week}주차`;
};

/**
 * 오늘 날짜의 월/주차 정보 반환
 * @returns {object} { month: number, week: number }
 */
export const getTodayMonthWeek = () => {
  return getMonthWeek(new Date());
};
