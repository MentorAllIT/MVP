"use client";

import { useEffect, useRef } from "react";
import Ballpit from "./Ballpit";
import styles from "./ballpit-bg.module.css";

export default function BallpitBackground() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Responsive count; avoids hydration mismatch by updating after mount
  const cfg = useRef({ count: 160 });
  useEffect(() => {
    const w = window.innerWidth;
    cfg.current.count = w < 640 ? 90 : w < 1024 ? 130 : 200;
  }, []);

  return (
    <div ref={wrapperRef} className={styles.bg} aria-hidden>
      <Ballpit
        // brand-friendly gradient (purple → lilac → pink)
        colors={[0x664DA2, 0xA67FD4, 0xFF94B4]}
        count={cfg.current.count}
        gravity={0.7}
        friction={0.8}
        wallBounce={0.95}
        followCursor={true}
        // slightly larger balls on big screens look nicer
        maxSize={1.1}
        minSize={0.55}
        // calmer speed feels premium
        maxVelocity={0.13}
      />
      <div className={styles.vignette} />
      <div className={styles.scrimTop} />
    </div>
  );
}
