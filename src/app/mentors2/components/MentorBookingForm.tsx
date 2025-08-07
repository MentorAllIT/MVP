"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../[role]/signup/signup.module.css";

interface MentorBookingFormProps {
  mentorName: string;
  mentorUsername: string;
  mentorUserId?: string;
}

export default function MentorBookingForm({ mentorName, mentorUsername, mentorUserId }: MentorBookingFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    meetingTime: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
      // Validate meeting time
      const meetingDate = new Date(formData.meetingTime);
      const now = new Date();
      
      if (meetingDate <= now) {
        setError("Meeting time must be in the future");
        return;
      }

      // Create booking
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invitedUsername: mentorUsername,
          invitedUserId: mentorUserId, // Include the actual userId for better API handling
          meetingTime: formData.meetingTime,
          notes: formData.notes || ""
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Reset form
        setFormData({
          meetingTime: "",
          notes: ""
        });

        // Redirect to booking confirmation after 2 seconds
        setTimeout(() => {
          if (data.bookingId) {
            router.push(`/booking/confirm/${data.bookingId}`);
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
        <p style={{ color: "#166534", fontSize: "0.875rem" }}>
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
              <li>You'll receive a notification with their response</li>
              <li>Once confirmed, you'll get meeting details</li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}
