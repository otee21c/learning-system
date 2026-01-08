/**
 * Date utility functions
 */

/**
 * Get month/week info from date (legacy system - for backward compatibility)
 */
export const getMonthWeek = (dateInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  const week = Math.ceil(dayOfMonth / 7);
  
  return { month, week };
};

/**
 * Format month/week as string
 */
export const formatMonthWeek = (month, week) => {
  return month + '월 ' + week + '주차';
};

/**
 * Get today's month/week info
 */
export const getTodayMonthWeek = () => {
  return getMonthWeek(new Date());
};

/**
 * Format month/round as string (new system)
 */
export const formatMonthRound = (month, round) => {
  if (!round) return month + '월';
  return month + '월 ' + round + '차';
};

/**
 * Find month/round from schedules for a given date
 */
export const getMonthRoundFromSchedules = (dateInput, schedules = []) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  
  for (const schedule of schedules) {
    const start = new Date(schedule.startDate);
    const end = new Date(schedule.endDate);
    end.setHours(23, 59, 59);
    
    if (date >= start && date <= end) {
      return { month: schedule.month, round: schedule.round };
    }
  }
  
  return { month: date.getMonth() + 1, round: null };
};
