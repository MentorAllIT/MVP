"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from "./menteePreferences.module.css";

// Types for the preference factors
type PreferenceFactor = {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "select" | "number" | "textarea";
  options?: string[];
  required: boolean;
};

const preferenceFactors: PreferenceFactor[] = [
  {
    id: "currentIndustry",
    label: "Current Industry",
    placeholder: "e.g., Technology, Healthcare, Finance, Education",
    type: "text",
    required: true,
  },
  {
    id: "currentRole",
    label: "Current Role",
    placeholder: "e.g., Software Engineer, Product Manager, Data Analyst",
    type: "text",
    required: true,
  },
  {
    id: "seniorityLevel",
    label: "Current Seniority Level",
    placeholder: "Select your level",
    type: "select",
    options: ["Junior", "Mid-level", "Senior", "Manager", "Director", "Executive"],
    required: true,
  },
  {
    id: "previousRoles",
    label: "Previous Role Experiences",
    placeholder: "List roles you want your mentor to have also experienced (e.g., Junior Developer, Team Lead, Product Manager)",
    type: "textarea",
    required: false,
  },
  {
    id: "mentoringStyle",
    label: "Preferred Mentoring Style",
    placeholder: "Select your preferred style",
    type: "select",
    options: ["Direct", "High-level", "Task-assigned", "Coaching"],
    required: true,
  },
  {
    id: "yearsExperience",
    label: "Years of Experience",
    placeholder: "e.g., 2",
    type: "number",
    required: true,
  },
  {
    id: "culturalBackground",
    label: "Cultural / Language Background",
    placeholder: "e.g., International student from India, Native English speaker, Bilingual (Spanish/English)",
    type: "text",
    required: false,
  },
  {
    id: "availability",
    label: "Availability to Meet Regularly",
    placeholder: "e.g., Weekly on weekends, Bi-weekly on weekdays, Flexible",
    type: "text",
    required: true,
  },
];

// Sortable Factor Item Component
function SortableFactorItem({ factor, index, renderInput, fieldErrs }: {
  factor: PreferenceFactor;
  index: number;
  renderInput: (factor: PreferenceFactor) => React.ReactNode;
  fieldErrs: Record<string, string>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: factor.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.factorItem} ${isDragging ? styles.factorItemDragging : ''}`}
    >
      <div className={styles.factorHeader}>
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          <div className={styles.dragIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="4" cy="4" r="1.5" />
              <circle cx="12" cy="4" r="1.5" />
              <circle cx="4" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="4" cy="8" r="1.5" />
              <circle cx="12" cy="8" r="1.5" />
            </svg>
          </div>
          <span className={styles.factorNumber}>{index + 1}</span>
          <span className={styles.factorPriority}>
            {index === 0 && "Most Important"}
            {index === 1 && "Very Important"}
            {index === 2 && "Important"}
            {index === 3 && "Somewhat Important"}
            {index === 4 && "Moderately Important"}
            {index === 5 && "Less Important"}
            {index === 6 && "Not Very Important"}
            {index === 7 && "Least Important"}
          </span>
        </div>
        <div className={styles.factorLabel}>
          <span className={styles.labelText}>
            {factor.label}
            {factor.required && <span className={styles.required}>*</span>}
          </span>
        </div>
      </div>
      
      <div className={styles.factorInput}>
        {renderInput(factor)}
        {fieldErrs[factor.id] && (
          <span className={styles.fieldError}>{fieldErrs[factor.id]}</span>
        )}
      </div>
    </div>
  );
}

export default function MenteePreferences() {
  const params = useSearchParams();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const uid = params.get("uid");
  const role = params.get("role");

  if (!uid || role !== "mentee") {
    return <p style={{ padding: "2rem" }}>This page is for mentees only.</p>;
  }

  // Initialize state with all preference factors
  const [preferences, setPreferences] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    preferenceFactors.forEach(factor => {
      initial[factor.id] = "";
    });
    return initial;
  });

  // Initialize ordered factors (this will be the drag and drop order)
  const [orderedFactors, setOrderedFactors] = useState(() => [...preferenceFactors]);

  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing preferences data when component mounts
  useEffect(() => {
    const loadExistingPreferences = async () => {
      if (!uid) return;
      
      try {
        // Try to fetch existing preferences data
        const res = await fetch(`/api/mentee-preferences?uid=${uid}`);
        if (res.ok) {
          const preferencesData = await res.json();
          if (preferencesData.preferences) {
            setPreferences(prev => ({
              ...prev,
              ...preferencesData.preferences
            }));
          }
          if (preferencesData.order) {
            // Reorder factors based on saved order
            const newOrder = preferencesData.order.map((id: string) => 
              preferenceFactors.find(f => f.id === id)
            ).filter(Boolean);
            if (newOrder.length > 0) {
              setOrderedFactors(newOrder);
            }
          }
        }
      } catch (error) {
        console.log("No existing preferences found or error loading preferences");
      } finally {
        setLoading(false);
      }
    };

    loadExistingPreferences();
  }, [uid]);

  // Removed unnecessary hamburger menu code - this page doesn't need it

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleInputChange = (factorId: string, value: string) => {
    setPreferences(prev => ({ ...prev, [factorId]: value }));
    // Clear error when user starts typing
    if (fieldErrs[factorId]) {
      setFieldErrs(prev => ({ ...prev, [factorId]: "" }));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setOrderedFactors((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Loading state check
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.wrapper}>
          <div className={styles.loading}>Loading your preferences...</div>
        </div>
      </div>
    );
  }

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    preferenceFactors.forEach(factor => {
      if (factor.required && !preferences[factor.id]?.trim()) {
        errors[factor.id] = `${factor.label} is required`;
      }
    });

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrs(errors);
      return;
    }

    setSubmitting(true);
    setFieldErrs({});
    setFormErr(null);

    try {
      // Create rankings based on the order (1 = most important, 8 = least important)
      const rankings: Record<string, number> = {};
      orderedFactors.forEach((factor, index) => {
        rankings[factor.id] = 8 - index; // Reverse so first item gets highest score
      });

      const response = await fetch("/api/mentee-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          preferences,
          rankings,
          order: orderedFactors.map(f => f.id), // Also send the order
        }),
      });

      if (response.ok) {
        router.replace("/dashboard");
      } else {
        const data = await response.json();
        setFormErr(data.error || "Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      setFormErr("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = (factor: PreferenceFactor) => {
    const value = preferences[factor.id];
    const error = fieldErrs[factor.id];
    const inputId = `input-${factor.id}`;

    switch (factor.type) {
      case "select":
        return (
          <select
            id={inputId}
            value={value}
            onChange={(e) => handleInputChange(factor.id, e.target.value)}
            className={`${styles.input} ${error ? styles.inputError : ""}`}
          >
            <option value="">{factor.placeholder}</option>
            {factor.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case "textarea":
        return (
          <textarea
            id={inputId}
            value={value}
            onChange={(e) => handleInputChange(factor.id, e.target.value)}
            className={`${styles.textarea} ${error ? styles.inputError : ""}`}
            placeholder={factor.placeholder}
            rows={3}
          />
        );

      case "number":
        return (
          <input
            id={inputId}
            type="number"
            value={value}
            onChange={(e) => handleInputChange(factor.id, e.target.value)}
            className={`${styles.input} ${error ? styles.inputError : ""}`}
            placeholder={factor.placeholder}
            min="0"
          />
        );

      default: // text
        return (
          <input
            id={inputId}
            type="text"
            value={value}
            onChange={(e) => handleInputChange(factor.id, e.target.value)}
            className={`${styles.input} ${error ? styles.inputError : ""}`}
            placeholder={factor.placeholder}
          />
        );
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>Help us find your perfect mentor</h1>
          <p className={styles.subtitle}>
            Drag and drop the factors below to rank them by importance. The top factor is most important to you.
          </p>
        </div>

        <div className={styles.card}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.dragInstructions}>
              <div className={styles.instructionsIcon}>🎯</div>
              <div className={styles.instructionsText}>
                <strong>How to rank:</strong> Drag each factor up or down to reorder them by importance. 
                The factor at the top (#1) is most important to you, and the bottom (#8) is least important.
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedFactors.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.factorsList}>
                  {orderedFactors.map((factor, index) => (
                    <SortableFactorItem
                      key={factor.id}
                      factor={factor}
                      index={index}
                      renderInput={renderInput}
                      fieldErrs={fieldErrs}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="submit"
              disabled={submitting}
              className={styles.button}
            >
              {submitting ? "Saving Preferences..." : "Save Preferences & Continue"}
            </button>

            {formErr && <p className={styles.error}>{formErr}</p>}
          </form>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: "100%" }}
            />
          </div>
          <span className={styles.progressText}>Final Step</span>
        </div>

        {/* Back to Dashboard Button */}
        <div className={styles.backSection}>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={styles.backButton}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}