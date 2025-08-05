import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import Link from "next/link";
import styles from "./dashboard.module.css";

async function getMentors(uid: string) {
  const url = process.env.NEXT_PUBLIC_BASE_URL + "/api/matches";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
    cache: "no-store",
  });
  const { mentors = [] } = await res.json();
  return mentors as { uid: string; name: string; bio: string }[];
}

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token)
    return (
      <main className={styles.wrapper}>
        <p className={styles.message}>Not signed in.</p>
      </main>
    );

  const { role, uid } = jwt.verify(
    token,
    process.env.JWT_SECRET!
  ) as { role: string; uid: string };

  // mentor view
  if (role === "mentor") {
    return (
      <main className={styles.wrapper}>
        <section className={styles.card}>
          <h1 className={styles.heading}>Thank you for supporting MentorAll 🙌</h1>
          <p className={styles.p}>
            You’ll receive mentee pairings by email as soon as our matching
            algorithm runs. Stay tuned — and thanks again for paying it forward!
          </p>
        </section>
      </main>
    );
  }

  // mentee view
  const mentors = await getMentors(uid);

  if (!mentors.length) {
    return (
      <main className={styles.wrapper}>
        <section className={styles.card}>
          <h1 className={styles.heading}>We’re working on your match!</h1>
          <p className={styles.p}>
            Our team is actively looking for the perfect mentor for you. Check
            back soon.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.wrapper}>
      <h1 className={styles.heading}>
        Your mentor{mentors.length > 1 && "s"}
      </h1>

      <ul className={styles.grid}>
        {mentors.map((m) => (
          <li key={m.uid} className={styles.tile}>
            <Link href={`/mentors/${m.uid}`} className={styles.tileLink}>
              <h2 className={styles.tileTitle}>{m.name}</h2>
              <p className={styles.tileBio}>{m.bio}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
