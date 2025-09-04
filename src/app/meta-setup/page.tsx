"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./metaSetup.module.css";

// Helpers
type FieldErrors = Record<string, string>;

// Mentoring style definitions with explanations
const mentoringStyles = [
  {
    id: "coaching",
    label: "Coaching",
    description: "Helps with specific skills with clear structure (e.g. resumes, interviews, technical skills, communication).",
    value: "Tangible progress and clear steps."
  },
  {
    id: "roleModelling",
    label: "Role Modelling",
    description: "Mentees learn by seeing how a professional operates (e.g. how to behave in meetings, how to lead a project).",
    value: "Exposure to 'what good looks like' in real workplaces."
  },
  {
    id: "facilitative",
    label: "Facilitative",
    description: "Mentor guides through questions and reflection, helping them figure out their path (e.g. 'Should I go into data vs consulting?').",
    value: "Builds critical thinking & decision-making confidence."
  },
  {
    id: "technical",
    label: "Technical",
    description: "Hands-on guidance in a specific industry skill (coding, data analysis, design, finance modeling).",
    value: "Gives them a competitive edge for job readiness."
  },
  {
    id: "holistic",
    label: "Holistic",
    description: "Addresses both career + personal challenges (imposter syndrome, stress, work-life balance).",
    value: "Supports well-being while transitioning into adult/professional life."
  }
];

// Nice-to-have options (including "None")
const niceToHaveOptions = [
  {
    id: "none",
    label: "None",
    description: "No additional mentoring styles needed",
    value: "No additional preferences"
  }
];

interface MentoringStylePreferences {
  required: string[];
  niceToHave: string[];
  dontMind: boolean;
}

type MentoringStyleState = MentoringStylePreferences | string;

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

// Mentoring Style Tooltip Component
function MentoringStyleTooltip({ style }: { style: { id: string; label: string; description: string; value: string } }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={styles.tooltipContainer}>
      <button
        type="button"
        className={styles.tooltipTrigger}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label={`Learn more about ${style.label}`}
      >
        i
      </button>
      {isVisible && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipTitle}>{style.label}</div>
          <div className={styles.tooltipDescription}>{style.description}</div>
          <div className={styles.tooltipValue}>Value: {style.value}</div>
        </div>
      )}
    </div>
  );
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

export default function MetaSetup() {
  const params = useSearchParams();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const uid  = params.get("uid");
  const role = params.get("role");

  if (!uid || !role) {
    return <p style={{ padding: "2rem" }}>Missing information. Please sign in again.</p>;
  }

  const [state, setState] = useState<{
    industry: string;
    years: string;
    currentRole: string;
    seniorityLevel: string;
    previousRoles: string;
    mentoringStyle: MentoringStyleState;
    culturalBackground: string;
    availability: string;
    goal: string;
    challenges: string;
    help: string;
    weekly: WeeklySchedule;
  }>({
    industry:   "",
    years:      "",
    currentRole: "",
    seniorityLevel: "",
    previousRoles: "",
    mentoringStyle: role === "mentor" ? {
      required: [],
      niceToHave: [],
      dontMind: false
    } : "",
    culturalBackground: "",
    availability: "",
    goal:       "",
    challenges: "",
    help:       "",
    weekly: emptyWeekly(),
  });

  // Advanced settings state
  const [advOpen, setAdvOpen] = useState(false);
  const [dateStart, setDateStart] = useState<string>("");       // YYYY-MM-DD (blank = today)
  const [dateEnd, setDateEnd] = useState<string>("");           // blank = no end date
  const [minNotice, setMinNotice] = useState<number>(0);
  const [overrides, setOverrides] = useState<Record<string, Interval[]>>({}); // "YYYY-MM-DD" -> intervals

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [existingResume, setExistingResume] = useState<{
    filename: string;
    uploadDate: string;
    fileSize: number;
    contentType: string;
  } | null>(null);

  const [fieldErrs, setFieldErrs]   = useState<FieldErrors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Load existing meta data when component mounts
  useEffect(() => {
    const loadExistingMeta = async () => {
      if (!uid || !role) return;
      
      try {
        // Try to fetch existing meta data
        const res = await fetch(`/api/meta?uid=${uid}&role=${role}`);
        if (res.ok) {
          const metaData = await res.json();
          if (role === "mentee") {
            setState(prev => ({
              ...prev,
              goal: metaData.goal || "",
              challenges: metaData.challenges || "",
              help: metaData.help || ""
            }));
            // Set existing resume info if available
            if (metaData.resumeInfo) {
              setExistingResume(metaData.resumeInfo);
            }
          } else {
            setState(prev => ({
              ...prev,
              industry: metaData.industry || "",
              years: metaData.years?.toString() || "",
              currentRole: metaData.currentRole || "",
              seniorityLevel: metaData.seniorityLevel || "",
              previousRoles: metaData.previousRoles || "",
              mentoringStyle: role === "mentor" ? {
                required: metaData.requiredMentoringStyles ? metaData.requiredMentoringStyles.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [],
                niceToHave: [], // Not used for mentors
                dontMind: metaData.mentoringStyle === 'dont_mind'
              } : metaData.mentoringStyle || "",
              culturalBackground: metaData.culturalBackground || "",
              availability: metaData.availability || ""
            }));
            
            // Load existing availability data for mentors
            if (metaData.availabilityJson) {
              try {
                const availabilityData = JSON.parse(metaData.availabilityJson);
                console.log("Loading existing availability data:", availabilityData);
                
                // Load weekly schedule
                if (availabilityData.weekly) {
                  const convertedWeekly: WeeklySchedule = emptyWeekly();
                  
                  // The database stores using short day names (Mon, Tue, etc.)
                  // which matches our component format, so we can use them directly
                  for (const [dayKey, intervals] of Object.entries(availabilityData.weekly)) {
                    if (DAYS.includes(dayKey as DayKey) && Array.isArray(intervals)) {
                      convertedWeekly[dayKey as DayKey] = intervals.map((interval: any) => ({
                        start: interval.start || "",
                        end: interval.end || ""
                      }));
                      console.log(`Loaded ${intervals.length} intervals for ${dayKey}:`, intervals);
                    }
                  }
                  
                  console.log("Final converted weekly schedule:", convertedWeekly);
                  
                  setState(prev => ({
                    ...prev,
                    weekly: convertedWeekly
                  }));
                }
                
                // Load minimum notice
                if (availabilityData.minNoticeHours !== undefined) {
                  setMinNotice(availabilityData.minNoticeHours);
                }
                
                // Load overrides
                if (availabilityData.overrides) {
                  setOverrides(availabilityData.overrides);
                }
                
              } catch (parseError) {
                console.log("Error parsing existing availability data:", parseError);
              }
            }
          }
        }
      } catch (error) {
        console.log("No existing meta data found or error loading meta");
      } finally {
        setLoading(false);
      }
    };

    loadExistingMeta();
  }, [uid, role]);

  // Loading state check
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>Loading your goals and challenges...</div>
        </div>
      </div>
    );
  }
  
  // Update helpers
  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setState({ ...state, [e.target.name]: e.target.value });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResumeFile(e.target.files?.[0] || null);
  };

  // Mentoring style change handler - simplified for mentors (no nice-to-have)
  const handleMentoringStyleChange = (category: 'required', styleId: string, checked: boolean) => {
    setState(prev => {
      const currentMentoringStyle = prev.mentoringStyle as MentoringStylePreferences;
      const newMentoringStyle = { ...currentMentoringStyle };
      
      if (checked) {
        // Add to required if under max limit (2 for mentors)
        if (newMentoringStyle.required.length < 2) {
          newMentoringStyle.required = [...(newMentoringStyle.required || []), styleId];
        }
      } else {
        // Remove from required if above min limit (1 for mentors)
        if (newMentoringStyle.required.length > 1) {
          newMentoringStyle.required = newMentoringStyle.required.filter((id: string) => id !== styleId);
        }
      }
      
      return { ...prev, mentoringStyle: newMentoringStyle };
    });
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
      if (!state.industry.trim())          errs.industry  = "Industry can’t be empty";
      const yrs = Number(state.years);
      if (!state.years.trim())             errs.years     = "Years is required";
      else if (!Number.isFinite(yrs) || yrs < 0)
                                           errs.years     = "Years must be ≥ 0";
      if (!state.currentRole.trim())       errs.currentRole = "Current role is required";
      if (!state.seniorityLevel.trim())    errs.seniorityLevel = "Seniority level is required";
      
      // Validate mentoring styles for mentors
      if (role === "mentor") {
        const mentoringStyle = state.mentoringStyle as MentoringStylePreferences;
        if (mentoringStyle.dontMind) {
          // "I don't mind" is valid
        } else if (mentoringStyle.required.length === 0) {
          errs.mentoringStyle = "Please select at least 1 required mentoring style or choose 'I don't mind'";
        } else if (mentoringStyle.required.length > 2) {
          errs.mentoringStyle = "Please select no more than 2 required mentoring styles";
        }
      } else {
        if (typeof state.mentoringStyle === 'string' && !state.mentoringStyle.trim()) {
          errs.mentoringStyle = "Mentoring style is required";
        }
      }
      
      if (!state.availability.trim())      errs.availability = "Availability is required";

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
      if (!state.goal.trim())              errs.goal        = "Please describe your main goal";
      if (!state.challenges.trim())        errs.challenges  = "Tell us your challenges";
      if (!state.help.trim())              errs.help        = "Explain the help you need";
      if (!resumeFile && !existingResume) errs.resume      = "Please upload your CV/Resume";
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
    fd.append("uid", uid);
    fd.append("role", role);

    if (role === "mentor") {
      fd.append("industry",  state.industry.trim());
      fd.append("years",     state.years.trim());
      fd.append("currentRole", state.currentRole.trim());
      fd.append("seniorityLevel", state.seniorityLevel.trim());
      fd.append("previousRoles", state.previousRoles.trim());
      // Handle mentoring style for mentors vs mentees
      if (role === "mentor") {
        const mentoringStyle = state.mentoringStyle as MentoringStylePreferences;
        if (mentoringStyle.dontMind) {
          fd.append("mentoringStyle", "dont_mind");
        } else {
          // Send the first required style as the main mentoring style
          fd.append("mentoringStyle", mentoringStyle.required[0] || "");
        }
        // Send the structured data (only required styles for mentors)
        fd.append("requiredMentoringStyles", mentoringStyle.required.join(', '));
      } else {
        fd.append("mentoringStyle", (state.mentoringStyle as string).trim());
      }
      fd.append("culturalBackground", state.culturalBackground.trim());
      fd.append("availability", state.availability.trim());
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
      fd.append("goal",       state.goal.trim());
      fd.append("challenges", state.challenges.trim());
      fd.append("help",       state.help.trim());
      
      if (resumeFile) {
        fd.append("cv", resumeFile, resumeFile.name); // attach the file blob
      } else if (existingResume) {
        // Keep existing resume - send a flag to indicate no new file
        fd.append("keepExistingResume", "true");
      }
    }

    const res = await fetch("/api/meta", { method: "POST", body: fd });

    setSubmitting(false);

    if (res.ok) {
      if (role === "mentee") {
        router.replace(`/mentee-preferences?uid=${uid}&role=${role}`);
      } else {
        router.replace("/dashboard");
      }
    } else {
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
        {existingResume ? "Update your CV / Resume" : "Upload your CV / Resume"}
        {existingResume && (
          <div className={styles.existingResume}>
            <p className={styles.existingResumeText}>
              📄 <strong>{existingResume.filename}</strong>
              <br />
              <small>Uploaded: {new Date(existingResume.uploadDate).toLocaleDateString()}</small>
              <br />
              <small>Size: {(existingResume.fileSize / 1024).toFixed(1)} KB</small>
            </p>
            <button
              type="button"
              onClick={() => setExistingResume(null)}
              className={styles.removeResumeButton}
            >
              Remove & Upload New
            </button>
          </div>
        )}
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={onFileChange}
          className={`${styles.fileInput} ${fieldErrs.resume ? styles.inputError : ""}`}
        />
        {resumeFile && <p className={styles.fileName}>New file: {resumeFile.name}</p>}
        {fieldErrs.resume && <span className={styles.fieldError}>{fieldErrs.resume}</span>}
        {existingResume && !resumeFile && (
          <p className={styles.keepExistingText}>
            Existing resume: <strong>{existingResume.filename}</strong>
          </p>
        )}
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
          {fieldErrs.industry && (
              <span className={styles.fieldError}>{fieldErrs.industry}</span>
          )}
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

        <label className={styles.label}>
          <span className={styles.labelText}>Current Role</span>
          <input
              name="currentRole"
              value={state.currentRole}
              onChange={onChange}
              className={`${styles.input} ${fieldErrs.currentRole ? styles.inputError : ""}`}
              placeholder="e.g. Software Engineer, Product Manager"
          />
          {fieldErrs.currentRole && (
              <span className={styles.fieldError}>{fieldErrs.currentRole}</span>
          )}
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Seniority Level</span>
          <select
              name="seniorityLevel"
              value={state.seniorityLevel}
              onChange={onChange}
              className={`${styles.input} ${fieldErrs.seniorityLevel ? styles.inputError : ""}`}
          >
            <option value="">Select your level</option>
            <option value="Junior">Junior</option>
            <option value="Mid-level">Mid-level</option>
            <option value="Senior">Senior</option>
            <option value="Manager">Manager</option>
            <option value="Director">Director</option>
            <option value="Executive">Executive</option>
          </select>
          {fieldErrs.seniorityLevel && (
              <span className={styles.fieldError}>{fieldErrs.seniorityLevel}</span>
          )}
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Previous Role Experiences</span>
          <span className={styles.hint}>(Optional - List roles you've held)</span>
          <textarea
              name="previousRoles"
              value={state.previousRoles}
              onChange={onChange}
              className={`${styles.textarea} ${fieldErrs.previousRoles ? styles.inputError : ""}`}
              placeholder="e.g. Junior Developer, Team Lead, Product Manager"
          />
          {fieldErrs.previousRoles && (
              <span className={styles.fieldError}>{fieldErrs.previousRoles}</span>
          )}
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Mentoring Styles You're Comfortable With</span>
          <span className={styles.hint}>(Select your top 2 most comfortable mentoring styles)</span>
          
          {role === "mentor" ? (
            // Simplified multi-select for mentors - just top 2 styles
            <div className={styles.mentoringStyleContainer}>
              {/* "I don't mind" option */}
              <div className={styles.mentoringStyleSection}>
                <label className={styles.styleCheckbox}>
                  <input
                    type="checkbox"
                    checked={(state.mentoringStyle as MentoringStylePreferences).dontMind}
                    onChange={(e) => {
                      setState(prev => ({
                        ...prev,
                        mentoringStyle: {
                          required: [],
                          niceToHave: [],
                          dontMind: e.target.checked
                        }
                      }));
                    }}
                  />
                  <div className={styles.styleInfo}>
                    <span className={styles.styleLabel}>I don't mind any mentoring style</span>
                    <span className={styles.styleDescription}>I'm comfortable with any mentoring approach</span>
                  </div>
                </label>
              </div>
              
              <div className={styles.orDivider} role="separator" aria-label="or">
                <span>or</span>
              </div>

              {/* Top 2 styles section */}
              <div className={styles.mentoringStyleSection}>
                <h4 className={styles.sectionTitle}>
                  Your Top 2 Most Comfortable Styles
                  {(state.mentoringStyle as MentoringStylePreferences).required.length < 2 && (
                    <span className={styles.selectionCount}>
                      - {2 - (state.mentoringStyle as MentoringStylePreferences).required.length} more can be selected
                    </span>
                  )}
                  {(state.mentoringStyle as MentoringStylePreferences).required.length >= 2 && (
                    <span className={styles.selectionCount}>
                      - Maximum reached
                    </span>
                  )}
                </h4>
                <p className={styles.sectionDescription}>
                  Select up to 2 mentoring styles that you're most comfortable providing. At least one must be selected.
                </p>
                <div className={styles.styleGrid}>
                  {mentoringStyles.map((style) => (
                    <label key={style.id} className={styles.styleLabel}>
                      <input
                        type="checkbox"
                        checked={(state.mentoringStyle as MentoringStylePreferences).required.includes(style.id)}
                        onChange={(e) => handleMentoringStyleChange('required', style.id, e.target.checked)}
                        disabled={!(state.mentoringStyle as MentoringStylePreferences).required.includes(style.id) && 
                                 (state.mentoringStyle as MentoringStylePreferences).required.length >= 2}
                        title={(state.mentoringStyle as MentoringStylePreferences).required.includes(style.id) && 
                               (state.mentoringStyle as MentoringStylePreferences).required.length === 1 ? 
                               "Cannot remove - at least one style must remain" : ""}
                      />
                      <span className={styles.styleText}>{style.label}</span>
                      <MentoringStyleTooltip style={style} />
                      {(state.mentoringStyle as MentoringStylePreferences).required.includes(style.id) && 
                       (state.mentoringStyle as MentoringStylePreferences).required.length === 1 && (
                        <span className={styles.requiredIndicator}>*</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Single select for mentees (existing behavior)
            <select
                name="mentoringStyle"
                value={state.mentoringStyle as string}
                onChange={onChange}
                className={`${styles.input} ${fieldErrs.mentoringStyle ? styles.inputError : ""}`}
            >
              <option value="">Select your style</option>
              <option value="Direct">Direct - Give specific advice and solutions</option>
              <option value="High-level">High-level - Provide strategic guidance</option>
              <option value="Task-assigned">Task-assigned - Assign homework and review</option>
              <option value="Coaching">Coaching - Ask questions to help mentee discover answers</option>
            </select>
          )}
          
          {fieldErrs.mentoringStyle && (
              <span className={styles.fieldError}>{fieldErrs.mentoringStyle}</span>
          )}
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Cultural / Language Background</span>
          <span className={styles.hint}>(Optional - For diversity matching)</span>
          <input
              name="culturalBackground"
              value={state.culturalBackground}
              onChange={onChange}
              className={`${styles.input} ${fieldErrs.culturalBackground ? styles.inputError : ""}`}
              placeholder="e.g. International from India, Bilingual (Spanish/English)"
          />
          {fieldErrs.culturalBackground && (
              <span className={styles.fieldError}>{fieldErrs.culturalBackground}</span>
          )}
        </label>

        <label className={styles.label}>
          <span className={styles.labelText}>Availability to Meet</span>
          <input
              name="availability"
              value={state.availability}
              onChange={onChange}
              className={`${styles.input} ${fieldErrs.availability ? styles.inputError : ""}`}
              placeholder="e.g. Weekly on weekends, Bi-weekly on weekdays"
          />
          {fieldErrs.availability && (
              <span className={styles.fieldError}>{fieldErrs.availability}</span>
          )}
        </label>

        {/* Calendly-like Weekly Hours */}
        <fieldset className={styles.label} style={{border: 0, padding: 0}}>
          <legend className={styles.labelText}>Weekly availability</legend>
          <span className={styles.hint}>Set when you’re typically available for meetings.</span>
          {/* Info tab about meeting requests */}
          <div className={styles.infoTab}>
            <span className={styles.icon}>ℹ️</span>
            <span>
              <strong>Note:</strong> Setting your availability doesn't mean you have to accept every meeting request. 
              You still have the choice to accept or decline meeting requests based on your schedule and preferences.
            </span>
          </div>
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
                                    <span className={styles.fieldError} style={{marginLeft: 8}}>
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
          <div className={styles.hint} style={{marginTop: "0.75rem"}}>
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
                  <span className={styles.labelText}>
                    Minimum notice
                    <span className={styles.tooltipContainer}>
                      <span className={styles.tooltipTrigger}>?</span>
                      <span className={styles.tooltip}>
                        The minimum amount of time required before a meeting can be booked. 
                        This helps ensure you have enough time to prepare and prevents last-minute bookings.
                      </span>
                    </span>
                  </span>
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
                Add/close slots for particular dates. An empty list means unavailable.
              </span>

                  {/* Add a date row */}
                  <div className={styles.row2}>
                    <input
                        type="date"
                        className={styles.input}
                        onChange={(e) => {
                          const d = e.target.value;
                          if (!d) return;
                          setOverrides((o) => (o[d] ? o : {...o, [d]: []}));
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
                                        [d]: [...(o[d] || []), {start: "", end: ""}],
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
                                        const copy = {...o};
                                        delete copy[d];
                                        return copy;
                                      })
                                  }
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          {list.length === 0 && <span className={styles.unavailable}>Unavailable</span>}

                          {list.map((iv, idx) => (
                              <div key={idx} className={styles.interval}>
                                <TimeSelect
                                    value={iv.start}
                                    onChange={(v) =>
                                        setOverrides((o) => {
                                          const copy = {...o};
                                          copy[d] = copy[d].slice();
                                          copy[d][idx] = {...copy[d][idx], start: v};
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
                                          const copy = {...o};
                                          copy[d] = copy[d].slice();
                                          copy[d][idx] = {...copy[d][idx], end: v};
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
                                          const copy = {...o};
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
                                    <span className={styles.fieldError} style={{marginLeft: 8}}>
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
          {/* Navigation Buttons - Only Back to Dashboard */}
          <div className={styles.topBackSection}>
            <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className={styles.topBackButton}
            >
              Back to Dashboard
            </button>
          </div>

          <div className={styles.header}>
            <h1 className={styles.title}>
              {role === "mentee"
                  ? "A bit more about your journey"
                  : "Share your mentoring background"}
            </h1>
            <p className={styles.subtitle}>
              {role === "mentee"
                  ? "We'll use this to match you with mentors"
                  : "We'll use this to match you with mentee"}
            </p>
          </div>

          <div className={`${styles.card} ${styles.hasTooltips}`}>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {role === "mentee" ? menteeInputs : mentorInputs}

            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={() => router.push(`/profile-setup?uid=${uid}&role=${role}`)}
                className={styles.secondaryButton}
              >
                Previous Page
              </button>
              <button type="submit" disabled={submitting} className={styles.button}>
                {submitting ? "Saving…" : role === "mentee" ? "Save & Continue" : "Finish"}
              </button>
            </div>

            {formErr && <p className={styles.error}>{formErr}</p>}
            </form>
          </div>
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack}>
              <div
                  className={styles.progressFill}
                  style={{width: role === "mentee" ? "66%" : "100%"}}
              />
            </div>
            <span className={styles.progressText}>
              {role === "mentee" ? "Step 2 of 3" : "Step 2 of 2"}
            </span>
          </div>

          {/* Bottom Back to Dashboard Button
          <div className={styles.backSection}>
            <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className={styles.backButton}
            >
              Back to Dashboard
            </button>
          </div> */}
        </div>
      </div>
  );
}