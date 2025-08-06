"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../../[role]/signup/signup.module.css";

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

export default function BookingsListPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("lqweeee"); // This should come from auth

  useEffect(() => {
    loadBookings();
  }, [currentUserId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/booking?userId=${currentUserId}`);
      const data = await response.json();

      if (response.ok) {
        setBookings(data.bookings || []);
      } else {
        setError(data.error || "Failed to load bookings");
      }
    } catch (err) {
      setError("Error loading bookings");
    } finally {
      setLoading(false);
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

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const filteredBookings = {
    upcoming: bookings.filter(b => isUpcoming(b.MeetingTime)),
    past: bookings.filter(b => !isUpcoming(b.MeetingTime))
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>Loading your bookings...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>Error</h1>
          <p style={{ color: "#ef4444", marginTop: "1rem" }}>{error}</p>
          <button onClick={loadBookings} className={styles.button} style={{ marginTop: "1rem" }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>No Bookings Found</h1>
          <p className={styles.subtitle}>You haven't created or received any bookings yet.</p>
          <button 
            onClick={() => router.push("/booking")} 
            className={styles.button}
            style={{ marginTop: "1.5rem" }}
          >
            Create Your First Booking
          </button>
        </div>
      </div>
    );
  }

  const bookingsList = (
    <div className={styles.form}>
      {/* Upcoming Bookings */}
      {filteredBookings.upcoming.length > 0 && (
        <>
          <h3 style={{ marginBottom: "1rem", color: "#374151" }}>Upcoming Meetings</h3>
          {filteredBookings.upcoming.map((booking) => (
            <div key={booking.BookingID} style={{ 
              padding: "1rem", 
              border: "1px solid #e5e7eb", 
              borderRadius: "8px", 
              marginBottom: "1rem",
              backgroundColor: "#f9fafb",
              cursor: "pointer"
            }}
            onClick={() => router.push(`/booking/details/${booking.BookingID}`)}
            >
              <div className={styles.label}>
                <strong>{booking.BookerUsername}</strong> → <strong>{booking.InvitedUsername}</strong>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
                {formatDateTime(booking.MeetingTime)}
              </div>
              <div style={{ 
                marginTop: "0.5rem", 
                padding: "0.25rem 0.75rem", 
                borderRadius: "12px", 
                fontSize: "0.75rem", 
                fontWeight: "600",
                textTransform: "uppercase",
                backgroundColor: booking.BookingStatus === "Confirmed" ? "#dcfce7" : booking.BookingStatus === "Rejected" ? "#fef2f2" : "#fef3c7",
                color: booking.BookingStatus === "Confirmed" ? "#166534" : booking.BookingStatus === "Rejected" ? "#991b1b" : "#92400e",
                display: "inline-block"
              }}>
                {booking.BookingStatus}
              </div>
              <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#4f46e5" }}>
                View Details →
              </div>
            </div>
          ))}
        </>
      )}
      
      {/* Past Bookings */}
      {filteredBookings.past.length > 0 && (
        <>
          <h3 style={{ marginBottom: "1rem", color: "#374151", marginTop: filteredBookings.upcoming.length > 0 ? "2rem" : "0" }}>Past Meetings</h3>
          {filteredBookings.past.map((booking) => (
            <div key={booking.BookingID} style={{ 
              padding: "1rem", 
              border: "1px solid #e5e7eb", 
              borderRadius: "8px", 
              marginBottom: "1rem",
              backgroundColor: "#f9fafb",
              opacity: "0.8",
              cursor: "pointer"
            }}
            onClick={() => router.push(`/booking/details/${booking.BookingID}`)}
            >
              <div className={styles.label}>
                <strong>{booking.BookerUsername}</strong> → <strong>{booking.InvitedUsername}</strong>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
                {formatDateTime(booking.MeetingTime)}
              </div>
              <div style={{ 
                marginTop: "0.5rem", 
                padding: "0.25rem 0.75rem", 
                borderRadius: "12px", 
                fontSize: "0.75rem", 
                fontWeight: "600",
                textTransform: "uppercase",
                backgroundColor: "#f3f4f6",
                color: "#6b7280",
                display: "inline-block"
              }}>
                {booking.BookingStatus}
              </div>
              <div style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
                View Details →
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>My Bookings</h1>
        <p className={styles.subtitle}>Manage your meeting invitations and appointments</p>
        
        <button 
          onClick={() => router.push("/booking")} 
          className={styles.button}
          style={{ marginBottom: "2rem" }}
        >
          + Create New Booking
        </button>

        {bookingsList}
      </div>
    </div>
  );
}
