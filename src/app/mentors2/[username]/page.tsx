// src/app/mentors/[username]/page.tsx

import styles from "./mentor.module.css";
import MentorBookingForm from "../components/MentorBookingForm";

const mentors = {
  mentor1: {
    name: "mentor1",
    image: "/mentor1.jpg",
    field: "Software",
    description:
      "Mentor 1 loves guiding mentees through real-world projects.",
    userId: "mentor1_id", // This should match the UserID in your Airtable
  },
  alice: {
    name: "Alice",
    image: "/mentor2.jpg",
    field: "UI/UX Design & Product Thinking",
    description:
      "Alice mentors on usability, Figma, and building a strong portfolio for aspiring designers.",
    userId: "alice_id", // This should match the UserID in your Airtable
  },
};

export default async function MentorProfile({params}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const mentor = mentors[username as keyof typeof mentors];

  if (!mentor) {
    return <div className={styles.notfound}>Mentor not found</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <img
          src={mentor.image}
          alt={mentor.name}
          className={styles.avatar}
        />
        <div className={styles.info}>
          <h1 className={styles.name}>{mentor.name}</h1>
          <p className={styles.field}>{mentor.field}</p>
          <p className={styles.description}>{mentor.description}</p>
        </div>
      </div>

      <div className={styles.calendarSection}>
        <h2 className={styles.calendarTitle}>📅 Book a Session</h2>
        <MentorBookingForm 
          mentorName={mentor.name}
          mentorUsername={username}
          mentorUserId={mentor.userId}
        />
      </div>
    </div>
  );
}
