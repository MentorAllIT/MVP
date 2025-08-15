"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./metaSetup.module.css";

// Helpers
type FieldErrors = Record<string, string>;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayKey = (typeof DAYS)[number];

type Interval = { start: string; end: string }; // "HH:mm" 24h
type WeeklySchedule = Record<DayKey, Interval[]>;

const TIMEZONE = "Australia/Sydney";

function emptyWeekly(): WeeklySchedule {
  return DAYS.reduce((acc, d) => {
    (acc as any)[d] = [];
    return acc;
  }, {} as WeeklySchedule);
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function overlaps(a: Interval, b: Interval) {
  const a1 = toMinutes(a.start);
  const a2 = toMinutes(a.end);
  const b1 = toMinutes(b.start);
  const b2 = toMinutes(b.end);
  if (![a1, a2, b1, b2].every(Number.isFinite)) return false;
  return Math.max(a1, b1) < Math.min(a2, b2);
}

// Time select
type TimeParts = { hour: string; minute: string; period: "AM" | "PM" | "" };

function toParts(value: string): TimeParts {
  if (!value) return { hour: "", minute: "", period: "" };
  const [hh, mm] = value.split(":").map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return { hour: "", minute: "", period: "" };
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return { hour: String(hour12).padStart(2, "0"), minute: String(mm).padStart(2, "0"), period };
}

function to24(parts: TimeParts): string {
  const { hour, minute, period } = parts;
  if (!hour || !minute || !period) return "";
  let h = Number(hour);
  if (period === "AM") h = h % 12; // 12 AM = 0
  else if (period === "PM") h = (h % 12) + 12; // 12 PM = 12
  return `${String(h).padStart(2, "0")}:${String(Number(minute)).padStart(2, "0")}`;
}

const HOUR_OPTS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTE_OPTS = ["00", "15", "30", "45"];

function TimeSelect({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  // Keep local parts so partial selections stick visually
  const [parts, setParts] = useState<TimeParts>(() => toParts(value));

  // If parent value changes (e.g., resetting form), sync down
  useEffect(() => {
    setParts(toParts(value));
  }, [value]);

  function update(next: Partial<TimeParts>) {
    const merged: TimeParts = { ...parts, ...next };
    setParts(merged);
    const full = to24(merged);
    if (full) onChange(full); // only notify when complete
  }

  return (
    <div className={styles.timeGroup}>
      <select
        className={`${styles.input} ${styles.select} ${invalid ? styles.inputError : ""}`}
        aria-label="Hour"
        value={parts.hour}
        onChange={(e) => update({ hour: e.target.value })}
      >
        <option value="">HH</option>
        {HOUR_OPTS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <span className={styles.colon}>:</span>

      <select
        className={`${styles.input} ${styles.select} ${invalid ? styles.inputError : ""}`}
        aria-label="Minute"
        value={parts.minute}
        onChange={(e) => update({ minute: e.target.value })}
      >
        <option value="">MM</option>
        {MINUTE_OPTS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select
        className={`${styles.input} ${styles.selectAmPm} ${invalid ? styles.inputError : ""}`}
        aria-label="AM/PM"
        value={parts.period}
        onChange={(e) => update({ period: e.target.value as "AM" | "PM" })}
      >
        <option value="">AM/PM</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// ===== Page =====
export default function MetaSetup() {
  const params = useSearchParams();
  const router = useRouter();

  const uid = params.get("uid");
  const role = params.get("role");

  if (!uid || !role) {
    return <p style={{ padding: "2rem" }}>Missing information. Please sign in again.</p>;
  }

  const [state, setState] = useState({
    industry: "",
    years: "",
    goal: "",
    challenges: "",
    help: "",
    weekly: emptyWeekly(), // Calendly-style schedule
  });

  // Advanced settings state
  const [advOpen, setAdvOpen] = useState(false);
  const [dateStart, setDateStart] = useState<string>("");       // YYYY-MM-DD (blank = today)
  const [dateEnd, setDateEnd] = useState<string>("");           // blank = no end date
  const [minNotice, setMinNotice] = useState<number>(0);

  const [overrides, setOverrides] = useState<Record<string, Interval[]>>({}); // "YYYY-MM-DD" -> intervals

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Update helpers
  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((s) => ({ ...s, [e.target.name]: e.target.value }));

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResumeFile(e.target.files?.[0] || null);
  };

  const addInterval = (day: DayKey) =>
    setState((s) => {
      const next = structuredClone(s.weekly);
      const list = next[day];
      const last = list[list.length - 1];
      const lastComplete = !!(last && last.start && last.end);
      if (!last || lastComplete) list.push({ start: "", end: "" }); // guard: no double blank
      return { ...s, weekly: next };
    });

  const removeInterval = (day: DayKey, idx: number) =>
    setState((s) => {
      const next = structuredClone(s.weekly);
      next[day].splice(idx, 1);
      return { ...s, weekly: next };
    });

  const updateInterval = (day: DayKey, idx: number, key: keyof Interval, value: string) =>
    setState((s) => {
      const next = structuredClone(s.weekly);
      next[day][idx] = { ...next[day][idx], [key]: value };
      return { ...s, weekly: next };
    });

  // Validation
  function validate(): FieldErrors {
    const errs: FieldErrors = {};

    if (role === "mentor") {
      if (!state.industry.trim()) errs.industry = "Industry can’t be empty";
      const yrs = Number(state.years);
      if (!state.years.trim()) errs.years = "Years is required";
      else if (!Number.isFinite(yrs) || yrs < 0) errs.years = "Years must be ≥ 0";

      // At least one interval somewhere
      const totalIntervals = DAYS.reduce((n, d) => n + state.weekly[d].length, 0);
      if (totalIntervals === 0) errs.weekly = "Add at least one time range";

      // Per-day checks
      for (const d of DAYS) {
        const list = state.weekly[d];
        for (let i = 0; i < list.length; i++) {
          const iv = list[i];
          if (!iv.start) errs[`${d}-start-${i}`] = "Start required";
          if (!iv.end) errs[`${d}-end-${i}`] = "End required";
          const sM = toMinutes(iv.start);
          const eM = toMinutes(iv.end);
          if (Number.isFinite(sM) && Number.isFinite(eM) && eM <= sM) {
            errs[`${d}-end-${i}`] = "End must be after start";
          }
          for (let j = 0; j < i; j++) {
            if (overlaps(iv, list[j])) errs[`${d}-overlap-${i}`] = "Overlaps another range";
          }
        }
      }

      // Advanced: date range validity
      if (dateStart && dateEnd && new Date(dateStart) > new Date(dateEnd)) {
        errs.dateEnd = "End date must be after start date";
      }

      // Advanced: overrides validity
      for (const [odate, list] of Object.entries(overrides)) {
        for (let i = 0; i < list.length; i++) {
          const iv = list[i];
          if (!iv.start) errs[`ov-${odate}-start-${i}`] = "Start required";
          if (!iv.end) errs[`ov-${odate}-end-${i}`] = "End required";
          const sM = toMinutes(iv.start);
          const eM = toMinutes(iv.end);
          if (Number.isFinite(sM) && Number.isFinite(eM) && eM <= sM) {
            errs[`ov-${odate}-end-${i}`] = "End must be after start";
          }
          for (let j = 0; j < i; j++) {
            if (overlaps(iv, list[j])) errs[`ov-${odate}-overlap-${i}`] = "Overlaps another range";
          }
        }
      }
    } else {
      if (!state.goal.trim()) errs.goal = "Please describe your main goal";
      if (!state.challenges.trim()) errs.challenges = "Tell us your challenges";
      if (!state.help.trim()) errs.help = "Explain the help you need";
      if (!resumeFile) errs.resume = "Please upload your CV/Resume";
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting) return;

    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrs(errs);
      return;
    }

    setSubmitting(true);
    setFieldErrs({});
    setFormErr(null);

    if (!uid || !role) {
      setFormErr("Missing information. Please sign in again.");
      return;
    }

    const fd = new FormData();
    fd.append("uid", uid!);
    fd.append("role", role!);

    if (role === "mentor") {
      fd.append("industry", state.industry.trim());
      fd.append("years", state.years.trim());
      fd.append(
        "availabilityJson",
        JSON.stringify({
          timezone: TIMEZONE,
          weekly: state.weekly,
          dateRange: {
            start: dateStart || null,
            end: dateEnd || null,
          },
          minNoticeHours: Number.isFinite(minNotice) ? minNotice : 0,
          overrides,
        })
      );
    } else {
      fd.append("goal", state.goal.trim());
      fd.append("challenges", state.challenges.trim());
      fd.append("help", state.help.trim());
      if (resumeFile) fd.append("cv", resumeFile, resumeFile.name);
    }

    const res = await fetch("/api/meta", { method: "POST", body: fd });

    setSubmitting(false);

    if (res.ok) router.replace("/dashboard");
    else {
      const { error } = await res.json().catch(() => ({}));
      setFormErr(error ?? "Could not save");
    }
  }

  // Role-specific inputs
  const menteeInputs = (
    <>
      <label className={styles.label}>
        <span className={styles.labelText}>Your main goal</span>
        <textarea
          name="goal"
          value={state.goal}
          onChange={onChange}
          className={`${styles.textarea} ${fieldErrs.goal ? styles.inputError : ""}`}
          placeholder="e.g. Land a frontend role in 6 months"
        />
        {fieldErrs.goal && <span className={styles.fieldError}>{fieldErrs.goal}</span>}
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>Current challenges</span>
        <textarea
          name="challenges"
          value={state.challenges}
          onChange={onChange}
          className={`${styles.textarea} ${fieldErrs.challenges ? styles.inputError : ""}`}
          placeholder="e.g. Struggling with system‐design interviews"
        />
        {fieldErrs.challenges && (
          <span className={styles.fieldError}>{fieldErrs.challenges}</span>
        )}
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>Help you're looking for</span>
        <textarea
          name="help"
          value={state.help}
          onChange={onChange}
          className={`${styles.textarea} ${fieldErrs.help ? styles.inputError : ""}`}
          placeholder="Mock interviews, portfolio review, study plan"
        />
        {fieldErrs.help && <span className={styles.fieldError}>{fieldErrs.help}</span>}
      </label>

      <label className={styles.label}>
        Upload your CV / Resume
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={onFileChange}
          className={`${styles.fileInput} ${fieldErrs.resume ? styles.inputError : ""}`}
        />
        {resumeFile && <p className={styles.fileName}>{resumeFile.name}</p>}
        {fieldErrs.resume && <span className={styles.fieldError}>{fieldErrs.resume}</span>}
      </label>
    </>
  );

  const mentorInputs = (
    <>
      <label className={styles.label}>
        <span className={styles.labelText}>Industry</span>
        <span className={styles.hint}>(e.g. FinTech, UX, Cloud)</span>
        <input
          name="industry"
          value={state.industry}
          onChange={onChange}
          className={`${styles.input} ${fieldErrs.industry ? styles.inputError : ""}`}
          placeholder="e.g. SaaS – Product Design"
        />
        {fieldErrs.industry && <span className={styles.fieldError}>{fieldErrs.industry}</span>}
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>Years of experience</span>
        <input
          name="years"
          type="number"
          min={0}
          value={state.years}
          onChange={onChange}
          className={`${styles.input} ${fieldErrs.years ? styles.inputError : ""}`}
          placeholder="e.g. 7"
        />
        {fieldErrs.years && <span className={styles.fieldError}>{fieldErrs.years}</span>}
      </label>

      {/* Calendly-like Weekly Hours */}
      <fieldset className={styles.label} style={{ border: 0, padding: 0 }}>
        <legend className={styles.labelText}>Weekly availability</legend>
        <span className={styles.hint}>Set when you’re typically available for meetings.</span>

        <div className={styles.availabilityTable}>
          {DAYS.map((d) => {
            const list = state.weekly[d];
            const dayHasHours = list.length > 0;
            return (
              <div key={d} className={styles.dayRow}>
                <div className={styles.dayBadge}>{d.charAt(0)}</div>

                <div className={styles.dayContent}>
                  {dayHasHours ? (
                    list.map((iv, idx) => (
                      <div key={idx} className={styles.interval}>
                        <TimeSelect
                          value={iv.start}
                          onChange={(v) => updateInterval(d, idx, "start", v)}
                          invalid={!!fieldErrs[`${d}-start-${idx}`]}
                        />
                        <span className={styles.toSep}>to</span>
                        <TimeSelect
                          value={iv.end}
                          onChange={(v) => updateInterval(d, idx, "end", v)}
                          invalid={!!fieldErrs[`${d}-end-${idx}`]}
                        />
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label="Remove range"
                          onClick={() => removeInterval(d, idx)}
                          title="Remove"
                        >
                          ×
                        </button>
                        {fieldErrs[`${d}-overlap-${idx}`] && (
                          <span className={styles.fieldError} style={{ marginLeft: 8 }}>
                            {fieldErrs[`${d}-overlap-${idx}`]}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className={styles.unavailable}>Unavailable</span>
                  )}
                </div>

                <div className={styles.dayActions}>
                  <button
                    type="button"
                    className={styles.smallButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addInterval(d);
                    }}
                  >
                    + Hours
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timezone is fixed: Australia/Sydney (no input shown) */}
        <div className={styles.hint} style={{ marginTop: "0.75rem" }}>
          Timezone: <strong>{TIMEZONE}</strong>
        </div>

        {fieldErrs.weekly && <span className={styles.fieldError}>{fieldErrs.weekly}</span>}
      </fieldset>

      {/* Advanced settings */}
      <div className={styles.advCard}>
        <button
          type="button"
          className={styles.advToggle}
          onClick={() => setAdvOpen((v) => !v)}
          aria-expanded={advOpen}
        >
          {advOpen ? "▲" : "▼"} Advanced settings
        </button>

        {advOpen && (
          <div className={styles.advBody}>
            {/* Date range */}
            <div className={styles.row2}>
              <label className={styles.label}>
                <span className={styles.labelText}>Start date</span>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className={`${styles.input} ${fieldErrs.dateStart ? styles.inputError : ""}`}
                />
              </label>

              <label className={styles.label}>
                <span className={styles.labelText}>End date (optional)</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className={`${styles.input} ${fieldErrs.dateEnd ? styles.inputError : ""}`}
                />
                <span className={styles.hint}>Leave empty for “No end date”.</span>
                {fieldErrs.dateEnd && <span className={styles.fieldError}>{fieldErrs.dateEnd}</span>}
              </label>
            </div>

            {/* Minimum notice */}
            <label className={styles.label}>
              <span className={styles.labelText}>Minimum notice</span>
              <select
                  className={`${styles.input} ${styles.select}`}
                  value={minNotice}
                  onChange={(e) => setMinNotice(Number(e.target.value) || 0)}
              >
                <option value={0}>0 hours (no minimum)</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </label>

            {/* Date-specific overrides */}
            <div className={styles.label}>
              <span className={styles.labelText}>Date-specific overrides</span>
              <span className={styles.hint}>
                Add/close slots for particular dates. An empty list means “closed”.
              </span>

              {/* Add a date row */}
              <div className={styles.row2}>
                <input
                    type="date"
                    className={styles.input}
                  onChange={(e) => {
                    const d = e.target.value;
                    if (!d) return;
                    setOverrides((o) => (o[d] ? o : { ...o, [d]: [] }));
                    // clear the inline date picker value so you can add another date quickly
                    (e.target as HTMLInputElement).value = "";
                  }}
                  placeholder="YYYY-MM-DD"
                />
              </div>

              {/* Render each override date with interval rows */}
              <div className={styles.overridesWrap}>
                {Object.entries(overrides).map(([d, list]) => (
                  <div key={d} className={styles.overrideDay}>
                    <div className={styles.overrideHead}>
                      <strong>{d}</strong>
                      <div className={styles.overrideButtons}>
                        <button
                          type="button"
                          className={styles.smallButton}
                          onClick={() =>
                            setOverrides((o) => ({
                              ...o,
                              [d]: [...(o[d] || []), { start: "", end: "" }],
                            }))
                          }
                        >
                          + Hours
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title="Remove date"
                          onClick={() =>
                            setOverrides((o) => {
                              const copy = { ...o };
                              delete copy[d];
                              return copy;
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {list.length === 0 && <span className={styles.unavailable}>Closed</span>}

                    {list.map((iv, idx) => (
                      <div key={idx} className={styles.interval}>
                        <TimeSelect
                          value={iv.start}
                          onChange={(v) =>
                            setOverrides((o) => {
                              const copy = { ...o };
                              copy[d] = copy[d].slice();
                              copy[d][idx] = { ...copy[d][idx], start: v };
                              return copy;
                            })
                          }
                          invalid={!!fieldErrs[`ov-${d}-start-${idx}`]}
                        />
                        <span className={styles.toSep}>to</span>
                        <TimeSelect
                          value={iv.end}
                          onChange={(v) =>
                            setOverrides((o) => {
                              const copy = { ...o };
                              copy[d] = copy[d].slice();
                              copy[d][idx] = { ...copy[d][idx], end: v };
                              return copy;
                            })
                          }
                          invalid={!!fieldErrs[`ov-${d}-end-${idx}`]}
                        />
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() =>
                            setOverrides((o) => {
                              const copy = { ...o };
                              copy[d] = copy[d].slice();
                              copy[d].splice(idx, 1);
                              return copy;
                            })
                          }
                          title="Remove range"
                        >
                          ×
                        </button>
                        {fieldErrs[`ov-${d}-overlap-${idx}`] && (
                          <span className={styles.fieldError} style={{ marginLeft: 8 }}>
                            {fieldErrs[`ov-${d}-overlap-${idx}`]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {role === "mentee" ? "A bit more about your journey" : "Share your mentoring background"}
          </h1>
          <p className={styles.subtitle}>
            {role === "mentee" ? "We’ll use this to match you with mentors" : "We’ll use this to match you with mentees"}
          </p>
        </div>

        <div className={styles.card}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {role === "mentee" ? menteeInputs : mentorInputs}

            <button type="submit" disabled={submitting} className={styles.button}>
              {submitting ? "Saving…" : "Finish"}
            </button>

            {formErr && <p className={styles.error}>{formErr}</p>}
          </form>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: "100%" }} />
          </div>
          <span className={styles.progressText}>Step&nbsp;2&nbsp;of&nbsp;2</span>
        </div>
      </div>
    </div>
  );
}
