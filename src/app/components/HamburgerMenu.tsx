"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./HamburgerMenu.module.css";

interface HamburgerMenuProps {
  className?: string;
}

export default function HamburgerMenu({ className }: HamburgerMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && !(event.target as Element).closest(`.${styles.hamburgerButton}`)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Sign out failed:", error);
    }
    setIsMenuOpen(false);
  };

  return (
    <div className={`${styles.hamburgerContainer} ${className || ''}`}>
      {/* Hamburger Menu Button */}
      <button 
        className={styles.hamburgerButton}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isMenuOpen}
      >
        <span className={styles.hamburgerLine}></span>
        <span className={styles.hamburgerLine}></span>
        <span className={styles.hamburgerLine}></span>
      </button>

      {/* Navigation Menu */}
      <div className={`${styles.menu} ${isMenuOpen ? styles.menuOpen : ''}`}>
        <nav className={styles.nav}>
          <Link href="/profile" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
            Profile
          </Link>
          <Link href="/booking/list" className={styles.navLink} onClick={() => setIsMenuOpen(false)}>
            My Bookings
          </Link>
          <button 
            onClick={handleSignOut}
            className={styles.navLink}
          >
            Sign Out
          </button>
        </nav>
      </div>
    </div>
  );
}
