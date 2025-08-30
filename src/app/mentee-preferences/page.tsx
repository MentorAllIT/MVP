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
    placeholder: "Select Your Preferred Mentor's Level",
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
  const [currentStep, setCurrentStep] = useState<1 | 2>(1); // Track current step
  const [isReady, setIsReady] = useState(false); // Track if component is ready for submission
  const [hasReachedStep2, setHasReachedStep2] = useState(false); // Track if user has manually reached step 2

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
      console.log("🔄 Loading existing preferences for UID:", uid);
      
      try {
        // Try to fetch existing preferences data
        const res = await fetch(`/api/mentee-preferences?uid=${uid}`);
        if (res.ok) {
          const preferencesData = await res.json();
          console.log("📥 Loaded preferences data:", preferencesData);
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
        console.log("✅ Data loading complete, setting ready state");
        
        // Add a small delay before setting ready to prevent automatic submission
        setTimeout(() => {
          setIsReady(true);
          console.log("✅ Component is now ready for interaction");
        }, 100);
      }
    };

    loadExistingPreferences();
  }, [uid]);

  // No longer need form prevention since we removed the form element

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

  const handleNextStep = () => {
    console.log("🔄 Moving to next step...");
    // Validate that all required fields are filled
    const errors: Record<string, string> = {};
    preferenceFactors.forEach(factor => {
      if (factor.required && !preferences[factor.id]?.trim()) {
        errors[factor.id] = `${factor.label} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrs(errors);
      return;
    }

    // Clear any existing errors and move to next step
    setFieldErrs({});
    setCurrentStep(2);
    setHasReachedStep2(true);
    console.log("✅ Now on step 2 - user manually navigated");
  };

  const handlePreviousStep = () => {
    setCurrentStep(1);
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

  const handleManualSubmit = async () => {
    console.log("🚨 MANUAL SUBMIT TRIGGERED! Current step:", currentStep, "Ready:", isReady, "ManuallyReachedStep2:", hasReachedStep2);
    
    // Only allow submission when explicitly on step 2, ready, AND user manually navigated
    if (!isReady || currentStep !== 2 || !hasReachedStep2) {
      console.log("❌ BLOCKING manual submission - Step:", currentStep, "Ready:", isReady, "ManuallyReachedStep2:", hasReachedStep2);
      return;
    }
    
    if (submitting) {
      console.log("❌ Already submitting, ignoring");
      return;
    }

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

    // In Step 2, show read-only values instead of input fields
    if (currentStep === 2) {
      return (
        <div className={styles.readOnlyValue}>
          {value || factor.placeholder || "Not specified"}
        </div>
      );
    }

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
        {/* Navigation Buttons - Only Back to Dashboard */}
        <div className={styles.topBackSection}>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={styles.topBackButton}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Step Indicators */}
        <div className={styles.stepIndicators}>
          <div className={`${styles.stepIndicator} ${currentStep === 1 ? styles.active : ''}`}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepLabel}>Fill Details</div>
          </div>
          <div className={styles.stepConnector}></div>
          <div className={`${styles.stepIndicator} ${currentStep === 2 ? styles.active : ''}`}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepLabel}>Rank Priorities</div>
          </div>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>
            {currentStep === 1 ? "Tell us about yourself" : "Rank your priorities"}
          </h1>
          <p className={styles.subtitle}>
            {currentStep === 1 
              ? "Fill in your details so we can find mentors who match your background and needs."
              : "Rank the factors below by importance. The top factor is most important to you."
            }
          </p>
        </div>

                <div className={styles.card}>
          <div className={styles.form}>
            {currentStep === 1 ? (
              // Step 1: Fill in the details
              <div className={styles.fillDetailsStep}>
                <div className={styles.stepInstructions}>
                  <div className={styles.instructionsIcon}>📝</div>
                  <div className={styles.instructionsText}>
                    <strong>Step 1:</strong> Fill in your details below. Required fields are marked with an asterisk (*).
                  </div>
                </div>

                <div className={styles.factorsList}>
                  {orderedFactors.map((factor, index) => (
                    <div key={factor.id} className={styles.factorItem}>
                      <div className={styles.factorHeader}>
                        <span className={styles.labelText}>
                          {factor.label}
                          {factor.required && <span className={styles.required}>*</span>}
                        </span>
                      </div>
                      
                      <div className={styles.factorInput}>
                        {renderInput(factor)}
                        {fieldErrs[factor.id] && (
                          <span className={styles.fieldError}>{fieldErrs[factor.id]}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Step 2: Rank the factors
              <div className={styles.rankPrioritiesStep}>
                <div className={styles.dragInstructions}>
                  <div className={styles.instructionsIcon}>🎯</div>
                  <div className={styles.instructionsText}>
                    <strong>Step 2:</strong> Drag each factor up or down to rank them by importance. 
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
              </div>
            )}

            <div className={styles.buttonGroup}>
              {currentStep === 1 ? (
                // Step 1 buttons
                <>
                  <button
                    type="button"
                    onClick={() => router.push(`/meta-setup?uid=${uid}&role=${role}`)}
                    className={styles.secondaryButton}
                  >
                    ← Previous Page
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={styles.button}
                  >
                    Next: Rank Priorities →
                  </button>
                </>
              ) : (
                // Step 2 buttons
                <>
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className={styles.secondaryButton}
                  >
                    ← Back to Details
                  </button>
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={submitting}
                    className={styles.button}
                  >
                    {submitting ? "Saving Preferences..." : "Finish"}
                  </button>
                </>
              )}
            </div>

            {formErr && <p className={styles.error}>{formErr}</p>}
          </div>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: currentStep === 1 ? "50%" : "100%" }}
            />
          </div>
          <span className={styles.progressText}>
            {currentStep === 1 ? "Step 1 of 2" : "Step 2 of 2"}
          </span>
        </div>

        {/* Back to Dashboard Button */}
        {/* <div className={styles.backSection}>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className={styles.backButton}
          >
            ← Back to Dashboard
          </button>
        </div> */}
      </div>
    </div>
  );
}