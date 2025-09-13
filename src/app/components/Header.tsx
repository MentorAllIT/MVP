import Link from "next/link";
import styles from "./Header.module.css";

interface HeaderProps {
  showSignIn?: boolean;
}

export default function Header({ showSignIn = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.logoContainer}>
          <img src="/MentorAll transparent Full logo.png" alt="MentorAll" className={styles.logo} />
        </Link>
        {showSignIn ? (
          <nav className={styles.nav}>
            <span className={styles.navText}>Already have an account?</span>
            <Link href="/signin" className={styles.navLink}>Sign In</Link>
          </nav>
        ) : (
          <div className={styles.navSpacer}></div>
        )}
      </div>
    </header>
  );
}
