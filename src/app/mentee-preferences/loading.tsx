import styles from "./menteePreferences.module.css";

export default function Loading() {
  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>Loading...</h1>
          <p className={styles.subtitle}>Preparing your preferences form</p>
        </div>

        <div className={styles.card}>
          <div className={styles.form}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.inputGroup}>
                <div className={styles.label}>
                  <div 
                    className={styles.labelText} 
                    style={{ 
                      width: "200px", 
                      height: "20px", 
                      background: "#e5e7eb", 
                      borderRadius: "4px",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }}
                  />
                  <div 
                    className={styles.input} 
                    style={{ 
                      height: "48px", 
                      background: "#f3f4f6", 
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }}
                  />
                </div>
              </div>
            ))}
            
            <div 
              className={styles.button} 
              style={{ 
                background: "#e5e7eb", 
                color: "transparent",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }}
            >
              Loading...
            </div>
          </div>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: "100%" }} />
          </div>
          <span className={styles.progressText}>Final Step</span>
        </div>
      </div>
    </div>
  );
}
