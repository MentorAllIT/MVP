"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import styles from "../../../mentee/browse/browse.module.css";
import { formatToAEST } from "../../../../lib/timezone";
import Link from "next/link";
import HamburgerMenu from "../../../components/HamburgerMenu";

interface Booking {
  BookingID: string;
  BookedByUserID: string;
  InvitedUserID: string;
  MeetingTime: string;
  BookingStatus: string;
  BookerUsername: string;
  InvitedUsername: string;
  Email: string;
  InvitedEmail: string;
  Notes?: string;
  ConfirmationTime?: string;
  // Google Meet details
  GoogleMeetEventID?: string;
  GoogleMeetLink?: string;
  GoogleMeetTitle?: string;
}

export default function BookingConfirmPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState("");
  const [googleMeetData, setGoogleMeetData] = useState<any>(null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newMeetingTime, setNewMeetingTime] = useState("");

  useEffect(() => {
    if (bookingId) {
      loadBookingDetails();
    }
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/booking/${bookingId}`);
      const data = await response.json();

      if (response.ok) {
        setBooking(data.booking);
      } else {
        setError(data.error || "Failed to load booking details");
      }
    } catch (err) {
      setError("Error loading booking details");
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (status: number, rescheduleTime?: string) => {
    try {
      setUpdating(true);
      setError("");
      
      const requestBody: any = { status };
      if (status === 2 && rescheduleTime) {
        requestBody.newMeetingTime = rescheduleTime;
      }
      
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setGoogleMeetData(data.booking?.googleMeet || null);
        setBooking(prev => prev ? {
          ...prev,
          BookingStatus: status === 1 ? "Confirmed" : "Rescheduled",
          ConfirmationTime: data.booking.confirmationTime,
          MeetingTime: data.booking.meetingTime || prev.MeetingTime,
          // Update Google Meet fields if meeting was created
          GoogleMeetEventID: data.booking.googleMeet?.eventId || prev.GoogleMeetEventID,
          GoogleMeetLink: data.booking.googleMeet?.meetLink || prev.GoogleMeetLink,
          GoogleMeetTitle: data.booking.googleMeet?.title || prev.GoogleMeetTitle,
        } : null);
        
        // Hide reschedule form after successful reschedule
        if (status === 2) {
          setShowRescheduleForm(false);
          setNewMeetingTime("");
        }
      } else {
        setError(data.error || "Failed to update booking status");
      }
    } catch (err) {
      setError("Error updating booking status");
    } finally {
      setUpdating(false);
    }
  };

  const handleReschedule = () => {
    if (!newMeetingTime) {
      setError("Please select a new meeting time");
      return;
    }

    const newDate = new Date(newMeetingTime);
    // Convert to AEST for validation
    const aestNewDate = new Date(newDate.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
    const nowInAEST = new Date(new Date().toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
    
    if (aestNewDate <= nowInAEST) {
      setError("New meeting time must be in the future (AEST)");
      return;
    }

    updateBookingStatus(2, newMeetingTime);
  };

  // Get minimum datetime (current time + 1 hour) in AEST
  const getMinDateTime = () => {
    const now = new Date();
    // Convert to AEST (UTC+10/+11 depending on DST)
    const aestTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
    aestTime.setHours(aestTime.getHours() + 1);
    
    // Convert back to ISO format for the datetime-local input
    return aestTime.toISOString().slice(0, 16);
  };

  const formatDateTime = (dateString: string) => {
    return formatToAEST(dateString);
  };

  if (loading) {
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
              <h1 className={styles.title}>Loading booking details...</h1>
              <p className={styles.subtitle}>Please wait while we fetch your meeting information</p>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (error && !booking) {
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
              <h1 className={styles.title}>Error Loading Booking</h1>
              <p className={styles.subtitle}>{error}</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>❌</div>
              <h3>Something went wrong</h3>
              <p>We couldn&apos;t load the booking details you requested.</p>
              <Link href="/mentor/requests" className={styles.ctaButton}>Back to Requests</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!booking) {
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
              <p className={styles.subtitle}>The booking you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            </section>
            
            <div className={styles.emptyBox}>
              <div className={styles.emptyEmoji}>📭</div>
              <h3>Booking Not Found</h3>
              <p>The booking request you&apos;re looking for doesn&apos;t exist.</p>
              <Link href="/mentor/requests" className={styles.ctaButton}>Back to Requests</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isAlreadyResponded = booking.BookingStatus === "Confirmed" || booking.BookingStatus === "Rescheduled";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link href="/" className={styles.logoContainer}>
            <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
          </Link>
          <HamburgerMenu />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <section className={styles.hero}>
            <h1 className={styles.title}>
              {isAlreadyResponded ? "Meeting Response" : "Review Meeting Request"}
            </h1>
            <p className={styles.subtitle}>
              {isAlreadyResponded 
                ? `You have ${booking.BookingStatus.toLowerCase()} this meeting invitation`
                : "Review the details and respond to this meeting invitation"
              }
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
                    <span style={{ fontWeight: "600", color: "#2d1b69", minWidth: "120px" }}>Booking ID:</span>
                    <span style={{ color: "#4b5563" }}>{booking.BookingID}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
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
                  Additional Notes
                </h3>
                <div style={{ 
                  padding: "1.5rem", 
                  background: "linear-gradient(135deg, #fef7e3 0%, #fde68a 20%)", 
                  borderRadius: "15px", 
                  border: "1px solid #f59e0b",
                  borderLeft: "4px solid #f59e0b"
                }}>
                  <p style={{ 
                    color: "#92400e", 
                    margin: 0,
                    lineHeight: "1.5",
                    fontStyle: "italic"
                  }}>
                    {booking.Notes}
                  </p>
                </div>
              </div>
            )}

            {/* Response Actions */}
            {!isAlreadyResponded ? (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ 
                  fontSize: "1.125rem", 
                  fontWeight: "600", 
                  color: "#2d1b69", 
                  marginBottom: "1rem",
                  borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                  paddingBottom: "0.5rem"
                }}>
                  Respond to Meeting
                </h3>
                <div style={{ 
                  padding: "1.5rem", 
                  background: "linear-gradient(135deg, #f8f7fc 0%, #f0edf8 100%)", 
                  borderRadius: "15px", 
                  border: "1px solid rgba(102, 77, 162, 0.1)"
                }}>
                  {!showRescheduleForm ? (
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                      <button
                        onClick={() => updateBookingStatus(1)}
                        disabled={updating}
                        style={{
                          padding: "0.75rem 1.5rem",
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
                        onMouseOver={(e) => !updating && ((e.target as HTMLButtonElement).style.boxShadow = "0 8px 25px rgba(45, 27, 105, 0.5)")}
                        onMouseOut={(e) => !updating && ((e.target as HTMLButtonElement).style.boxShadow = "0 4px 15px rgba(45, 27, 105, 0.3)")}
                      >
                        {updating ? "Processing..." : "✅ Accept Meeting"}
                      </button>
                      
                      <button
                        onClick={() => setShowRescheduleForm(true)}
                        disabled={updating}
                        style={{
                          padding: "0.75rem 1.5rem",
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
                        onMouseOver={(e) => !updating && ((e.target as HTMLButtonElement).style.boxShadow = "0 8px 25px rgba(45, 27, 105, 0.5)")}
                        onMouseOut={(e) => !updating && ((e.target as HTMLButtonElement).style.boxShadow = "0 4px 15px rgba(45, 27, 105, 0.3)")}
                      >
                        📅 Reschedule Meeting
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ marginBottom: "1rem", color: "#374151" }}>Select New Meeting Time</h4>
                      <div style={{ marginBottom: "1rem" }}>
                        <input
                          type="datetime-local"
                          value={newMeetingTime}
                          onChange={(e) => setNewMeetingTime(e.target.value)}
                          min={getMinDateTime()}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "2px solid #e5e7eb",
                            borderRadius: "8px",
                            fontSize: "1rem",
                            marginBottom: "1rem"
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          onClick={handleReschedule}
                          disabled={updating}
                          style={{
                            background: "#f59e0b",
                            color: "white",
                            border: "none",
                            padding: "0.75rem 1.5rem",
                            borderRadius: "10px",
                            fontWeight: "600",
                            cursor: updating ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease"
                          }}
                        >
                          {updating ? "Rescheduling..." : "📅 Confirm Reschedule"}
                        </button>
                        <button
                          onClick={() => {
                            setShowRescheduleForm(false);
                            setNewMeetingTime("");
                            setError("");
                          }}
                          disabled={updating}
                          style={{
                            background: "#6b7280",
                            color: "white",
                            border: "none",
                            padding: "0.75rem 1.5rem",
                            borderRadius: "10px",
                            fontWeight: "600",
                            cursor: updating ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease"
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ 
                  fontSize: "1.125rem", 
                  fontWeight: "600", 
                  color: "#2d1b69", 
                  marginBottom: "1rem",
                  borderBottom: "2px solid rgba(102, 77, 162, 0.1)",
                  paddingBottom: "0.5rem"
                }}>
                  Response Status
                </h3>
                <div style={{ 
                  padding: "1.5rem", 
                  background: booking.BookingStatus === "Confirmed" 
                    ? "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)" 
                    : "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", 
                  borderRadius: "15px", 
                  border: `1px solid ${booking.BookingStatus === "Confirmed" ? "#16a34a" : "#f59e0b"}`,
                  borderLeft: `4px solid ${booking.BookingStatus === "Confirmed" ? "#16a34a" : "#f59e0b"}`
                }}>
                  <p style={{ 
                    color: booking.BookingStatus === "Confirmed" ? "#166534" : "#92400e", 
                    margin: "0 0 1rem 0",
                    fontSize: "1rem",
                    fontWeight: "600"
                  }}>
                    ✓ Response Recorded
                  </p>
                  <p style={{ 
                    color: booking.BookingStatus === "Confirmed" ? "#166534" : "#92400e", 
                    margin: 0,
                    lineHeight: "1.5"
                  }}>
                    You have {booking.BookingStatus.toLowerCase()} this meeting invitation.
                    {booking.BookingStatus === "Confirmed" && " The meeting organizer has been notified of your acceptance."}
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div style={{ 
                marginBottom: "2rem",
                padding: "1rem",
                background: "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)",
                borderRadius: "10px",
                border: "1px solid #ef4444",
                borderLeft: "4px solid #ef4444"
              }}>
                <p style={{ color: "#dc2626", margin: 0, fontWeight: "600" }}>❌ {error}</p>
              </div>
            )}

            {success && (
              <div style={{ 
                marginBottom: "2rem",
                padding: "1rem",
                background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
                borderRadius: "10px",
                border: "1px solid #16a34a",
                borderLeft: "4px solid #16a34a"
              }}>
                <p style={{ color: "#166534", margin: 0, fontWeight: "600" }}>✅ {success}</p>
              </div>
            )}

            {/* Navigation */}
            <div style={{ 
              textAlign: "center",
              paddingTop: "2rem",
              borderTop: "1px solid rgba(102, 77, 162, 0.1)"
            }}>
              <Link 
                href="/mentor/requests"
                style={{
                  background: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
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
                onMouseOver={(e) => ((e.target as HTMLAnchorElement).style.transform = "translateY(-2px)")}
                onMouseOut={(e) => ((e.target as HTMLAnchorElement).style.transform = "translateY(0)")}
              >
                ← Back to Requests
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
