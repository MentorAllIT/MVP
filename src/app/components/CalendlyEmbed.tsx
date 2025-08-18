"use client";

import { useEffect } from "react";

export default function CalendlyEmbed({
  url,
  mentorUid,
}: {
  url: string;
  mentorUid?: string;
}) {
  useEffect(() => {
    // inject the Calendly widget script
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    // handle postMessage events
    function handleMessage(e: MessageEvent) {
      if (e.origin !== "https://calendly.com") return;

      // Calendly sometimes sends a string, sometimes an object
      let msg = e.data;
      if (typeof msg === "string") {
        try {
          msg = JSON.parse(msg);
        } catch {
          console.warn("Calendly message not JSON:", msg);
          return;
        }
      }

      // only care about the “scheduled” event
      if (msg.event !== "calendly.event_scheduled") return;

      const {
        payload: {
          event: { start_time, end_time },
          invitee: { email },
        },
      } = msg;

      console.log(
        `Booking confirmed for ${email} — ${new Date(start_time).toLocaleString()} to ${new Date(end_time).toLocaleString()}`
      );

      fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorUid,
          start_time,
          end_time,
          inviteeEmail: email,
          raw: msg.payload,
        }),
      });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [url, mentorUid]);

  return (
    <div
      className="calendly-inline-widget"
      data-url={url}
      style={{
        minWidth: "100%",
        height: "680px",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#fff",
      }}
    />
  );
}
