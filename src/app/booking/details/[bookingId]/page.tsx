'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../../../mentee/browse/browse.module.css';
import { formatToAEST } from '../../../../lib/timezone';
import HamburgerMenu from '../../../components/HamburgerMenu';

interface BookingDetails {
  id: string;
  BookingId: string;
  BookerUsername: string;
  InvitedUsername: string;
  Email: string;
  InvitedEmail: string;
  MeetingTime: string;
  BookingStatus: string;
  Notes?: string;
  GoogleMeetJoinUrl?: string | { url: string }; // Handle both string and Airtable URL format
}

// Helper function to extract URL from Airtable URL field
const getMeetingUrl = (googleMeetField: any): string | null => {
  console.log('getMeetingUrl input:', googleMeetField);
  console.log('getMeetingUrl input type:', typeof googleMeetField);
  
  // Handle null or undefined
  if (!googleMeetField) {
    console.log('getMeetingUrl: Field is null/undefined');
    return null;
  }
  
  // Handle string directly (most common case from Airtable)
  if (typeof googleMeetField === 'string') {
    const trimmed = googleMeetField.trim();
    console.log('getMeetingUrl: Field is string, trimmed:', trimmed);
    return trimmed || null;
  }
  
  // Handle Airtable URL object: { url: "actual-url" } (fallback case)
  if (typeof googleMeetField === 'object' && googleMeetField.url) {
    console.log('getMeetingUrl: Field has url property:', googleMeetField.url);
    return googleMeetField.url.trim() || null;
  }
  
  // Handle array of URL objects (sometimes Airtable returns arrays)
  if (Array.isArray(googleMeetField) && googleMeetField.length > 0 && googleMeetField[0].url) {
    console.log('getMeetingUrl: Field is array with url:', googleMeetField[0].url);
    return googleMeetField[0].url.trim() || null;
  }
  
  console.log('getMeetingUrl: No valid URL found');
  return null;
};

export default function BookingDetailsPage() {
  console.log('🚀 BookingDetailsPage component loaded');
  
  const params = useParams();
  const bookingId = params.bookingId as string;
  console.log('📝 Booking ID from params:', bookingId);
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newDateTime, setNewDateTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    console.log('🔄 useEffect triggered, bookingId:', bookingId);
    
    const fetchBookingDetails = async () => {
      try {
        console.log('🔍 Fetching booking details for bookingId:', bookingId);
        
        const response = await fetch(`/api/booking?bookingId=${bookingId}`);
        
        console.log('📡 API Response status:', response.status);
        console.log('📡 API Response ok:', response.ok);
        
        if (!response.ok) {
          throw new Error('Failed to fetch booking details');
        }
        
        const data = await response.json();
        console.log('📋 Main API booking data received:', data);
        console.log(' GoogleMeetJoinUrl from main API:', data.GoogleMeetJoinUrl);
        console.log('🔗 Type:', typeof data.GoogleMeetJoinUrl);
        console.log('🔗 Processed URL:', getMeetingUrl(data.GoogleMeetJoinUrl));
        
        setBooking(data);
      } catch (error) {
        console.error('❌ Error fetching booking details:', error);
        setError('Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  const formatDateTime = (dateTimeString: string) => {
    return formatToAEST(dateTimeString);
  };

  const isUpcoming = (dateTimeString: string) => {
    return new Date(dateTimeString) > new Date();
  };

  const handleReschedule = async () => {
    if (!newDateTime || !rescheduleReason.trim()) return;

    setIsRescheduling(true);
    try {
      const response = await fetch('/api/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking?.BookingId,
          newDateTime,
          reason: rescheduleReason,
        }),
      });

      if (response.ok) {
        const updatedBooking = await response.json();
        setBooking(updatedBooking);
        setShowRescheduleForm(false);
        setNewDateTime('');
        setRescheduleReason('');
        alert('Meeting rescheduled successfully!');
      } else {
        alert('Failed to reschedule meeting. Please try again.');
      }
    } catch (error) {
      console.error('Error rescheduling meeting:', error);
      alert('Failed to reschedule meeting. Please try again.');
    } finally {
      setIsRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logoContainer}>
              <Link href="/dashboard" className={styles.logoContainer}></Link>
              <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
            </div>
            <HamburgerMenu />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Loading booking details...</h1>
              <p className={styles.subtitle}>Please wait while we fetch your meeting information</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logoContainer}>
              <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
            </div>
            <HamburgerMenu />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.container}>
            <section className={styles.hero}>
              <h1 className={styles.title}>Booking Not Found</h1>
              <p className={styles.subtitle}>{error || "The booking you're looking for doesn't exist"}</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>❌</div>
              <h3>Something went wrong</h3>
              <p>We couldn&apos;t find the booking details you requested.</p>
              <Link href="/booking/list" className={styles.ctaButton}>Back to My Bookings</Link>
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
          <Link href="/dashboard" className={styles.logoContainer}>
            <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
          </Link>
          <HamburgerMenu />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1 className={styles.title}>Meeting Details</h1>
            <p className={styles.subtitle}>
              {booking.BookingStatus === "Pending" && "Review and manage your meeting invitation"}
              {booking.BookingStatus === "Confirmed" && "Your meeting has been confirmed"}
              {booking.BookingStatus === "Rescheduled" && "Your meeting has been rescheduled"}
            </p>
          </section>

          <div style={{ 
            maxWidth: "800px", 
            margin: "0 auto", 
            padding: "2rem",
            background: "rgba(255, 255, 255, 0.9)",
            borderRadius: "20px",
            border: "1px solid rgba(102, 77, 162, 0.1)",
            boxShadow: "0 10px 40px rgba(102, 77, 162, 0.1)",
            backdropFilter: "blur(20px)"
          }}>
        
            {/* Status Badge */}
            <div style={{ marginBottom: "2rem", textAlign: "center" }}>
              <span style={{
                padding: "0.5rem 1.5rem",
                borderRadius: "25px",
                fontSize: "0.875rem",
                fontWeight: "600",
                textTransform: "uppercase",
                backgroundColor: 
                  booking.BookingStatus === "Confirmed" ? "#dcfce7" :
                  booking.BookingStatus === "Rescheduled" ? "#fef3c7" : "#f3f4f6",
                color: 
                  booking.BookingStatus === "Confirmed" ? "#166534" :
                  booking.BookingStatus === "Rescheduled" ? "#92400e" : "#6b7280",
                border: `1px solid ${
                  booking.BookingStatus === "Confirmed" ? "#16a34a" :
                  booking.BookingStatus === "Rescheduled" ? "#f59e0b" : "#d1d5db"
                }`
              }}>
                {booking.BookingStatus}
              </span>
            </div>

            {/* Meeting Information */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#2d1b69", 
                marginBottom: "1rem",
                borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                paddingBottom: "0.5rem"
              }}>
                Meeting Participants
              </h3>
              <div style={{ 
                padding: "1.5rem", 
                background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                borderRadius: "15px", 
                border: "1px solid rgba(102, 77, 162, 0.1)"
              }}>
                <div style={{ display: "grid", gap: "1rem" }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    padding: "0.75rem",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    border: "1px solid rgba(102, 77, 162, 0.2)"
                  }}>
                    <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "100px" }}>Organizer:</span>
                    <span style={{ color: "#4b5563" }}>{booking.BookerUsername} ({booking.Email})</span>
                  </div>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    padding: "0.75rem",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    border: "1px solid rgba(102, 77, 162, 0.2)"
                  }}>
                    <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "100px" }}>Invited:</span>
                    <span style={{ color: "#4b5563" }}>{booking.InvitedUsername} ({booking.InvitedEmail})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Information */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#2d1b69", 
                marginBottom: "1rem",
                borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                paddingBottom: "0.5rem"
              }}>
                Scheduled Time
              </h3>
              <div style={{ 
                padding: "1.5rem", 
                background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                borderRadius: "15px", 
                border: "1px solid rgba(102, 77, 162, 0.1)"
              }}>
                <div style={{ display: "grid", gap: "1rem" }}>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    padding: "0.75rem",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    border: "1px solid rgba(102, 77, 162, 0.2)"
                  }}>
                    <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "120px" }}>Date & Time:</span>
                    <span style={{ color: "#4b5563" }}>{formatDateTime(booking.MeetingTime)}</span>
                  </div>
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    padding: "0.75rem",
                    backgroundColor: "white",
                    borderRadius: "8px",
                    border: "1px solid rgba(102, 77, 162, 0.2)"
                  }}>
                    <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "120px" }}>Status:</span>
                    <span style={{ color: "#4b5563" }}>
                      {isUpcoming(booking.MeetingTime) ? "⏰ Upcoming meeting" : "📅 Past meeting"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Meeting Link Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#2d1b69", 
                marginBottom: "1rem",
                borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                paddingBottom: "0.5rem"
              }}>
                Meeting Link
              </h3>
              <div style={{ 
                padding: "1.5rem", 
                background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                borderRadius: "15px", 
                border: "1px solid rgba(102, 77, 162, 0.1)"
              }}>
                {(() => {
                  const meetingUrl = getMeetingUrl(booking.GoogleMeetJoinUrl);
                  console.log('🎯 Meeting URL for conditional:', meetingUrl);
                  console.log('🎯 Boolean check:', !!meetingUrl);
                  
                  return meetingUrl ? (
                    <div style={{ 
                      display: "flex", 
                      flexDirection: "column",
                      gap: "1rem"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        padding: "0.75rem",
                        backgroundColor: "white",
                        borderRadius: "8px",
                        border: "1px solid rgba(102, 77, 162, 0.2)"
                      }}>
                        <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "120px" }}>Google Meet:</span>
                        <a 
                          href={meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            color: "#2563eb", 
                            textDecoration: "none",
                            wordBreak: "break-all",
                            flex: 1
                          }}
                          onMouseOver={(e) => (e.target as HTMLElement).style.textDecoration = "underline"}
                          onMouseOut={(e) => (e.target as HTMLElement).style.textDecoration = "none"}
                        >
                          {meetingUrl}
                        </a>
                      </div>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "center",
                        marginTop: "0.5rem"
                      }}>
                        <a 
                          href={meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "0.75rem 1.5rem",
                            background:  "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontWeight: "600",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            transition: "transform 0.2s ease"
                          }}
                          onMouseOver={(e) => (e.target as HTMLElement).style.transform = "translateY(-1px)"}
                          onMouseOut={(e) => (e.target as HTMLElement).style.transform = "translateY(0)"}
                        >
                          🎥 Join Meeting
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ 
                      display: "flex", 
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "2rem",
                      textAlign: "center"
                    }}>
                      <div style={{ 
                        fontSize: "2rem", 
                        marginBottom: "1rem" 
                      }}>
                        ⏳
                      </div>
                      <div style={{ 
                        fontSize: "1rem", 
                        fontWeight: "600", 
                        color: "#2d1b69", 
                        marginBottom: "0.5rem" 
                      }}>
                        Meeting link is generating...
                      </div>
                      <div style={{ 
                        fontSize: "0.875rem", 
                        color: "#6b7280",
                        lineHeight: "1.5"
                      }}>
                        You will be notified when it is generated.
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Notes */}
            {booking.Notes && (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ 
                  fontSize: "1.125rem", 
                  fontWeight: "600", 
                  color: "#2d1b69", 
                  marginBottom: "1rem",
                  borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                  paddingBottom: "0.5rem"
                }}>
                  Notes
                </h3>
                <div style={{ 
                  padding: "1.5rem", 
                  background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                  borderRadius: "15px", 
                  border: "1px solid rgba(102, 77, 162, 0.1)",
                  whiteSpace: "pre-wrap"
                }}>
                  {booking.Notes}
                </div>
              </div>
            )}

            {/* Reschedule Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#2d1b69", 
                marginBottom: "1rem",
                borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                paddingBottom: "0.5rem"
              }}>
                Need to Reschedule?
              </h3>
              <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                <button 
                  onClick={() => setShowRescheduleForm(!showRescheduleForm)}
                  style={{
                    padding: "1rem 2rem",
                    background: showRescheduleForm 
                      ? "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)" 
                      : "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "15px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "1rem",
                    boxShadow: showRescheduleForm 
                      ? "0 4px 15px rgba(220, 38, 38, 0.3)" 
                      : "0 4px 15px rgba(45, 27, 105, 0.3)",
                    transition: "transform 0.2s, box-shadow 0.2s"
                  }}
                >
                  {showRescheduleForm ? "Cancel" : "Reschedule Meeting"}
                </button>
              </div>

              {showRescheduleForm && (
                <div style={{ 
                  padding: "2rem", 
                  background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                  borderRadius: "15px",
                  border: "1px solid rgba(102, 77, 162, 0.2)"
                }}>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "0.75rem", 
                      fontWeight: "600",
                      color: "#2d1b69",
                      fontSize: "1rem"
                    }}>
                      New Date & Time:
                    </label>
                    <input
                      type="datetime-local"
                      value={newDateTime}
                      onChange={(e) => setNewDateTime(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "1rem",
                        border: "2px solid rgba(102, 77, 162, 0.2)",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        backgroundColor: "white",
                        transition: "border-color 0.2s"
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "0.75rem", 
                      fontWeight: "600",
                      color: "#2d1b69",
                      fontSize: "1rem"
                    }}>
                      Reason for rescheduling:
                    </label>
                    <textarea
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      placeholder="Please provide a reason for rescheduling..."
                      style={{
                        width: "100%",
                        padding: "1rem",
                        border: "2px solid rgba(102, 77, 162, 0.2)",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        minHeight: "120px",
                        resize: "vertical",
                        backgroundColor: "white",
                        transition: "border-color 0.2s"
                      }}
                    />
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <button 
                      onClick={handleReschedule}
                      disabled={isRescheduling || !newDateTime || !rescheduleReason.trim()}
                      style={{
                        padding: "1rem 2rem",
                        background: (!newDateTime || !rescheduleReason.trim()) 
                          ? "linear-gradient(135deg, #9ca3af 0%, #d1d5db 100%)" 
                          : "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "15px",
                        cursor: (!newDateTime || !rescheduleReason.trim()) ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        fontSize: "1rem",
                        boxShadow: (!newDateTime || !rescheduleReason.trim()) 
                          ? "none" 
                          : "0 4px 15px rgba(45, 27, 105, 0.3)",
                        transition: "transform 0.2s, box-shadow 0.2s"
                      }}
                    >
                      {isRescheduling ? "Rescheduling..." : "Confirm Reschedule"}
                    </button>
                  </div>
                </div>
              )}
            </div>
             <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ 
                fontSize: "1.125rem", 
                fontWeight: "600", 
                color: "#2d1b69", 
                marginBottom: "1rem",
                borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                paddingBottom: "0.5rem"
              }}>
                Add to Calendar
              </h3>
              <div style={{ 
                padding: "1.5rem", 
                background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                borderRadius: "15px", 
                border: "1px solid rgba(102, 77, 162, 0.1)",
                textAlign: "center"
              }}>
                <p style={{ 
                  color: "#6b7280", 
                  marginBottom: "1.5rem",
                  fontSize: "0.875rem"
                }}>
                  Download a calendar file to add this meeting to your preferred calendar app
                </p>
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `/api/booking/${booking.BookingId}/ics`;
                    link.download = `mentorall-meeting-${booking.BookingId}.ics`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{
                    padding: "1rem 2rem",
                    background: "linear-gradient(135deg, #2d1b69 0%, #4f2d8a 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "15px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "1rem",
                    boxShadow: "0 4px 15px rgba(45, 27, 105, 0.3)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(45, 27, 105, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(45, 27, 105, 0.3)";
                  }}
                >
                  📅 Download ICS File
                </button>
                <div style={{ 
                  marginTop: "1rem", 
                  fontSize: "0.75rem", 
                  color: "#9ca3af"
                }}>
                  Compatible with Google Calendar, Outlook, Apple Calendar, and more
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
