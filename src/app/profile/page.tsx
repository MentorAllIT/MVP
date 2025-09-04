"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./profile.module.css";
import HamburgerMenu from "../components/HamburgerMenu";

interface UserProfile {
  uid: string;
  email: string;
  role: string;
  name?: string;
  createdAt?: string;
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (!res.ok) {
          router.replace("/signin");
          return;
        }

        const userData = await res.json();
        const uid = searchParams.get("uid") || userData.uid;
        
        if (uid) {
          await fetchProfile(uid);
        }
      } catch (err) {
        setError("Failed to load profile");
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, searchParams]);

  const fetchProfile = async (uid: string) => {
    try {
      const res = await fetch(`/api/users?uid=${uid}`);
      if (res.ok) {
        const userData = await res.json();
        setProfile(userData);
      } else {
        setError("Failed to fetch profile");
      }
    } catch (err) {
      setError("Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Profile not found</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Profile</h1>
          <HamburgerMenu theme="light" />
        </div>
      </header>
      
      <div className={styles.card}>
        
        <div className={styles.profileSection}>
          <h2 className={styles.sectionTitle}>Basic Information</h2>
          <div className={styles.field}>
            <label className={styles.label}>Email:</label>
            <span className={styles.value}>{profile.email}</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Role:</label>
            <span className={styles.value}>{profile.role}</span>
          </div>
          {profile.name && (
            <div className={styles.field}>
              <label className={styles.label}>Name:</label>
              <span className={styles.value}>{profile.name}</span>
            </div>
          )}
        </div>

        {profile.createdAt && (
          <div className={styles.profileSection}>
            <h2 className={styles.sectionTitle}>Account Information</h2>
            <div className={styles.field}>
              <label className={styles.label}>Member Since:</label>
              <span className={styles.value}>
                {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button 
            className={styles.editButton}
            onClick={() => router.push(`/profile-setup?uid=${profile.uid}&role=${profile.role}`)}
          >
            Edit Profile
          </button>
          <button 
            className={styles.backButton}
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>Loading profile...</div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
