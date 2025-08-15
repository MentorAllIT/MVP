// Timezone utility functions for AEST handling

/**
 * Format a date string to AEST timezone display
 * @param dateString - ISO date string
 * @returns Formatted date string in AEST
 */
export const formatToAEST = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};

/**
 * Convert current time to AEST and add specified hours
 * @param hoursToAdd - Number of hours to add (default: 1)
 * @returns ISO string for datetime-local input
 */
export const getMinDateTimeAEST = (hoursToAdd: number = 1): string => {
  const now = new Date();
  // Convert to AEST (UTC+10/+11 depending on DST)
  const aestTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
  aestTime.setHours(aestTime.getHours() + hoursToAdd);
  
  // Convert back to ISO format for the datetime-local input
  return aestTime.toISOString().slice(0, 16);
};

/**
 * Check if a date is in the future relative to AEST
 * @param dateString - ISO date string or Date object
 * @returns boolean indicating if the date is in the future
 */
export const isFutureInAEST = (dateString: string | Date): boolean => {
  const date = new Date(dateString);
  const aestDate = new Date(date.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
  const nowInAEST = new Date(new Date().toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
  
  return aestDate > nowInAEST;
};

/**
 * Validate if a meeting time is valid (in the future) in AEST
 * @param dateString - ISO date string
 * @returns object with isValid boolean and error message if invalid
 */
export const validateMeetingTimeAEST = (dateString: string): { isValid: boolean; error?: string } => {
  if (!dateString) {
    return { isValid: false, error: "Meeting time is required" };
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: "Invalid date format" };
  }

  if (!isFutureInAEST(date)) {
    return { isValid: false, error: "Meeting time must be in the future (AEST)" };
  }

  return { isValid: true };
};
