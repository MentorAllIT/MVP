"use client";

import { useState, useEffect } from "react";
import styles from "./MentorAvailability.module.css";

interface TimeSlot {
  start: string;
  end: string;
}

interface WeeklyAvailability {
  Mon: TimeSlot[];
  Tue: TimeSlot[];
  Wed: TimeSlot[];
  Thu: TimeSlot[];
  Fri: TimeSlot[];
  Sat: TimeSlot[];
  Sun: TimeSlot[];
}

interface MentorAvailability {
  timezone: string;
  weekly: WeeklyAvailability;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  minNoticeHours: number;
  overrides: Record<string, TimeSlot[]>;
}

interface MentorAvailabilityProps {
  mentorUserId: string;
  onTimeSlotSelect: (selectedDateTime: string) => void;
  selectedDateTime?: string;
  shouldFetchAvailability?: boolean; // New prop to control when to fetch
  onAvailabilityStatus?: (status: { hasAvailability: boolean; isLoading: boolean; error: string | null }) => void; // New callback
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday'
};

const MentorAvailability = ({ mentorUserId, onTimeSlotSelect, selectedDateTime, shouldFetchAvailability = true, onAvailabilityStatus }: MentorAvailabilityProps) => {
  const [availability, setAvailability] = useState<MentorAvailability | null>(null);
  const [dailyAvailabilities, setDailyAvailabilities] = useState<Record<string, TimeSlot[]>>({});
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(getWeekStart(new Date()));

  useEffect(() => {
    if (shouldFetchAvailability) {
      fetchMentorAvailability();
      fetchBookedTimes();
    }
  }, [mentorUserId, shouldFetchAvailability, selectedWeekStart]);

  const fetchMentorAvailability = async () => {
    try {
      setLoading(true);
      onAvailabilityStatus?.({ hasAvailability: false, isLoading: true, error: null });
      
      // First, get the base availability configuration
      const response = await fetch(`/api/mentor-availability?userId=${encodeURIComponent(mentorUserId)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch mentor availability');
      }

      const data = await response.json();
      setAvailability(data.availability);

      // If we have availability, fetch date-specific data for the current week
      if (data.availability) {
        await fetchWeeklyAvailabilities(data.availability);
        onAvailabilityStatus?.({ hasAvailability: true, isLoading: false, error: null });
      } else {
        onAvailabilityStatus?.({ hasAvailability: false, isLoading: false, error: null });
      }
    } catch (err) {
      console.error('Error fetching mentor availability:', err);
      setError('Failed to load mentor availability');
      onAvailabilityStatus?.({ hasAvailability: false, isLoading: false, error: 'Failed to load mentor availability' });
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyAvailabilities = async (baseAvailability: MentorAvailability) => {
    try {
      const weekDates = getWeekDates(selectedWeekStart);
      const dateStrings = weekDates.map(date => 
        `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
      );

      // Fetch bulk availability for all dates in the week
      const response = await fetch(
        `/api/mentor-availability?userId=${encodeURIComponent(mentorUserId)}&dateRange=${dateStrings.join(',')}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.bulkAvailability) {
          const dailyData: Record<string, TimeSlot[]> = {};
          
          data.bulkAvailability.forEach((dayData: any) => {
            dailyData[dayData.date] = dayData.slots;
          });
          
          setDailyAvailabilities(dailyData);
        }
      } else {
        // Fallback: use weekly schedule without overrides
        const dailyData: Record<string, TimeSlot[]> = {};
        weekDates.forEach((date, index) => {
          const dateString = dateStrings[index];
          const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
          dailyData[dateString] = baseAvailability.weekly[dayOfWeek as keyof WeeklyAvailability] || [];
        });
        setDailyAvailabilities(dailyData);
      }
    } catch (err) {
      console.error('Error fetching weekly availabilities:', err);
      // Fallback to weekly schedule
      const weekDates = getWeekDates(selectedWeekStart);
      const dailyData: Record<string, TimeSlot[]> = {};
      weekDates.forEach((date, index) => {
        const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
        dailyData[dateString] = baseAvailability.weekly[dayOfWeek as keyof WeeklyAvailability] || [];
      });
      setDailyAvailabilities(dailyData);
    }
  };

  const fetchBookedTimes = async () => {
    try {
      // Get start and end of the current week
      const weekEnd = new Date(selectedWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const response = await fetch(
        `/api/booking-conflicts?mentorUserId=${encodeURIComponent(mentorUserId)}&startTime=${selectedWeekStart.toISOString()}&endTime=${weekEnd.toISOString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const bookedTimeStrings = data.bookedTimes.map((booking: any) => 
          new Date(booking.meetingTime).toISOString()
        );
        setBookedTimes(bookedTimeStrings);
      }
    } catch (err) {
      console.error('Error fetching booked times:', err);
      // Don't show error for booked times fetch failure
    }
  };

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

    const generateTimeSlots = (timeSlot: TimeSlot, date: Date, timezone: string, minNoticeHours: number = 0): Array<{ time: string; datetime: string; isBooked?: boolean; tooSoon?: boolean }> => {
    const slots: Array<{ time: string; datetime: string; isBooked?: boolean; tooSoon?: boolean }> = [];
    const [startHour, startMinute] = timeSlot.start.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.end.split(':').map(Number);
    
    // Calculate minimum time based on notice requirement
    const now = new Date();
    const minAllowedTime = new Date(now.getTime() + (minNoticeHours * 60 * 60 * 1000));
    
    // Generate 30-minute slots
    for (let hour = startHour; hour < endHour || (hour === startHour && startMinute < endMinute); hour++) {
      for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 30) {
        if (hour === endHour && minute >= endMinute) break;
        
        // Create a date object representing the exact AEST time
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        
        // Create the datetime in AEST timezone
        const aestDateTime = new Date();
        aestDateTime.setFullYear(year, month, day);
        aestDateTime.setHours(hour, minute, 0, 0);
        
        // Check if this time is in the future
        if (aestDateTime > now) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          // For the datetime string, we want to preserve the exact time the user sees
          // So we create a datetime-local compatible string with the AEST time
          const datetimeString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${timeString}:00`;
          
          // Check if this time slot would conflict with any existing bookings
          // For 30-minute meetings, check if any booking falls within this slot's duration
          const isBooked = bookedTimes.some(bookedTime => {
            const bookedDate = new Date(bookedTime);
            const slotEnd = new Date(aestDateTime.getTime() + 30 * 60 * 1000); // 30 minutes after slot start
            
            // Check if the booked time overlaps with this 30-minute slot
            const bookedEnd = new Date(bookedDate.getTime() + 30 * 60 * 1000); // Assume existing bookings are also 30 minutes
            
            return (
              (bookedDate >= aestDateTime && bookedDate < slotEnd) || // Booking starts within this slot
              (bookedEnd > aestDateTime && bookedEnd <= slotEnd) || // Booking ends within this slot
              (bookedDate <= aestDateTime && bookedEnd >= slotEnd) // Booking spans this entire slot
            );
          });

          // Check if this slot meets minimum notice requirement
          const tooSoon = aestDateTime < minAllowedTime;
          
          slots.push({
            time: timeString,
            datetime: datetimeString,
            isBooked: isBooked,
            tooSoon: tooSoon
          });
        }
      }
    }
    
    return slots;
  };

  const getWeekDates = (weekStart: Date): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(selectedWeekStart);
    newWeekStart.setDate(selectedWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedWeekStart(newWeekStart);
  };

  if (!shouldFetchAvailability) {
    return (
      <div className={styles.container}>
        <div className={styles.info}>
          <h3>📅 Ready to Select Available Times</h3>
          <p>Click "📅 Choose from Available Times" above to see this mentor's availability.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <h3>Loading mentor availability...</h3>
      </div>
    );
  }

  if (error || !availability) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>📅 Availability Not Found</h3>
          <p>{error || 'Mentor availability is not configured yet'}</p>
          <p>📝 You can still request a meeting using manual time entry below.</p>
        </div>
      </div>
    );
  }

  const weekDates = getWeekDates(selectedWeekStart);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Select a Time Slot</h3>
      <p className={styles.subtitle}>
        Choose from available times in {availability.timezone}
        {availability.minNoticeHours > 0 && (
          <span className={styles.noticeInfo}>
            <br />
            ⏰ Minimum {availability.minNoticeHours} hour{availability.minNoticeHours !== 1 ? 's' : ''} notice required
          </span>
        )}
      </p>

      {/* Week Navigation */}
      <div className={styles.weekNavigation}>
        <button 
          type="button"
          onClick={() => navigateWeek('prev')}
          className={styles.navButton}
          disabled={selectedWeekStart <= getWeekStart(new Date())}
        >
          ← Previous Week
        </button>
        <span className={styles.weekRange}>
          {selectedWeekStart.toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
        </span>
        <button 
          type="button"
          onClick={() => navigateWeek('next')}
          className={styles.navButton}
        >
          Next Week →
        </button>
      </div>

      {/* Availability Grid */}
      <div className={styles.availabilityGrid}>
        {weekDates.map((date, index) => {
          const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          const dayKey = DAYS_OF_WEEK[date.getDay()] as keyof WeeklyAvailability;
          
          // Check if this day has an override
          const hasOverride = availability.overrides && availability.overrides[dateString] !== undefined;
          const overrideSlots = hasOverride ? availability.overrides[dateString] : null;
          
          // Use override slots if available, otherwise use weekly schedule
          const daySlots = hasOverride ? (overrideSlots || []) : (availability.weekly[dayKey] || []);
          const weeklySlots = availability.weekly[dayKey] || [];
          
          // Check if we have an override that blocks the day (empty override)
          const isBlockedByOverride = hasOverride && (!overrideSlots || overrideSlots.length === 0);
          
          return (
            <div key={date.toISOString()} className={styles.dayColumn}>
              <div className={styles.dayHeader}>
                <div className={styles.dayName}>
                  {DAY_NAMES[dayKey]}
                  {hasOverride && <span className={styles.overrideIndicator} title="Custom schedule for this date">⭐</span>}
                </div>
                <div className={styles.dayDate}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
              
              <div className={styles.timeSlots}>
                {daySlots.length === 0 ? (
                  // If day is blocked by override, show weekly schedule as "too soon"
                  isBlockedByOverride && weeklySlots.length > 0 ? (
                    weeklySlots.flatMap(slot => 
                      generateTimeSlots(slot, date, availability.timezone, availability.minNoticeHours)
                    ).map(({ time, datetime }) => (
                      <button
                        key={datetime}
                        type="button"
                        disabled={true}
                        className={`${styles.timeSlot} ${styles.tooSoon}`}
                        title="Blocked by custom schedule"
                      >
                        {time}
                        <span className={styles.tooSoonIndicator}>⏰</span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.noSlots}>Not available</div>
                  )
                ) : (
                  daySlots.flatMap(slot => 
                    generateTimeSlots(slot, date, availability.timezone, availability.minNoticeHours)
                  ).map(({ time, datetime, isBooked, tooSoon }) => (
                    <button
                      key={datetime}
                      type="button"
                      onClick={() => !isBooked && !tooSoon && onTimeSlotSelect(datetime)}
                      disabled={isBooked || tooSoon}
                      className={`${styles.timeSlot} ${
                        selectedDateTime === datetime ? styles.selected : ''
                      } ${isBooked ? styles.booked : ''} ${tooSoon ? styles.tooSoon : ''}`}
                      title={
                        isBooked 
                          ? 'This time slot is already booked' 
                          : tooSoon 
                          ? `Requires ${availability.minNoticeHours} hour${availability.minNoticeHours !== 1 ? 's' : ''} notice`
                          : ''
                      }
                    >
                      {time}
                      {isBooked && <span className={styles.bookedIndicator}>🚫</span>}
                      {tooSoon && !isBooked && <span className={styles.tooSoonIndicator}>⏰</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: '#10b981' }}></span>
          Available
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendColor} style={{ backgroundColor: '#ef4444' }}></span>
          🚫 Booked
        </div>
        {(availability.minNoticeHours > 0 || (availability.overrides && Object.keys(availability.overrides).length > 0)) && (
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ backgroundColor: '#f59e0b' }}></span>
            ⏰ Too soon / Blocked
          </div>
        )}
        <div className={styles.legendItem}>
          <span className={styles.overrideIndicator}>⭐</span>
          Custom schedule
        </div>
      </div>

      {selectedDateTime && (
        <div className={styles.selectedTime}>
          <strong>Selected:</strong> {new Date(selectedDateTime).toLocaleString('en-AU', {
            timeZone: availability.timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          })}
        </div>
      )}
    </div>
  );
};

export default MentorAvailability;
