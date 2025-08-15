"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import styles from "../../../[role]/signup/signup.module.css";

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
    const date = new Date(dateString);
    return date.toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>Loading booking details...</h1>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>❌ Error</h1>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>Booking Not Found</h1>
          <p className={styles.error}>The booking you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const isAlreadyResponded = booking.BookingStatus === "Confirmed" || booking.BookingStatus === "Rescheduled";

  const bookingDetails = (
    <>
      <div className={styles.label}>
        Booking ID: <strong>{booking.BookingID}</strong>
      </div>
      
      <div className={styles.label}>
        Invited by: <strong>{booking.BookerUsername}</strong>
      </div>
      
      <div className={styles.label}>
        Invitee: <strong>{booking.InvitedUsername}</strong>
      </div>
      
      <div className={styles.label}>
        Meeting Time: <strong>{formatDateTime(booking.MeetingTime)}</strong>
      </div>
      
      <div className={styles.label}>
        Current Status: <strong>{booking.BookingStatus}</strong>
      </div>

      {booking.ConfirmationTime && (
        <div className={styles.label}>
          Response Time: <strong>{formatDateTime(booking.ConfirmationTime)}</strong>
        </div>
      )}

      {booking.Notes && (
        <div className={styles.label}>
          Notes: <strong>{booking.Notes}</strong>
        </div>
      )}

      {/* Calendar Download Section */}
      <div style={{ 
        marginTop: "1.5rem",
        padding: "1rem",
        backgroundColor: "#f0f9ff",
        borderRadius: "8px",
        border: "1px solid #0ea5e9"
      }}>
        <h4 style={{ color: "#0c4a6e", marginBottom: "0.75rem", fontSize: "0.9rem", fontWeight: "600" }}>
          📅 Add to Your Calendar
        </h4>
        <p style={{ color: "#075985", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: "1.4" }}>
          Download this meeting to your personal calendar app (Outlook, Apple Calendar, Google Calendar, etc.)
        </p>
        <a 
          href={`/api/booking/${bookingId}/ics`}
          download={`mentorall-meeting-${bookingId}.ics`}
          className={styles.button}
          style={{ 
            backgroundColor: "#0ea5e9",
            borderColor: "#0ea5e9",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
            padding: "0.5rem 1rem"
          }}
        >
          💾 Download Calendar File (.ics)
        </a>
        <div style={{ 
          marginTop: "0.75rem", 
          fontSize: "0.7rem", 
          color: "#64748b" 
        }}>
          💡 The calendar event will include all meeting details and a 15-minute reminder
        </div>
      </div>
    </>
  );

  const actionButtons = !isAlreadyResponded ? (
    <div className={styles.form}>
      {!showRescheduleForm ? (
        <>
          <button
            onClick={() => updateBookingStatus(1)}
            disabled={updating}
            className={styles.button}
            style={{ marginBottom: "1rem", backgroundColor: "#28a745" }}
          >
            {updating ? "Processing..." : "✅ Accept Meeting"}
          </button>
          
          <button
            onClick={() => setShowRescheduleForm(true)}
            disabled={updating}
            className={styles.button}
            style={{ backgroundColor: "#f59e0b" }}
          >
            📅 Reschedule Meeting
          </button>
        </>
      ) : (
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ marginBottom: "1rem", color: "#374151" }}>Select New Meeting Time</h4>
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="datetime-local"
              value={newMeetingTime}
              onChange={(e) => setNewMeetingTime(e.target.value)}
              min={getMinDateTime()}
              className={styles.input}
              style={{ width: "100%", marginBottom: "1rem" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={handleReschedule}
              disabled={updating}
              className={styles.button}
              style={{ backgroundColor: "#f59e0b", borderColor: "#f59e0b" }}
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
              className={styles.button}
              style={{ backgroundColor: "#6b7280", borderColor: "#6b7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className={styles.form}>
      <p><strong>✓ Response Recorded</strong></p>
      <p>You have already {booking.BookingStatus.toLowerCase()} this meeting invitation.</p>
      {booking.BookingStatus === "Confirmed" && (
        <>
          <p style={{ color: "#28a745" }}>
            🎉 Great! The meeting organizer has been notified of your acceptance.
          </p>
          
          {/* Show Google Meet meeting details if available */}
          {booking.GoogleMeetLink && (
            <div style={{ 
              marginTop: "1.5rem",
              padding: "1.5rem",
              backgroundColor: "#eff6ff",
              borderRadius: "8px",
              border: "1px solid #34a853"
            }}>
              <h4 style={{ color: "#137333", marginBottom: "1rem", fontSize: "1rem" }}>
                🎥 Google Meet Details
              </h4>
              {booking.GoogleMeetTitle && (
                <div style={{ color: "#137333", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  <strong>Meeting:</strong> {booking.GoogleMeetTitle}
                </div>
              )}
              {booking.GoogleMeetEventID && (
                <div style={{ color: "#137333", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
                  <strong>Event ID:</strong> {booking.GoogleMeetEventID}
                </div>
              )}
              <a 
                href={booking.GoogleMeetLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.button}
                style={{ 
                  backgroundColor: "#34a853",
                  borderColor: "#34a853",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "0.5rem"
                }}
              >
                📹 Join Google Meet
              </a>
              <div style={{ 
                marginTop: "0.75rem", 
                fontSize: "0.75rem", 
                color: "#6b7280" 
              }}>
                💡 This meeting has been added to your Google Calendar
              </div>
            </div>
          )}
          
          {/* Show Google Meet creation notification if just created */}
          {googleMeetData && (
            <div style={{ 
              marginTop: "1rem",
              padding: "1rem",
              backgroundColor: "#dcfce7",
              borderRadius: "8px",
              border: "1px solid #16a34a"
            }}>
              <p style={{ color: "#166534", fontWeight: "600", margin: 0 }}>
                ✅ Google Meet created successfully! Details are shown above.
              </p>
            </div>
          )}
        </>
      )}
      {booking.BookingStatus === "Rescheduled" && (
        <div>
          <p style={{ color: "#f59e0b" }}>
            📅 Meeting has been rescheduled. The organizer has been notified of the new time.
          </p>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            The updated calendar event with the new time is available for download above.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Meeting Invitation</h1>
        
        {bookingDetails}
        
        {!isAlreadyResponded && (
          <p style={{ margin: "1.5rem 0 1rem 0", fontWeight: "500" }}>
            Please respond to this meeting invitation:
          </p>
        )}
        
        {actionButtons}

        {error && <p className={styles.error}>{error}</p>}
        {success && <p style={{ color: "#28a745", marginTop: "1rem" }}>✅ {success}</p>}
      </div>
    </div>
  );
}
