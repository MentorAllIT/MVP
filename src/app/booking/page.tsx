"use client";

import BookingForm from "../components/BookingForm";
import styles from "../[role]/signup/signup.module.css";

export default function BookingPage() {
  // For now, we'll use a hardcoded user ID
  // In a real app, you'd get this from authentication/session
  const currentUserId = "lqweeee"; // Replace with actual logged-in user ID

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Book a Meeting</h1>
        <p className={styles.subtitle}>Schedule a mentoring session with someone from the community</p>
        
        <BookingForm currentUserId={currentUserId} />
      </div>
    </div>
  );
}
