"use client";

import { useState } from "react";
import MentorAvailability from "../components/MentorAvailability";

export default function AvailabilityTestPage() {
  const [selectedMentorUserId, setSelectedMentorUserId] = useState("testUserId123");
  const [selectedDateTime, setSelectedDateTime] = useState<string>("");

  const handleTimeSlotSelect = (datetime: string) => {
    setSelectedDateTime(datetime);
    console.log("Selected datetime:", datetime);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Mentor Availability Test</h1>
      
      <div style={{ marginBottom: "2rem" }}>
        <label htmlFor="mentorUserId">Test Mentor User ID:</label>
        <input
          type="text"
          id="mentorUserId"
          value={selectedMentorUserId}
          onChange={(e) => setSelectedMentorUserId(e.target.value)}
          style={{ 
            margin: "0 1rem", 
            padding: "0.5rem", 
            border: "1px solid #ccc", 
            borderRadius: "4px" 
          }}
        />
      </div>

      {selectedDateTime && (
        <div style={{ 
          padding: "1rem", 
          backgroundColor: "#e6f7ff", 
          border: "1px solid #91d5ff", 
          borderRadius: "8px",
          marginBottom: "2rem"
        }}>
          <strong>Selected Time:</strong> {new Date(selectedDateTime).toLocaleString()}
          <br />
          <strong>ISO String:</strong> {selectedDateTime}
        </div>
      )}

      <MentorAvailability
        mentorUserId={selectedMentorUserId}
        onTimeSlotSelect={handleTimeSlotSelect}
        selectedDateTime={selectedDateTime}
        shouldFetchAvailability={true}
      />
    </div>
  );
}
