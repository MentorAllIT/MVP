"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../../meta-setup/metaSetup.module.css";
import { getMinDateTimeAEST, validateMeetingTimeAEST } from "../../../lib/timezone";
import MentorAvailability from "../../components/MentorAvailability";

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
  const [conflictWarning, setConflictWarning] = useState("");
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [useAvailabilityPicker, setUseAvailabilityPicker] = useState(true); // Default to true to show availability immediately
  const [availabilityStatus, setAvailabilityStatus] = useState({
    hasAvailability: true,
    isLoading: false,
    error: null as string | null
  });
  const [showManualInput, setShowManualInput] = useState(false);

  // Get current user from JWT token
  useEffect(() => {
    const getUserFromToken = async () => {
      try {
        console.log('Checking authentication...');
        const response = await fetch('/api/auth/check');
        console.log('Auth check response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Auth check data:', data);
          setCurrentUserId(data.uid);
        } else {
          console.error('Authentication check failed:', response.status);
          const errorData = await response.json();
          console.error('Error details:', errorData);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
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

    // Check for conflicts when meetingTime changes
    if (name === 'meetingTime' && value && mentorUserId) {
      checkTimeConflict(value);
    }
  };

  const checkTimeConflict = async (meetingTime: string) => {
    if (!mentorUserId) return;
    
    try {
      setConflictWarning("");
      const selectedDate = new Date(meetingTime);
      
      // Check for conflicts within the meeting duration window (40 minutes)
      const startTime = new Date(selectedDate.getTime() - 10 * 60 * 1000); // 10 min before (buffer)
      const endTime = new Date(selectedDate.getTime() + 40 * 60 * 1000); // 40 min after (meeting duration)
      
      const response = await fetch(
        `/api/booking-conflicts?mentorUserId=${encodeURIComponent(mentorUserId)}&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.bookedTimes.length > 0) {
          setConflictWarning("⚠️ Warning: This time slot may conflict with an existing booking. Please choose a different time or check with the mentor.");
        }
      }
    } catch (err) {
      console.error('Error checking time conflict:', err);
    }
  };

  const handleTimeSlotSelect = (selectedDateTime: string) => {
    // The selectedDateTime is in datetime-local format (YYYY-MM-DDTHH:MM:SS)
    // representing the AEST time the user selected
    // We can use it directly since it's already in the correct format
    const localDateTime = selectedDateTime.slice(0, 16); // Remove seconds if present
    
    setFormData(prev => ({
      ...prev,
      meetingTime: localDateTime
    }));

    // Clear any previous conflict warning since availability picker already filters booked times
    setConflictWarning("");
  };

  const handleAvailabilityStatus = (status: { hasAvailability: boolean; isLoading: boolean; error: string | null }) => {
    setAvailabilityStatus(status);
    
    // Don't automatically switch to manual input, just update the status
    // Let the user decide when to switch to manual input via the toggle buttons
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

      // Check if time is selected
      if (!formData.meetingTime) {
        setError("Please select a meeting time");
        setLoading(false);
        return;
      }

      // Validate meeting time using utility function
      const validation = validateMeetingTimeAEST(formData.meetingTime);
      if (!validation.isValid) {
        setError(validation.error || "Invalid meeting time");
        setLoading(false);
        return;
      }

      const meetingDate = new Date(formData.meetingTime);

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
          meetingTime: meetingDate.toISOString(), // Store as UTC but will be displayed in AEST
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

  // Get minimum datetime (current time + 1 hour) in AEST
  const getMinDateTime = () => {
    return getMinDateTimeAEST(1);
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
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* Debug info - remove this later
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          padding: "0.5rem", 
          backgroundColor: "#f3f4f6", 
          borderRadius: "4px", 
          marginBottom: "1rem",
          fontSize: "0.75rem",
          color: "#6b7280"
        }}>
          Auth Status: {currentUserId ? `✅ Logged in as ${currentUserId}` : "❌ Not authenticated"}
        </div>
      )} */}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Time Selection Toggle */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {/* Show availability picker option if availability exists or is loading */}
            {(availabilityStatus.hasAvailability || availabilityStatus.isLoading) && (
              <button
                type="button"
                onClick={() => {
                  setUseAvailabilityPicker(true);
                  setShowManualInput(false);
                  setConflictWarning(""); // Clear warning when switching to availability picker
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  background: useAvailabilityPicker ? "#4f46e5" : "white",
                  color: useAvailabilityPicker ? "white" : "#374151",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500"
                }}
              >
                📅 Choose from Available Times
              </button>
            )}
            
            {/* Always show manual input option, but make it more prominent when no availability */}
            <button
              type="button"
              onClick={() => {
                setUseAvailabilityPicker(false);
                setShowManualInput(true);
                setConflictWarning(""); // Clear warning when switching to manual input
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                background: !useAvailabilityPicker ? "#4f46e5" : "white",
                color: !useAvailabilityPicker ? "white" : "#374151",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500"
              }}
            >
              ⏰ Manual Time Entry
            </button>
          </div>
          
          {/* Show helpful message when using manual input and no availability exists */}
          {!useAvailabilityPicker && !availabilityStatus.hasAvailability && !availabilityStatus.isLoading && (
            <div style={{ 
              padding: "0.75rem", 
              backgroundColor: "#f0f9ff", 
              border: "1px solid #0ea5e9", 
              borderRadius: "6px",
              marginBottom: "1rem"
            }}>
              <p style={{ color: "#0c4a6e", fontSize: "0.875rem", margin: 0 }}>
                💡 This mentor's availability schedule isn't set up yet, so you can request any time that works for you. 
                They'll confirm or suggest an alternative time.
              </p>
            </div>
          )}
        </div>

        {/* Availability Picker or Manual Input */}
        {useAvailabilityPicker ? (
          <div style={{ marginBottom: "1.5rem" }}>
            <MentorAvailability
              mentorUserId={mentorUserId || mentorUsername}
              onTimeSlotSelect={handleTimeSlotSelect}
              selectedDateTime={formData.meetingTime ? new Date(formData.meetingTime).toISOString() : undefined}
              shouldFetchAvailability={useAvailabilityPicker}
              onAvailabilityStatus={handleAvailabilityStatus}
            />
          </div>
        ) : (
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
              Select your preferred date and time (will be converted to AEST)
            </div>
            {conflictWarning && (
              <div style={{ 
                marginTop: "0.5rem", 
                padding: "0.75rem", 
                backgroundColor: "#fef3c7", 
                border: "1px solid #f59e0b", 
                borderRadius: "6px" 
              }}>
                <p style={{ color: "#92400e", fontSize: "0.875rem", margin: 0 }}>
                  {conflictWarning}
                </p>
              </div>
            )}
          </div>
        )}

        {conflictWarning && useAvailabilityPicker && (
          <div style={{ 
            marginBottom: "1.5rem",
            padding: "0.75rem", 
            backgroundColor: "#fef3c7", 
            border: "1px solid #f59e0b", 
            borderRadius: "6px" 
          }}>
            <p style={{ color: "#92400e", fontSize: "0.875rem", margin: 0 }}>
              {conflictWarning}
            </p>
          </div>
        )}

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
              <li>{mentorName} will receive your 40-minute meeting request</li>
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
