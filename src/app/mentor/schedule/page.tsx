"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../../mentee/browse/browse.module.css";
import { formatToAEST } from "../../../lib/timezone";
import HamburgerMenu from "../../components/HamburgerMenu";

interface TimeSlot {
  start: string;
  end: string;
}

interface WeeklySchedule {
  Mon: TimeSlot[];
  Tue: TimeSlot[];
  Wed: TimeSlot[];
  Thu: TimeSlot[];
  Fri: TimeSlot[];
  Sat: TimeSlot[];
  Sun: TimeSlot[];
}

interface AvailabilityData {
  timezone: string;
  weekly: WeeklySchedule;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  minNoticeHours: number;
  overrides: Record<string, TimeSlot[]>;
}

interface Session {
  id: string;
  bookingId: string;
  menteeName: string;
  menteeEmail: string;
  meetingTime: string;
  status: string;
  notes?: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = {
  Mon: 'Monday',
  Tue: 'Tuesday', 
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday'
};

export default function MentorSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'availability' | 'sessions' | 'overrides'>('availability');
  
  // Availability data
  const [availability, setAvailability] = useState<AvailabilityData>({
    timezone: "Australia/Sydney",
    weekly: {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: []
    },
    dateRange: { start: null, end: null },
    minNoticeHours: 24,
    overrides: {}
  });
  
  // Sessions data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  
  // Override management
  const [selectedOverrideDate, setSelectedOverrideDate] = useState<string>("");
  const [overrideTimeSlots, setOverrideTimeSlots] = useState<TimeSlot[]>([]);
  const [savingOverrides, setSavingOverrides] = useState(false);
  
  // Error state for time validation
  const [timeValidationErrors, setTimeValidationErrors] = useState<{
    weekly: { [key: string]: number[] }; // day -> array of slot indices with errors
    overrides: number[]; // array of slot indices with errors
  }>({
    weekly: {},
    overrides: []
  });

  // Authentication check
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.uid);
          setUserRole(data.role);
          
          if (data.role !== 'mentor') {
            setError("Access denied. This page is for mentors only.");
            return;
          }
        } else {
          setError("Please sign in to access your schedule");
          router.push('/signin');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setError("Authentication error");
      }
    };
    
    getUserFromToken();
  }, [router]);

  // Load availability and sessions data
  useEffect(() => {
    if (currentUserId && userRole === 'mentor') {
      loadData();
    }
  }, [currentUserId, userRole]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadAvailability(), loadSessions()]);
    setLoading(false);
  };

  // Time validation functions
  const validateTimeSlot = (start: string, end: string): boolean => {
    if (!start || !end) return false;
    const startTime = new Date(`1970-01-01T${start}:00`);
    const endTime = new Date(`1970-01-01T${end}:00`);
    return endTime > startTime;
  };

  const validateWeeklySlots = () => {
    const errors: { [key: string]: number[] } = {};
    
    DAYS.forEach(day => {
      const dayErrors: number[] = [];
      availability.weekly[day as keyof WeeklySchedule].forEach((slot, index) => {
        if (!validateTimeSlot(slot.start, slot.end)) {
          dayErrors.push(index);
        }
      });
      if (dayErrors.length > 0) {
        errors[day] = dayErrors;
      }
    });
    
    setTimeValidationErrors(prev => ({
      ...prev,
      weekly: errors
    }));
    
    return Object.keys(errors).length === 0;
  };

  const validateOverrideSlots = () => {
    const errors: number[] = [];
    
    overrideTimeSlots.forEach((slot, index) => {
      if (!validateTimeSlot(slot.start, slot.end)) {
        errors.push(index);
      }
    });
    
    setTimeValidationErrors(prev => ({
      ...prev,
      overrides: errors
    }));
    
    return errors.length === 0;
  };

  const hasValidationErrors = (): boolean => {
    return Object.keys(timeValidationErrors.weekly).length > 0 || 
           timeValidationErrors.overrides.length > 0;
  };

  const loadAvailability = async () => {
    try {
      const response = await fetch(`/api/meta?uid=${currentUserId}&role=mentor`);
      if (response.ok) {
        const data = await response.json();
        if (data.availabilityJson) {
          const parsed = JSON.parse(data.availabilityJson);
          setAvailability(parsed);
          // Validate after loading
          setTimeout(() => validateWeeklySlots(), 100);
        }
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`/api/booking?userId=${currentUserId}&role=mentor`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.bookings || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const addTimeSlot = (day: keyof WeeklySchedule) => {
    setAvailability(prev => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [day]: [
          ...prev.weekly[day],
          { start: "09:00", end: "17:00" }
        ]
      }
    }));
  };

  const removeTimeSlot = (day: keyof WeeklySchedule, index: number) => {
    setAvailability(prev => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [day]: prev.weekly[day].filter((_, i) => i !== index)
      }
    }));
  };

  const updateTimeSlot = (day: keyof WeeklySchedule, index: number, field: 'start' | 'end', value: string) => {
    setAvailability(prev => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [day]: prev.weekly[day].map((slot, i) => 
          i === index ? { ...slot, [field]: value } : slot
        )
      }
    }));
    
    // Validate after update
    setTimeout(() => validateWeeklySlots(), 0);
  };

  const saveAvailability = async () => {
    if (!currentUserId) return;
    
    // Validate all time slots before saving
    const isValid = validateWeeklySlots();
    if (!isValid) {
      setError("❌ Please fix the time slot errors before saving. End time must be later than start time.");
      return;
    }
    
    setSavingAvailability(true);
    try {
      const formData = new FormData();
      formData.append('uid', currentUserId);
      formData.append('role', 'mentor');
      formData.append('availabilityJson', JSON.stringify(availability));

      const response = await fetch('/api/meta', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setError("");
        // Show success message briefly
        const originalError = error;
        setError("✅ Availability saved successfully!");
        setTimeout(() => setError(originalError), 3000);
      } else {
        setError("Failed to save availability");
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      setError("Error saving availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  const getUpcomingSessions = () => {
    const now = new Date();
    return sessions
      .filter(session => {
        const sessionDate = new Date(session.meetingTime);
        return sessionDate > now && (session.status === 'Confirmed' || session.status === 'Rescheduled');
      })
      .sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime())
      .slice(0, 5);
  };

  const getTodaySessions = () => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.meetingTime);
      return sessionDate >= startOfDay && sessionDate < endOfDay && 
             (session.status === 'Confirmed' || session.status === 'Rescheduled');
    }).sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime());
  };

  // Override management functions
  const addOverrideTimeSlot = () => {
    setOverrideTimeSlots(prev => [...prev, { start: "09:00", end: "17:00" }]);
  };

  const removeOverrideTimeSlot = (index: number) => {
    setOverrideTimeSlots(prev => prev.filter((_, i) => i !== index));
  };

  const updateOverrideTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
    setOverrideTimeSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, [field]: value } : slot
    ));
    
    // Validate after update
    setTimeout(() => validateOverrideSlots(), 0);
  };

  const loadOverrideForDate = (date: string) => {
    if (availability.overrides[date]) {
      // Load existing override
      setOverrideTimeSlots([...availability.overrides[date]]);
    } else {
      // Pre-populate with weekly availability for this day
      const dayOfWeek = getDayOfWeekFromDate(date);
      if (dayOfWeek && availability.weekly[dayOfWeek].length > 0) {
        // Copy the weekly availability slots for this day
        setOverrideTimeSlots([...availability.weekly[dayOfWeek]]);
      } else {
        setOverrideTimeSlots([]);
      }
    }
    
    // Validate after loading
    setTimeout(() => validateOverrideSlots(), 100);
  };

  const getDayOfWeekFromDate = (dateString: string): keyof WeeklySchedule | null => {
    try {
      const date = new Date(dateString);
      const dayNumber = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Convert to our day format
      const dayMap: { [key: number]: keyof WeeklySchedule } = {
        0: 'Sun', // Sunday
        1: 'Mon', // Monday
        2: 'Tue', // Tuesday
        3: 'Wed', // Wednesday
        4: 'Thu', // Thursday
        5: 'Fri', // Friday
        6: 'Sat'  // Saturday
      };
      
      return dayMap[dayNumber] || null;
    } catch {
      return null;
    }
  };

  const isPrePopulatedFromWeekly = (date: string): boolean => {
    // Check if this date has an existing override
    if (availability.overrides[date]) {
      return false;
    }
    
    // Check if current slots match weekly availability
    const dayOfWeek = getDayOfWeekFromDate(date);
    if (!dayOfWeek) return false;
    
    const weeklySlots = availability.weekly[dayOfWeek];
    
    // Compare current override slots with weekly slots
    if (overrideTimeSlots.length !== weeklySlots.length) {
      return false;
    }
    
    return overrideTimeSlots.every((slot, index) => {
      const weeklySlot = weeklySlots[index];
      return weeklySlot && slot.start === weeklySlot.start && slot.end === weeklySlot.end;
    });
  };

  const getWeeklyAvailabilityForDay = (date: string): TimeSlot[] => {
    const dayOfWeek = getDayOfWeekFromDate(date);
    return dayOfWeek ? availability.weekly[dayOfWeek] : [];
  };

  const saveOverrideForDate = () => {
    if (!selectedOverrideDate) return;
    
    // Validate override time slots before saving
    const isValid = validateOverrideSlots();
    if (!isValid) {
      setError("❌ Please fix the time slot errors before saving. End time must be later than start time.");
      return;
    }
    
    setAvailability(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [selectedOverrideDate]: [...overrideTimeSlots]
      }
    }));
    
    setError("✅ Override saved locally! Remember to click 'Save All Overrides' to persist changes.");
    setTimeout(() => setError(""), 3000);
  };

  const removeOverrideForDate = (date: string) => {
    setAvailability(prev => {
      const newOverrides = { ...prev.overrides };
      delete newOverrides[date];
      return {
        ...prev,
        overrides: newOverrides
      };
    });
    
    if (selectedOverrideDate === date) {
      setSelectedOverrideDate("");
      setOverrideTimeSlots([]);
    }
  };

  const saveAllOverrides = async () => {
    if (!currentUserId) return;
    
    // Validate all override time slots before saving
    const isValid = validateOverrideSlots();
    if (!isValid) {
      setError("❌ Please fix the time slot errors before saving. End time must be later than start time.");
      return;
    }
    
    setSavingOverrides(true);
    try {
      const formData = new FormData();
      formData.append('uid', currentUserId);
      formData.append('role', 'mentor');
      formData.append('availabilityJson', JSON.stringify(availability));

      const response = await fetch('/api/meta', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setError("");
        const originalError = error;
        setError("✅ Overrides saved successfully!");
        setTimeout(() => setError(originalError), 3000);
      } else {
        setError("Failed to save overrides");
      }
    } catch (error) {
      console.error('Error saving overrides:', error);
      setError("Error saving overrides");
    } finally {
      setSavingOverrides(false);
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setFullYear(today.getFullYear() + 1);
    return maxDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Manage Schedule</h1>
            <HamburgerMenu />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Loading your schedule...</h1>
              <p className={styles.subtitle}>Please wait while we fetch your availability and sessions</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (error && !error.includes("✅")) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>Manage Schedule</h1>
            <HamburgerMenu />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Error Loading Schedule</h1>
              <p className={styles.subtitle}>{error}</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>⚠️</div>
              <h3>Something went wrong</h3>
              <p>We couldn&apos;t load your schedule at this time.</p>
              <Link href="/dashboard" className={styles.ctaButton}>Go to Dashboard</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Manage Schedule</h1>
          <HamburgerMenu />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1 className={styles.title}>📅 My Schedule</h1>
            <p className={styles.subtitle}>
              Manage your availability and mentoring sessions
            </p>
          </section>

          {/* Tab Navigation */}
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            marginBottom: "2rem",
            borderBottom: "1px solid rgba(102, 77, 162, 0.1)"
          }}>
            <button
              onClick={() => setActiveTab('availability')}
              style={{
                padding: "1rem 2rem",
                background: activeTab === 'availability' ? "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)" : "transparent",
                color: activeTab === 'availability' ? "white" : "#2d1b69",
                border: "none",
                borderBottom: activeTab === 'availability' ? "3px solid #2d1b69" : "3px solid transparent",
                cursor: "pointer",
                fontWeight: "600",
                transition: "all 0.3s ease"
              }}
            >
              ⏰ Set Availability
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              style={{
                padding: "1rem 2rem",
                background: activeTab === 'sessions' ? "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)" : "transparent",
                color: activeTab === 'sessions' ? "white" : "#2d1b69",
                border: "none",
                borderBottom: activeTab === 'sessions' ? "3px solid #2d1b69" : "3px solid transparent",
                cursor: "pointer",
                fontWeight: "600",
                transition: "all 0.3s ease"
              }}
            >
              📋 Manage Sessions
            </button>
            <button
              onClick={() => setActiveTab('overrides')}
              style={{
                padding: "1rem 2rem",
                background: activeTab === 'overrides' ? "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)" : "transparent",
                color: activeTab === 'overrides' ? "white" : "#2d1b69",
                border: "none",
                borderBottom: activeTab === 'overrides' ? "3px solid #2d1b69" : "3px solid transparent",
                cursor: "pointer",
                fontWeight: "600",
                transition: "all 0.3s ease"
              }}
            >
              📝 Manage Overrides
            </button>
          </div>

          {error && error.includes("✅") && (
            <div style={{ 
              marginBottom: "2rem",
              padding: "1rem",
              background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
              borderRadius: "10px",
              border: "1px solid #16a34a",
              borderLeft: "4px solid #16a34a",
              textAlign: "center"
            }}>
              <p style={{ color: "#166534", margin: 0, fontWeight: "600" }}>{error}</p>
            </div>
          )}

          {/* Availability Tab */}
          {activeTab === 'availability' && (
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <div style={{ 
                padding: "2rem",
                background: "rgba(255, 255, 255, 0.9)",
                borderRadius: "20px",
                border: "1px solid rgba(102, 77, 162, 0.1)",
                boxShadow: "0 10px 40px rgba(102, 77, 162, 0.1)",
                backdropFilter: "blur(20px)",
                marginBottom: "2rem"
              }}>
                <h2 style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "700", 
                  color: "#2d1b69", 
                  marginBottom: "1.5rem",
                  textAlign: "center"
                }}>
                  Weekly Availability
                </h2>

                {DAYS.map(day => (
                  <div key={day} style={{ marginBottom: "1.5rem" }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: "0.75rem"
                    }}>
                      <h3 style={{ 
                        fontSize: "1.125rem", 
                        fontWeight: "600", 
                        color: "#2d1b69",
                        margin: 0
                      }}>
                        {DAY_NAMES[day as keyof typeof DAY_NAMES]}
                      </h3>
                      <button
                        onClick={() => addTimeSlot(day as keyof WeeklySchedule)}
                        style={{
                      padding: "0.5rem 1rem",
                      background: savingAvailability 
                        ? "#9ca3af" 
                        : "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      cursor: savingAvailability ? "not-allowed" : "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 15px rgba(45, 27, 105, 0.3)"
                    }}
                      >
                        + Add Time
                      </button>
                    </div>

                    {availability.weekly[day as keyof WeeklySchedule].length === 0 ? (
                      <div style={{ 
                        padding: "1rem",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "8px",
                        color: "#6b7280",
                        textAlign: "center",
                        fontStyle: "italic"
                      }}>
                        No availability set for {DAY_NAMES[day as keyof typeof DAY_NAMES]}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {availability.weekly[day as keyof WeeklySchedule].map((slot, index) => {
                          const hasError = timeValidationErrors.weekly[day]?.includes(index);
                          return (
                          <div key={index} style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "0.75rem",
                            padding: "0.75rem",
                            backgroundColor: hasError ? "rgba(239, 68, 68, 0.1)" : "rgba(102, 77, 162, 0.05)",
                            borderRadius: "8px",
                            border: hasError ? "1px solid #ef4444" : "1px solid rgba(102, 77, 162, 0.1)"
                          }}>
                            {hasError && (
                              <div style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "0.25rem",
                                color: "#ef4444",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                                position: "absolute",
                                marginTop: "-2.5rem",
                                backgroundColor: "white",
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                border: "1px solid #ef4444"
                              }}>
                                ⚠️ End time must be later than start time
                              </div>
                            )}
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateTimeSlot(day as keyof WeeklySchedule, index, 'start', e.target.value)}
                              style={{
                                padding: "0.5rem",
                                border: hasError ? "2px solid #ef4444" : "1px solid #d1d5db",
                                borderRadius: "6px",
                                fontSize: "0.875rem",
                                backgroundColor: hasError ? "#fef2f2" : "white"
                              }}
                            />
                            <span style={{ color: "#6b7280", fontWeight: "500" }}>to</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateTimeSlot(day as keyof WeeklySchedule, index, 'end', e.target.value)}
                              style={{
                                padding: "0.5rem",
                                border: hasError ? "2px solid #ef4444" : "1px solid #d1d5db",
                                borderRadius: "6px",
                                fontSize: "0.875rem",
                                backgroundColor: hasError ? "#fef2f2" : "white"
                              }}
                            />
                            <button
                              onClick={() => removeTimeSlot(day as keyof WeeklySchedule, index)}
                              style={{
                                padding: "0.5rem",
                                background: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "0.875rem",
                                cursor: "pointer",
                                minWidth: "auto"
                              }}
                            >
                              ×
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ 
                  marginTop: "2rem",
                  padding: "1.5rem",
                  backgroundColor: "rgba(102, 77, 162, 0.05)",
                  borderRadius: "10px",
                  border: "1px solid rgba(102, 77, 162, 0.1)"
                }}>
                  <h4 style={{ 
                    fontSize: "1rem", 
                    fontWeight: "600", 
                    color: "#2d1b69",
                    marginBottom: "1rem"
                  }}>
                    Additional Settings
                  </h4>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ 
                      display: "block", 
                      fontSize: "0.875rem", 
                      fontWeight: "500", 
                      color: "#374151",
                      marginBottom: "0.5rem"
                    }}>
                      Minimum notice required (hours):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="168"
                      value={availability.minNoticeHours}
                      onChange={(e) => setAvailability(prev => ({
                        ...prev,
                        minNoticeHours: parseInt(e.target.value) || 0
                      }))}
                      style={{
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                        width: "120px"
                      }}
                    />
                  </div>
                </div>

                <div style={{ textAlign: "center", marginTop: "2rem" }}>
                  <button
                    onClick={saveAvailability}
                    disabled={savingAvailability}
                    style={{
                      padding: "1rem 2rem",
                      background: savingAvailability 
                        ? "#9ca3af" 
                        : "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "1rem",
                      fontWeight: "600",
                      cursor: savingAvailability ? "not-allowed" : "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 15px rgba(45, 27, 105, 0.3)"
                    }}
                  >
                    {savingAvailability ? "Saving..." : "💾 Save Availability"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
              {/* Today's Sessions */}
              <div style={{ marginBottom: "3rem" }}>
                <h2 style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "700", 
                  color: "#2d1b69", 
                  marginBottom: "1.5rem",
                  borderBottom: "3px solid rgba(102, 77, 162, 0.1)",
                  paddingBottom: "0.5rem"
                }}>
                  📅 Today's Sessions
                </h2>
                {getTodaySessions().length === 0 ? (
                  <div style={{ 
                    padding: "2rem",
                    background: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "15px",
                    textAlign: "center",
                    border: "1px solid rgba(102, 77, 162, 0.1)"
                  }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🌅</div>
                    <h3 style={{ color: "#2d1b69", marginBottom: "0.5rem" }}>No sessions today</h3>
                    <p style={{ color: "#6b7280" }}>Enjoy your free time or check upcoming sessions below!</p>
                  </div>
                ) : (
                  <div style={{ 
                    display: "grid", 
                    gap: "1rem",
                    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"
                  }}>
                    {getTodaySessions().map((session) => (
                      <div 
                        key={session.id}
                        style={{ 
                          padding: "1.5rem", 
                          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                          borderRadius: "15px",
                          border: "1px solid #f59e0b",
                          borderLeft: "4px solid #f59e0b",
                          cursor: "pointer",
                          transition: "transform 0.2s ease"
                        }}
                        onClick={() => router.push(`/booking/details/${session.bookingId}`)}
                      >
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem"
                        }}>
                          <h4 style={{ 
                            fontSize: "1.125rem", 
                            fontWeight: "600", 
                            color: "#92400e",
                            margin: 0
                          }}>
                            {session.menteeName}
                          </h4>
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            backgroundColor: "#16a34a",
                            color: "white",
                            borderRadius: "10px",
                            fontSize: "0.75rem",
                            fontWeight: "600"
                          }}>
                            TODAY
                          </span>
                        </div>
                        <p style={{ color: "#92400e", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                          📧 {session.menteeEmail}
                        </p>
                        <p style={{ color: "#92400e", fontSize: "1rem", fontWeight: "600" }}>
                          🕐 {formatToAEST(session.meetingTime)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Sessions */}
              <div>
                <h2 style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "700", 
                  color: "#2d1b69", 
                  marginBottom: "1.5rem",
                  borderBottom: "3px solid rgba(102, 77, 162, 0.1)",
                  paddingBottom: "0.5rem"
                }}>
                  🔮 Upcoming Sessions
                </h2>
                {getUpcomingSessions().length === 0 ? (
                  <div style={{ 
                    padding: "2rem",
                    background: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "15px",
                    textAlign: "center",
                    border: "1px solid rgba(102, 77, 162, 0.1)"
                  }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📅</div>
                    <h3 style={{ color: "#2d1b69", marginBottom: "0.5rem" }}>No upcoming sessions</h3>
                    <p style={{ color: "#6b7280" }}>New booking requests will appear here once confirmed.</p>
                    <Link href="/mentor/requests" style={{
                      display: "inline-block",
                      marginTop: "1rem",
                      padding: "0.75rem 1.5rem",
                      background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "10px",
                      fontWeight: "600"
                    }}>
                      Check Pending Requests
                    </Link>
                  </div>
                ) : (
                  <div style={{ 
                    display: "grid", 
                    gap: "1rem",
                    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))"
                  }}>
                    {getUpcomingSessions().map((session) => (
                      <div 
                        key={session.id}
                        style={{ 
                          padding: "1.5rem", 
                          background: "rgba(255, 255, 255, 0.9)",
                          borderRadius: "15px",
                          border: "1px solid rgba(102, 77, 162, 0.1)",
                          boxShadow: "0 10px 40px rgba(102, 77, 162, 0.1)",
                          cursor: "pointer",
                          transition: "transform 0.2s ease"
                        }}
                        onClick={() => router.push(`/booking/details/${session.bookingId}`)}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = "translateY(-3px)";
                          e.currentTarget.style.boxShadow = "0 15px 50px rgba(102, 77, 162, 0.15)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 10px 40px rgba(102, 77, 162, 0.1)";
                        }}
                      >
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem"
                        }}>
                          <h4 style={{ 
                            fontSize: "1.125rem", 
                            fontWeight: "600", 
                            color: "#2d1b69",
                            margin: 0
                          }}>
                            {session.menteeName}
                          </h4>
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            backgroundColor: session.status === 'Confirmed' ? "#16a34a" : "#f59e0b",
                            color: "white",
                            borderRadius: "10px",
                            fontSize: "0.75rem",
                            fontWeight: "600"
                          }}>
                            {session.status.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                          📧 {session.menteeEmail}
                        </p>
                        <p style={{ color: "#2d1b69", fontSize: "1rem", fontWeight: "600" }}>
                          🕐 {formatToAEST(session.meetingTime)}
                        </p>
                        {session.notes && (
                          <p style={{ 
                            color: "#6b7280", 
                            fontSize: "0.875rem", 
                            marginTop: "0.75rem",
                            fontStyle: "italic"
                          }}>
                            📝 {session.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ 
                textAlign: "center",
                marginTop: "3rem",
                paddingTop: "2rem",
                borderTop: "1px solid rgba(102, 77, 162, 0.1)"
              }}>
                <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <Link 
                    href="/booking/list"
                    style={{
                      background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                      color: "white",
                      padding: "0.75rem 2rem",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontWeight: "600",
                      transition: "all 0.3s ease",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    📋 View All Bookings
                  </Link>
                  <Link 
                    href="/mentor/requests"
                    style={{
                      background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                      color: "white",
                      padding: "0.75rem 2rem",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontWeight: "600",
                      transition: "all 0.3s ease",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    📬 Pending Requests
                  </Link>
                  <Link 
                    href="/dashboard"
                    style={{
                      background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                      color: "white",
                      padding: "0.75rem 2rem",
                      borderRadius: "10px",
                      textDecoration: "none",
                      fontWeight: "600",
                      transition: "all 0.3s ease",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    🏠 Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Overrides Tab */}
          {activeTab === 'overrides' && (
            <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
              <div style={{ 
                padding: "2rem",
                background: "rgba(255, 255, 255, 0.9)",
                borderRadius: "20px",
                border: "1px solid rgba(102, 77, 162, 0.1)",
                boxShadow: "0 10px 40px rgba(102, 77, 162, 0.1)",
                backdropFilter: "blur(20px)",
                marginBottom: "2rem"
              }}>
                <h2 style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "700", 
                  color: "#2d1b69", 
                  marginBottom: "1rem",
                  textAlign: "center"
                }}>
                  📝 Availability Overrides
                </h2>
                <p style={{ 
                  textAlign: "center", 
                  color: "#6b7280", 
                  marginBottom: "2rem",
                  fontSize: "0.95rem"
                }}>
                  Set custom availability for specific dates that differ from your weekly schedule
                </p>

                {/* Existing Overrides */}
                {Object.keys(availability.overrides).length > 0 && (
                  <div style={{ marginBottom: "2rem" }}>
                    <h3 style={{ 
                      fontSize: "1.25rem", 
                      fontWeight: "600", 
                      color: "#2d1b69",
                      marginBottom: "1rem"
                    }}>
                      📅 Current Overrides
                    </h3>
                    <div style={{ 
                      display: "grid", 
                      gap: "1rem",
                      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))"
                    }}>
                      {Object.entries(availability.overrides)
                        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                        .map(([date, slots]) => (
                        <div 
                          key={date}
                          style={{ 
                            padding: "1.5rem", 
                            background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
                            borderRadius: "15px",
                            border: "1px solid rgba(102, 77, 162, 0.1)",
                            position: "relative"
                          }}
                        >
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "1rem"
                          }}>
                            <div>
                              <h4 style={{ 
                                fontSize: "1rem", 
                                fontWeight: "600", 
                                color: "#2d1b69",
                                margin: "0 0 0.25rem 0"
                              }}>
                                {formatDateForDisplay(date)}
                              </h4>
                              <p style={{ 
                                fontSize: "0.875rem", 
                                color: "#6b7280",
                                margin: 0
                              }}>
                                {slots.length} time slot{slots.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => removeOverrideForDate(date)}
                              style={{
                                padding: "0.5rem",
                                background: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "0.875rem",
                                cursor: "pointer",
                                fontWeight: "600"
                              }}
                            >
                              🗑️ Remove
                            </button>
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {slots.map((slot, index) => (
                              <div key={index} style={{ 
                                padding: "0.75rem",
                                backgroundColor: "rgba(102, 77, 162, 0.1)",
                                borderRadius: "8px",
                                border: "1px solid rgba(102, 77, 162, 0.2)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.5rem"
                              }}>
                                <span style={{ 
                                  fontSize: "0.875rem", 
                                  fontWeight: "600",
                                  color: "#2d1b69"
                                }}>
                                  🕐 {slot.start} - {slot.end}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => {
                              setSelectedOverrideDate(date);
                              loadOverrideForDate(date);
                            }}
                            style={{
                              marginTop: "1rem",
                              width: "100%",
                              padding: "0.75rem",
                              background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                              color: "white",
                              border: "none",
                              borderRadius: "8px",
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            ✏️ Edit Override
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add/Edit Override Section */}
                <div style={{ 
                  padding: "2rem",
                  backgroundColor: "rgba(102, 77, 162, 0.05)",
                  borderRadius: "15px",
                  border: "1px solid rgba(102, 77, 162, 0.1)"
                }}>
                  <h3 style={{ 
                    fontSize: "1.25rem", 
                    fontWeight: "600", 
                    color: "#2d1b69",
                    marginBottom: "1.5rem",
                    textAlign: "center"
                  }}>
                    {selectedOverrideDate ? `✏️ Edit Override for ${formatDateForDisplay(selectedOverrideDate)}` : '➕ Add New Override'}
                  </h3>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ 
                      display: "block", 
                      fontSize: "0.875rem", 
                      fontWeight: "600", 
                      color: "#374151",
                      marginBottom: "0.75rem"
                    }}>
                      📅 Select Date:
                    </label>
                    <input
                      type="date"
                      min={getMinDate()}
                      max={getMaxDate()}
                      value={selectedOverrideDate}
                      onChange={(e) => {
                        setSelectedOverrideDate(e.target.value);
                        loadOverrideForDate(e.target.value);
                      }}
                      style={{
                        padding: "0.75rem",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                        width: "200px"
                      }}
                    />
                  </div>

                  {selectedOverrideDate && (
                    <div>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem"
                      }}>
                        <h4 style={{ 
                          fontSize: "1rem", 
                          fontWeight: "600", 
                          color: "#2d1b69",
                          margin: 0
                        }}>
                          ⏰ Time Slots for {formatDateForDisplay(selectedOverrideDate)}
                        </h4>
                        <button
                          onClick={addOverrideTimeSlot}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          + Add Time Slot
                        </button>
                      </div>

                      {/* Show info message if pre-populated from weekly availability */}
                      {selectedOverrideDate && !availability.overrides[selectedOverrideDate] && 
                       getWeeklyAvailabilityForDay(selectedOverrideDate).length > 0 && 
                       isPrePopulatedFromWeekly(selectedOverrideDate) && (
                        <div style={{ 
                          marginBottom: "1rem",
                          padding: "1rem",
                          background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                          borderRadius: "10px",
                          border: "1px solid #3b82f6",
                          borderLeft: "4px solid #3b82f6"
                        }}>
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "0.5rem",
                            marginBottom: "0.5rem"
                          }}>
                            <span style={{ fontSize: "1.25rem" }}>💡</span>
                            <strong style={{ color: "#1e40af", fontSize: "0.875rem" }}>
                              Pre-populated from Weekly Schedule
                            </strong>
                          </div>
                          <p style={{ 
                            color: "#1e40af", 
                            fontSize: "0.8rem", 
                            margin: 0,
                            lineHeight: "1.4"
                          }}>
                            These time slots match your weekly {DAY_NAMES[getDayOfWeekFromDate(selectedOverrideDate) as keyof typeof DAY_NAMES]} availability. 
                            You can modify them to create a custom schedule for this specific date.
                          </p>
                        </div>
                      )}

                      {overrideTimeSlots.length === 0 ? (
                        <div style={{ 
                          padding: "2rem",
                          backgroundColor: "#f8f9fa",
                          borderRadius: "10px",
                          textAlign: "center",
                          color: "#6b7280",
                          fontStyle: "italic",
                          border: "2px dashed #d1d5db"
                        }}>
                          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📅</div>
                          No availability set for this date<br/>
                          <small>Add time slots or leave empty to block the entire day</small>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {overrideTimeSlots.map((slot, index) => {
                            const hasError = timeValidationErrors.overrides.includes(index);
                            return (
                            <div key={index} style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "0.75rem",
                              padding: "1rem",
                              backgroundColor: hasError ? "rgba(239, 68, 68, 0.1)" : "white",
                              borderRadius: "10px",
                              border: hasError ? "1px solid #ef4444" : "1px solid rgba(102, 77, 162, 0.1)",
                              boxShadow: hasError ? "0 2px 8px rgba(239, 68, 68, 0.1)" : "0 2px 8px rgba(102, 77, 162, 0.05)",
                              position: "relative"
                            }}>
                              {hasError && (
                                <div style={{ 
                                  position: "absolute",
                                  top: "-2.5rem",
                                  left: "0",
                                  right: "0",
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "center",
                                  gap: "0.25rem",
                                  color: "#ef4444",
                                  fontSize: "0.75rem",
                                  fontWeight: "600",
                                  backgroundColor: "white",
                                  padding: "0.25rem 0.5rem",
                                  borderRadius: "4px",
                                  border: "1px solid #ef4444",
                                  zIndex: 10
                                }}>
                                  ⚠️ End time must be later than start time
                                </div>
                              )}
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) => updateOverrideTimeSlot(index, 'start', e.target.value)}
                                style={{
                                  padding: "0.75rem",
                                  border: hasError ? "2px solid #ef4444" : "1px solid #d1d5db",
                                  borderRadius: "8px",
                                  fontSize: "0.875rem",
                                  fontWeight: "500",
                                  backgroundColor: hasError ? "#fef2f2" : "white"
                                }}
                              />
                              <span style={{ 
                                color: "#6b7280", 
                                fontWeight: "600",
                                fontSize: "0.875rem"
                              }}>
                                to
                              </span>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) => updateOverrideTimeSlot(index, 'end', e.target.value)}
                                style={{
                                  padding: "0.75rem",
                                  border: hasError ? "2px solid #ef4444" : "1px solid #d1d5db",
                                  borderRadius: "8px",
                                  fontSize: "0.875rem",
                                  fontWeight: "500",
                                  backgroundColor: hasError ? "#fef2f2" : "white"
                                }}
                              />
                              <button
                                onClick={() => removeOverrideTimeSlot(index)}
                                style={{
                                  padding: "0.75rem",
                                  background: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "8px",
                                  fontSize: "0.875rem",
                                  cursor: "pointer",
                                  fontWeight: "600",
                                  minWidth: "auto"
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ 
                        display: "flex", 
                        gap: "1rem", 
                        justifyContent: "center",
                        marginTop: "2rem"
                      }}>
                        <button
                          onClick={saveOverrideForDate}
                          style={{
                            padding: "0.75rem 1.5rem",
                            background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          💾 Save Override
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOverrideDate("");
                            setOverrideTimeSlots([]);
                          }}
                          style={{
                            padding: "0.75rem 1.5rem",
                            background: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            cursor: "pointer"
                          }}
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save All Changes */}
                <div style={{ textAlign: "center", marginTop: "2rem" }}>
                  <button
                    onClick={saveAllOverrides}
                    disabled={savingOverrides}
                    style={{
                      padding: "1rem 2rem",
                      background: savingOverrides 
                        ? "#9ca3af" 
                        : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "1rem",
                      fontWeight: "600",
                      cursor: savingOverrides ? "not-allowed" : "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 15px rgba(22, 163, 74, 0.3)"
                    }}
                  >
                    {savingOverrides ? "Saving All Overrides..." : "💾 Save All Overrides"}
                  </button>
                  
                  <div style={{ 
                    marginTop: "1rem",
                    fontSize: "0.875rem",
                    color: "#6b7280",
                    fontStyle: "italic"
                  }}>
                    💡 Tip: Overrides take precedence over your weekly availability
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
