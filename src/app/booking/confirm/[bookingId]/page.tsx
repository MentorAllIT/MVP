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
}

export default function BookingConfirmPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState("");

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

  const updateBookingStatus = async (status: number) => {
    try {
      setUpdating(true);
      setError("");
      
      const response = await fetch(`/api/booking/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setBooking(prev => prev ? {
          ...prev,
          BookingStatus: status === 1 ? "Confirmed" : "Rejected",
          ConfirmationTime: data.booking.confirmationTime
        } : null);
      } else {
        setError(data.error || "Failed to update booking status");
      }
    } catch (err) {
      setError("Error updating booking status");
    } finally {
      setUpdating(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
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
          <p className={styles.error}>The booking you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const isAlreadyResponded = booking.BookingStatus === "Confirmed" || booking.BookingStatus === "Rejected";

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
    </>
  );

  const actionButtons = !isAlreadyResponded ? (
    <div className={styles.form}>
      <button
        onClick={() => updateBookingStatus(1)}
        disabled={updating}
        className={styles.button}
        style={{ marginBottom: "1rem", backgroundColor: "#28a745" }}
      >
        {updating ? "Processing..." : "✅ Accept Meeting"}
      </button>
      
      <button
        onClick={() => updateBookingStatus(0)}
        disabled={updating}
        className={styles.button}
        style={{ backgroundColor: "#dc3545" }}
      >
        {updating ? "Processing..." : "❌ Decline Meeting"}
      </button>
    </div>
  ) : (
    <div className={styles.form}>
      <p><strong>✓ Response Recorded</strong></p>
      <p>You have already {booking.BookingStatus.toLowerCase()} this meeting invitation.</p>
      {booking.BookingStatus === "Confirmed" && (
        <p style={{ color: "#28a745" }}>
          🎉 Great! The meeting organizer has been notified of your acceptance.
        </p>
      )}
      {booking.BookingStatus === "Rejected" && (
        <p style={{ color: "#dc3545" }}>
          The meeting organizer has been notified that you declined.
        </p>
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
