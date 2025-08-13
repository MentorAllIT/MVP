"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../../meta-setup/metaSetup.module.css";

interface MentorBookingFormProps {
  mentorName: string;
  mentorUsername: string;
  mentorUserId?: string;
}

const MentorBookingForm = ({ mentorName, mentorUsername, mentorUserId }: MentorBookingFormProps) => {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    meetingTime: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Get current user from JWT token
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.uid);
        }
      } catch (error) {
        console.error('Error getting user from token:', error);
      }
    };
    
    getUserFromToken();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Check if we have current user ID
      if (!currentUserId) {
        setError("Please sign in to book a session");
        setLoading(false);
        return;
      }

      // Validate meeting time
      const meetingDate = new Date(formData.meetingTime);
      if (meetingDate <= new Date()) {
        setError("Meeting time must be in the future");
        setLoading(false);
        return;
      }

      // Create booking
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentUserId: currentUserId,
          invitedUsername: mentorUsername,
          invitedUserId: mentorUserId,
          meetingTime: formData.meetingTime,
          notes: formData.notes || ""
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setBookingId(data.bookingId);
        // Reset form
        setFormData({
          meetingTime: "",
          notes: ""
        });

        // Redirect to booking details after 2 seconds
        setTimeout(() => {
          if (data.bookingId) {
            router.push(`/booking/details/${data.bookingId}`);
          } else {
            router.push("/booking/list");
          }
        }, 2000);
      } else {
        setError(data.error || "Failed to create booking");
      }
    } catch (err) {
      setError("An error occurred while creating the booking");
    } finally {
      setLoading(false);
    }
  };

  // Get minimum datetime (current time + 1 hour)
  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  if (success) {
    return (
      <div style={{ 
        padding: "2rem", 
        backgroundColor: "#dcfce7", 
        borderRadius: "8px", 
        border: "1px solid #16a34a",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✅</div>
        <h3 style={{ color: "#16a34a", marginBottom: "0.5rem" }}>Booking Request Sent!</h3>
        <p style={{ color: "#166534", marginBottom: "1rem" }}>
          Your meeting request has been sent to <strong>{mentorName}</strong>. 
          They will receive a notification to confirm or decline the meeting.
        </p>
        <p style={{ color: "#166534", fontSize: "0.875rem", marginBottom: "1rem" }}>
          📅 <strong>Calendar event will be created</strong> once the mentor confirms your booking.
        </p>
        
        {/* Calendar Download Section */}
        {bookingId && (
          <div style={{ 
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#f0f9ff",
            borderRadius: "6px",
            border: "1px solid #0ea5e9"
          }}>
            <h4 style={{ color: "#0c4a6e", marginBottom: "0.75rem", fontSize: "0.85rem", fontWeight: "600" }}>
              📅 Add to Your Calendar
            </h4>
            <p style={{ color: "#075985", fontSize: "0.75rem", marginBottom: "0.75rem", lineHeight: "1.4" }}>
              Download this meeting to your personal calendar (Outlook, Apple Calendar, Google Calendar, etc.)
            </p>
            <a 
              href={`/api/booking/${bookingId}/ics`}
              download={`mentorall-meeting-${bookingId}.ics`}
              style={{ 
                backgroundColor: "#0ea5e9",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8rem",
                fontWeight: "500",
                border: "1px solid #0ea5e9"
              }}
            >
              💾 Download Calendar File
            </a>
            <div style={{ 
              marginTop: "0.5rem", 
              fontSize: "0.65rem", 
              color: "#64748b" 
            }}>
              💡 Includes 15-minute reminder and all meeting details
            </div>
          </div>
        )}
        
        <p style={{ color: "#166534", fontSize: "0.875rem", marginTop: "1rem" }}>
          Redirecting to booking details...
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="meetingTime" className={styles.label}>
            Preferred Meeting Time *
          </label>
          <input
            type="datetime-local"
            id="meetingTime"
            name="meetingTime"
            value={formData.meetingTime}
            onChange={handleInputChange}
            min={getMinDateTime()}
            required
            className={styles.input}
            style={{ color: "#000" }}
          />
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
            Select your preferred date and time for the meeting
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="notes" className={styles.label}>
            Meeting Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder={`Tell ${mentorName} what you'd like to discuss or any specific questions you have...`}
            rows={4}
            className={styles.input}
            style={{ 
              color: "#000",
              resize: "vertical",
              minHeight: "100px"
            }}
          />
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
            Share your goals, questions, or topics you'd like to cover
          </div>
        </div>

        {error && (
          <div style={{ 
            padding: "0.75rem", 
            backgroundColor: "#fef2f2", 
            border: "1px solid #fecaca", 
            borderRadius: "6px", 
            marginBottom: "1rem"
          }}>
            <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: 0 }}>
              {error}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={styles.button}
          style={{
            width: "100%",
            backgroundColor: loading ? "#9ca3af" : "#4f46e5",
            borderColor: loading ? "#9ca3af" : "#4f46e5"
          }}
        >
          {loading ? "Sending Request..." : `📅 Request Meeting with ${mentorName}`}
        </button>

        <div style={{ 
          marginTop: "1rem", 
          padding: "1rem", 
          backgroundColor: "#eff6ff", 
          borderRadius: "6px",
          border: "1px solid #bfdbfe"
        }}>
          <div style={{ fontSize: "0.875rem", color: "#1e40af" }}>
            <strong>How it works:</strong>
            <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
              <li>{mentorName} will receive your meeting request</li>
              <li>They can confirm or suggest an alternative time</li>
              <li>You&apos;ll receive a notification with their response</li>
              <li>Once confirmed, you&apos;ll receive calendar details and meeting instructions</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MentorBookingForm;
