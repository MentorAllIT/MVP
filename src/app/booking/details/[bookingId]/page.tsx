"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../[role]/signup/signup.module.css";

interface BookingDetails {
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

export default function BookingDetailsPage({ params }: { params: { bookingId: string } }) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [currentUserId] = useState("lqweeee"); // This should come from auth

  useEffect(() => {
    loadBookingDetails();
  }, [params.bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/booking/${params.bookingId}`);
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

  const updateBookingStatus = async (status: "Confirmed" | "Rejected") => {
    try {
      setUpdating(true);
      const statusParam = status === "Confirmed" ? 1 : 0;
      const response = await fetch(`/api/booking/${params.bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: statusParam })
      });

      const data = await response.json();

      if (response.ok) {
        setBooking(prev => prev ? { ...prev, BookingStatus: status, ConfirmationTime: new Date().toISOString() } : null);
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

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const canManageBooking = () => {
    return booking && booking.InvitedUserID === currentUserId && booking.BookingStatus === "Pending";
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

  if (error || !booking) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>Error</h1>
          <p style={{ color: "#ef4444", marginTop: "1rem" }}>{error || "Booking not found"}</p>
          <button 
            onClick={() => router.push("/booking/list")} 
            className={styles.button}
            style={{ marginTop: "1rem" }}
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Meeting Details</h1>
        <p className={styles.subtitle}>Review and manage your meeting invitation</p>
        
        <div className={styles.form}>
          {/* Meeting Information */}
          <div style={{ marginBottom: "2rem" }}>
            <div className={styles.label}>Meeting Participants</div>
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#f9fafb", 
              borderRadius: "8px", 
              marginTop: "0.5rem",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ marginBottom: "0.5rem" }}>
                <strong>Organizer:</strong> {booking.BookerUsername} ({booking.Email})
              </div>
              <div>
                <strong>Invited:</strong> {booking.InvitedUsername} ({booking.InvitedEmail})
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <div className={styles.label}>Meeting Time</div>
            <div style={{ 
              padding: "1rem", 
              backgroundColor: "#f9fafb", 
              borderRadius: "8px", 
              marginTop: "0.5rem",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "1.125rem", fontWeight: "600", color: "#374151" }}>
                {formatDateTime(booking.MeetingTime)}
              </div>
              {isUpcoming(booking.MeetingTime) ? (
                <div style={{ color: "#059669", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  ⏰ Upcoming meeting
                </div>
              ) : (
                <div style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                  📅 Past meeting
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <div className={styles.label}>Status</div>
            <div style={{ marginTop: "0.5rem" }}>
              <span style={{ 
                padding: "0.5rem 1rem", 
                borderRadius: "12px", 
                fontSize: "0.875rem", 
                fontWeight: "600",
                textTransform: "uppercase",
                backgroundColor: booking.BookingStatus === "Confirmed" ? "#dcfce7" : booking.BookingStatus === "Rejected" ? "#fef2f2" : "#fef3c7",
                color: booking.BookingStatus === "Confirmed" ? "#166534" : booking.BookingStatus === "Rejected" ? "#991b1b" : "#92400e"
              }}>
                {booking.BookingStatus}
              </span>
            </div>
          </div>

          {booking.Notes && (
            <div style={{ marginBottom: "2rem" }}>
              <div className={styles.label}>Notes</div>
              <div style={{ 
                padding: "1rem", 
                backgroundColor: "#f9fafb", 
                borderRadius: "8px", 
                marginTop: "0.5rem",
                border: "1px solid #e5e7eb",
                whiteSpace: "pre-wrap"
              }}>
                {booking.Notes}
              </div>
            </div>
          )}

          {booking.ConfirmationTime && (
            <div style={{ marginBottom: "2rem" }}>
              <div className={styles.label}>Response Time</div>
              <div style={{ 
                fontSize: "0.875rem", 
                color: "#6b7280", 
                marginTop: "0.5rem" 
              }}>
                {formatDateTime(booking.ConfirmationTime)}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "2rem" }}>
            {canManageBooking() && (
              <>
                <button
                  onClick={() => updateBookingStatus("Confirmed")}
                  disabled={updating}
                  className={styles.button}
                  style={{ 
                    backgroundColor: "#059669",
                    borderColor: "#059669"
                  }}
                >
                  {updating ? "Updating..." : "✓ Confirm Meeting"}
                </button>
                <button
                  onClick={() => updateBookingStatus("Rejected")}
                  disabled={updating}
                  className={styles.button}
                  style={{ 
                    backgroundColor: "#dc2626",
                    borderColor: "#dc2626"
                  }}
                >
                  {updating ? "Updating..." : "✗ Decline Meeting"}
                </button>
              </>
            )}
            
            <button
              onClick={() => router.push("/booking/list")}
              className={styles.button}
              style={{ 
                backgroundColor: "#6b7280",
                borderColor: "#6b7280"
              }}
            >
              ← Back to Bookings
            </button>
          </div>

          {/* Additional Information */}
          <div style={{ 
            marginTop: "2rem", 
            padding: "1rem", 
            backgroundColor: "#eff6ff", 
            borderRadius: "8px",
            border: "1px solid #bfdbfe"
          }}>
            <div style={{ fontSize: "0.875rem", color: "#1e40af" }}>
              <strong>Booking ID:</strong> {booking.BookingID}
            </div>
            {canManageBooking() && (
              <div style={{ fontSize: "0.875rem", color: "#1e40af", marginTop: "0.5rem" }}>
                💡 As the invited participant, you can confirm or decline this meeting above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
