'use client';

import BookingForm from '../components/BookingForm';
import styles from './booking.module.css';

export default function BookingPage() {
  // For now, we'll use a hardcoded user ID
  // In a real app, you'd get this from authentication/session
  const currentUserId = 'lqweeee'; // Replace with actual logged-in user ID

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>MentorAll - Book a Meeting</h1>
        <p>Schedule a mentoring session with someone from the community</p>
      </header>

      <main className={styles.main}>
        <BookingForm currentUserId={currentUserId} />
      </main>

      <footer className={styles.footer}>
        <p>Current User ID: {currentUserId}</p>
        <p><em>In a real app, this would come from your authentication system</em></p>
      </footer>
    </div>
  );
}
