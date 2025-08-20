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
}

interface MentorAvailabilityProps {
  mentorUserId: string;
  onTimeSlotSelect: (selectedDateTime: string) => void;
  selectedDateTime?: string;
  shouldFetchAvailability?: boolean; // New prop to control when to fetch
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

const MentorAvailability = ({ mentorUserId, onTimeSlotSelect, selectedDateTime, shouldFetchAvailability = true }: MentorAvailabilityProps) => {
  const [availability, setAvailability] = useState<MentorAvailability | null>(null);
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
      const response = await fetch(`/api/mentor-availability?userId=${encodeURIComponent(mentorUserId)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch mentor availability');
      }

      const data = await response.json();
      setAvailability(data.availability);
    } catch (err) {
      console.error('Error fetching mentor availability:', err);
      setError('Failed to load mentor availability');
    } finally {
      setLoading(false);
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

  const generateTimeSlots = (timeSlot: TimeSlot, date: Date, timezone: string): Array<{ time: string; datetime: string; isBooked?: boolean }> => {
    const slots: Array<{ time: string; datetime: string; isBooked?: boolean }> = [];
    const [startHour, startMinute] = timeSlot.start.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.end.split(':').map(Number);
    
    // Generate 40-minute slots
    for (let hour = startHour; hour < endHour || (hour === endHour && startMinute < endMinute); hour++) {
      for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += 40) {
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
        const now = new Date();
        if (aestDateTime > now) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          
          // For the datetime string, we want to preserve the exact time the user sees
          // So we create a datetime-local compatible string with the AEST time
          const datetimeString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${timeString}:00`;
          
          // Check if this time slot would conflict with any existing bookings
          // For 40-minute meetings, check if any booking falls within this slot's duration
          const isBooked = bookedTimes.some(bookedTime => {
            const bookedDate = new Date(bookedTime);
            const slotEnd = new Date(aestDateTime.getTime() + 40 * 60 * 1000); // 40 minutes after slot start
            
            // Check if the booked time overlaps with this 40-minute slot
            const bookedEnd = new Date(bookedDate.getTime() + 40 * 60 * 1000); // Assume existing bookings are also 40 minutes
            
            return (
              (bookedDate >= aestDateTime && bookedDate < slotEnd) || // Booking starts within this slot
              (bookedEnd > aestDateTime && bookedEnd <= slotEnd) || // Booking ends within this slot
              (bookedDate <= aestDateTime && bookedEnd >= slotEnd) // Booking spans this entire slot
            );
          });
          
          slots.push({
            time: timeString,
            datetime: datetimeString,
            isBooked: isBooked
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
          <h3>Availability Not Available</h3>
          <p>{error || 'Mentor availability not configured'}</p>
          <p>Please contact the mentor directly to schedule a meeting.</p>
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
          const dayKey = DAYS_OF_WEEK[date.getDay()] as keyof WeeklyAvailability;
          const daySlots = availability.weekly[dayKey] || [];
          
          return (
            <div key={date.toISOString()} className={styles.dayColumn}>
              <div className={styles.dayHeader}>
                <div className={styles.dayName}>{DAY_NAMES[dayKey]}</div>
                <div className={styles.dayDate}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
              
              <div className={styles.timeSlots}>
                {daySlots.length === 0 ? (
                  <div className={styles.noSlots}>Not available</div>
                ) : (
                  daySlots.flatMap(slot => 
                    generateTimeSlots(slot, date, availability.timezone)
                  ).map(({ time, datetime, isBooked }) => (
                    <button
                      key={datetime}
                      type="button"
                      onClick={() => !isBooked && onTimeSlotSelect(datetime)}
                      disabled={isBooked}
                      className={`${styles.timeSlot} ${
                        selectedDateTime === datetime ? styles.selected : ''
                      } ${isBooked ? styles.booked : ''}`}
                      title={isBooked ? 'This time slot is already booked' : ''}
                    >
                      {time}
                      {isBooked && <span className={styles.bookedIndicator}>🚫</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
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
