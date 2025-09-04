"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./HamburgerMenu.module.css";

type Role = "mentor" | "mentee" | null;

interface HamburgerMenuProps {
  className?: string;
  showBackToDashboard?: boolean;
  theme?: 'light' | 'dark';
}

export default function HamburgerMenu({ className, showBackToDashboard = true, theme = 'light' }: HamburgerMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const [role, setRole] = useState<Role>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // Check role on mount
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoadingRole(true);
        const res = await fetch("/api/auth/check", {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setRole((data?.role as Role) ?? null);
        } else {
          setRole(null);
        }
      } catch {
        setRole(null);
      } finally {
        setLoadingRole(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

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

  const isMentor = role === "mentor";

  // While role loads, show mentee defaults (no flicker)
  const links = [
    showBackToDashboard && { href: "/dashboard", label: "Back to Dashboard" },
    { href: "/profile", label: "Profile" },
    { href: "/booking/list", label: "My Bookings" },
    (loadingRole ? false : isMentor)
      ? { href: "/mentor/connections", label: "My Mentee" }
      : { href: "/mentee/connections", label: "My Connections" },
    (loadingRole ? false : isMentor)
      ? { href: "/mentor/impact", label: "My Impact" }
      : { href: "/mentee/learning", label: "Learning Resources" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className={`${styles.hamburgerContainer} ${className || ''}`}>
      {/* Hamburger Menu Button */}
      <button 
        className={styles.hamburgerButton}
        data-theme={theme}
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
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
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
