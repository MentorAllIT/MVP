"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./metaSetup.module.css";

// Helpers
type FieldErrors = Record<string, string>;

const isCalendly = (s: string) =>
  /^https:\/\/calendly\.com\/[a-z0-9_-]+\/[a-z0-9_-]+/i.test(s);

export default function MetaSetup() {
  const params = useSearchParams();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const uid  = params.get("uid");
  const role = params.get("role");

  if (!uid || !role) {
    return <p style={{ padding: "2rem" }}>Missing information. Please sign in again.</p>;
  }

  const [state, setState] = useState({
    industry:   "",
    years:      "",
    calendly:   "",
    goal:       "",
    challenges: "",
    help:       "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [fieldErrs, setFieldErrs]   = useState<FieldErrors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  
  // Update helpers
  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState({ ...state, [e.target.name]: e.target.value });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResumeFile(e.target.files?.[0] || null);
  };

  // Validation
  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (role === "mentor") {
      if (!state.industry.trim())          errs.industry  = "Industry can’t be empty";
      const yrs = Number(state.years);
      if (!state.years.trim())             errs.years     = "Years is required";
      else if (!Number.isFinite(yrs) || yrs < 0)
                                           errs.years     = "Years must be ≥ 0";
      if (!isCalendly(state.calendly))     errs.calendly  = "URL must start with calendly.com";
    } else {
      if (!state.goal.trim())              errs.goal        = "Please describe your main goal";
      if (!state.challenges.trim())        errs.challenges  = "Tell us your challenges";
      if (!state.help.trim())              errs.help        = "Explain the help you need";
      if (!resumeFile)                     errs.resume      = "Please upload your CV/Resume";
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

    const fd = new FormData();
    fd.append("uid",  uid);
    fd.append("role", role);

    if (role === "mentor") {
      fd.append("industry",  state.industry.trim());
      fd.append("years",     state.years.trim());
      fd.append("calendly",  state.calendly.trim());
    } else {
      fd.append("goal",       state.goal.trim());
      fd.append("challenges", state.challenges.trim());
      fd.append("help",       state.help.trim());
      
      if (resumeFile) fd.append("cv", resumeFile, resumeFile.name); // attach the file blob
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
        Industry <span className={styles.hint}>(e.g. FinTech, UX, Cloud)</span>
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
        Calendly URL <span className={styles.hint}>(https://calendly.com/…)</span>
        <input
          name="calendly"
          type="url"
          value={state.calendly}
          onChange={onChange}
          className={`${styles.input} ${fieldErrs.calendly ? styles.inputError : ""}`}
          placeholder="https://calendly.com/your-handle/30min"
        />
        {fieldErrs.calendly && (
          <span className={styles.fieldError}>{fieldErrs.calendly}</span>
        )}
      </label>
    </>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>
                    {role === "mentee"
            ? "A bit more about your journey"
            : "Share your mentoring background"}
        </h1>
        <p className={styles.subtitle}>
          {role === "mentee"
            ? "We’ll use this to match you with mentors"
            : "We’ll use this to match you with mentee"}
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {role === "mentee" ? menteeInputs : mentorInputs}

          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? "Saving…" : "Finish"}
          </button>

          {formErr && <p className={styles.error}>{formErr}</p>}
        </form>
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