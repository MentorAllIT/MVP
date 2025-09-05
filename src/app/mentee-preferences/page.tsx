"use client";

import { useState, useEffect, useRef } from "react";
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
  helperText?: string;
  type: "text" | "select" | "number" | "textarea" | "multiselect";
  options?: string[];
  required: boolean;
};

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

const niceToHaveOptions = [
  ...mentoringStyles,
  {
    id: "none",
    label: "None",
    description: "I don't want any additional mentoring styles beyond what I've selected as required.",
    value: "No additional preferences"
  }
];

const preferenceFactors: PreferenceFactor[] = [
  {
    id: "currentIndustry",
    label: "Mentor's Current Industry",
    placeholder: "e.g., Technology, Healthcare, Finance, Education",
    type: "text",
    required: true,
  },
  {
    id: "currentRole",
    label: "Mentor's Current Role",
    placeholder: "e.g., Software Engineer, Product Manager, Data Analyst",
    type: "text",
    required: true,
  },
  {
    id: "seniorityLevel",
    label: "Mentor's Seniority Level",
    placeholder: "Select Your Preferred Mentor's Level",
    type: "select",
    options: ["Junior", "Mid-level", "Senior", "Manager", "Director", "Executive"],
    required: true,
  },
  {
    id: "previousRoles",
    label: "Mentor's Previous Role Experiences",
    placeholder: "List roles you want your mentor to have also experienced (e.g., Junior Developer, Team Lead, Product Manager)",
    type: "textarea",
    required: false,
  },
  {
    id: "mentoringStyle",
    label: "Preferred Mentoring Style",
    placeholder: "How would you like your mentor to guide you?",
    helperText: "How would you like your mentor to guide you?",
    type: "multiselect",
    options: mentoringStyles.map(style => style.id),
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
    label: "Culture / Language",
    placeholder: "e.g., International student from India, Native English speaker, Bilingual (Spanish/English)",
    type: "text",
    required: false,
  },
  {
    id: "availability",
    label: "Your Preferred Meeting Frequency",
    placeholder: "e.g., Weekly on weekends, Bi-weekly on weekdays, Flexible",
    type: "text",
    required: true,
  },
];

// Sortable Factor Item Component
function SortableFactorItem({ factor, index, renderInput, fieldErrs, currentStep }: {
  factor: PreferenceFactor;
  index: number;
  renderInput: (factor: PreferenceFactor, step: number) => React.ReactNode;
  fieldErrs: Record<string, string>;
  currentStep: number;
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
          {factor.helperText && currentStep === 1 && (
            <p className={styles.helperText}>{factor.helperText}</p>
          )}
        </div>
      </div>
      
      <div className={styles.factorInput}>
        {renderInput(factor, currentStep)}
        {fieldErrs[factor.id] && (
          <span className={styles.fieldError}>{fieldErrs[factor.id]}</span>
        )}
      </div>
    </div>
  );
}

// Mentoring Style Tooltip Component
function MentoringStyleTooltip({ style }: { style: typeof mentoringStyles[0] }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={styles.tooltipContainer}>
      <button
        type="button"
        className={styles.infoButton}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        aria-label={`Learn more about ${style.label} mentoring style`}
      >
        <span className={styles.infoIcon}>i</span>
      </button>
      {isVisible && (
        <div className={styles.tooltip}>
          <h4>{style.label}</h4>
          <p>{style.description}</p>
          <p className={styles.tooltipValue}><strong>Value:</strong> {style.value}</p>
        </div>
      )}
    </div>
  );
}

interface MentoringStylePreferences {
  required: string[];
  niceToHave: string[];
  dontMind: boolean;
}

interface Preferences {
  currentIndustry: string;
  currentRole: string;
  seniorityLevel: string;
  previousRoles: string;
  mentoringStyle: MentoringStylePreferences;
  yearsExperience: string;
  culturalBackground: string;
  availability: string;
  factorOrder: string[];
  [key: string]: string | number | string[] | MentoringStylePreferences;
}

export default function MenteePreferences() {
  const params = useSearchParams();
  const router = useRouter();

  // Initialize state with all preference factors
  const [preferences, setPreferences] = useState<Preferences>({
    currentIndustry: '',
    currentRole: '',
    seniorityLevel: '',
    previousRoles: '',
    mentoringStyle: {
      required: [],
      niceToHave: [],
      dontMind: false
    },
    yearsExperience: '',
    culturalBackground: '',
    availability: '',
    factorOrder: []
  });

  // Initialize ordered factors (this will be the drag and drop order)
  const [orderedFactors, setOrderedFactors] = useState(() => [...preferenceFactors]);

  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // Track current step
  const [isReady, setIsReady] = useState(false); // Track if component is ready for submission
  const [hasReachedStep2, setHasReachedStep2] = useState(false); // Track if user has manually reached step 2

  const uid = params.get("uid");
  const role = params.get("role");

  if (!uid || role !== "mentee") {
    return <p style={{ padding: "2rem" }}>This page is for mentees only.</p>;
  }

  // Load existing preferences data when component mounts
  useEffect(() => {
    let isMounted = true; // Track if component is still mounted
    
    // Check if step=2 is in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get('step');
    if (stepParam === '2') {
      setCurrentStep(2);
      setHasReachedStep2(true);
    }
    
    const fetchPreferences = async () => {
      try {
        const response = await fetch(`/api/mentee-preferences?uid=${uid}`);
        
        // Check if component is still mounted before proceeding
        if (!isMounted) {
          return;
        }
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.preferences) {
            const prefs = data.preferences;
            
            // Handle mentoring style conversion from stored format
            let mentoringStyleData: MentoringStylePreferences = {
              required: [],
              niceToHave: [],
              dontMind: false
            };
            
            
            if (prefs.mentoringStyle === 'dont_mind' || 
                prefs.requiredMentoringStyles === 'dont_mind' || 
                prefs.niceToHaveStyles === 'dont_mind') {
              mentoringStyleData.dontMind = true;
            } else {
              // Use the new separate fields for required and nice-to-have styles
              if (prefs.requiredMentoringStyles) {
                const requiredLabels = prefs.requiredMentoringStyles.split(',').map((s: string) => s.trim()).filter((s: string) => s);
                // Convert labels to IDs
                const requiredIds = requiredLabels.map((label: string) => {
                  const style = mentoringStyles.find(s => s.label === label);
                  return style ? style.id : label; // fallback to label if not found
                });
                mentoringStyleData.required = requiredIds;
              }
              
              if (prefs.niceToHaveStyles) {
                const niceToHaveLabels = prefs.niceToHaveStyles.split(',').map((s: string) => s.trim()).filter((s: string) => s);
                // Convert labels to IDs
                const niceToHaveIds = niceToHaveLabels.map((label: string) => {
                  if (label === 'None') {
                    return 'none'; // Convert "None" to "none" ID
                  }
                  const style = mentoringStyles.find(s => s.label === label);
                  return style ? style.id : label; // fallback to label if not found
                });
                mentoringStyleData.niceToHave = niceToHaveIds;
              } else {
                // If no nice-to-have styles are saved, it means "None" was selected
                mentoringStyleData.niceToHave = ['none'];
              }
            }
            
            
            const newPreferences = {
              currentIndustry: prefs.currentIndustry || '',
              currentRole: prefs.currentRole || '',
              seniorityLevel: prefs.seniorityLevel || '',
              previousRoles: prefs.previousRoles || '',
              mentoringStyle: mentoringStyleData,
              yearsExperience: prefs.yearsExperience?.toString() || '',
              culturalBackground: prefs.culturalBackground || '',
              availability: prefs.availability || '',
              factorOrder: data.order || []
            };
            
            
            // Check if component is still mounted before setting state
            if (isMounted) {
              setPreferences(newPreferences);
            }
          } else {
          }
        } else {
        }
      } catch (error) {
        console.error('❌ Error fetching preferences:', error);
      } finally {
        // Always set loading to false after the request completes, but only if mounted
        if (isMounted) {
        setLoading(false);
        }
      }
    };

    if (uid) {
      fetchPreferences();
    } else {
      // If no UID, set loading to false immediately
      if (isMounted) {
        setLoading(false);
      }
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [uid]);

  // Debug: Log preferences changes
  useEffect(() => {
    try {
    } catch (error) {
      console.error("Error logging preferences change:", error);
    }
  }, [preferences]);

  // Debug: Log loading state changes
  useEffect(() => {
    try {
    } catch (error) {
      console.error("Error logging loading change:", error);
    }
  }, [loading]);

  // Debug: Log currentStep changes
  useEffect(() => {
    try {
    } catch (error) {
      console.error("Error logging step change:", error);
    }
  }, [currentStep, hasReachedStep2]);

  // No longer need form prevention since we removed the form element

  // Removed unnecessary hamburger menu code - this page doesn't need it

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleInputChange = (factorId: string, value: string | number | string[] | MentoringStylePreferences) => {
    try {
      setPreferences(prev => {
        const newPreferences = {
          ...prev,
          [factorId]: value
        };
        return newPreferences;
      });
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  };

  const handleMentoringStyleChange = (type: 'required' | 'niceToHave', styleId: string, checked: boolean) => {
    try {
      
      setPreferences(prev => {
        const current = prev.mentoringStyle;
        
        if (type === 'required') {
          if (checked) {
            // Add to required (max 2)
            if (current.required.length < 2) {
              return {
                ...prev,
                mentoringStyle: {
                  ...current,
                  required: [...current.required, styleId],
                  dontMind: false // Uncheck "I don't mind" if specific styles selected
                }
              };
            } else {
            }
          } else {
            // Remove from required - but prevent removing if it's the last one
            if (current.required.length <= 1) {
              return prev; // Don't allow removal
            }
            return {
              ...prev,
              mentoringStyle: {
                ...current,
                required: current.required.filter(id => id !== styleId)
              }
            };
          }
        } else if (type === 'niceToHave') {
          if (checked) {
            if (styleId === 'none') {
              // "None" selected - clear all other nice-to-have styles
              return {
                ...prev,
                mentoringStyle: {
                  ...current,
                  niceToHave: ['none'],
                  dontMind: false // Uncheck "I don't mind" if specific styles selected
                }
              };
            } else {
              // Add to nice-to-have (but not if it's already in required)
              if (!current.required.includes(styleId)) {
                return {
                  ...prev,
                  mentoringStyle: {
                    ...current,
                    niceToHave: [...current.niceToHave.filter(id => id !== 'none'), styleId],
                    dontMind: false // Uncheck "I don't mind" if specific styles selected
                  }
                };
              } else {
              }
            }
          } else {
            // Remove from nice-to-have
            if (styleId === 'none') {
              // "None" unchecked - allow other selections
              return {
                ...prev,
                mentoringStyle: {
                  ...current,
                  niceToHave: current.niceToHave.filter(id => id !== 'none')
                }
              };
            } else {
              // Remove specific style
              return {
                ...prev,
                mentoringStyle: {
                  ...current,
                  niceToHave: current.niceToHave.filter(id => id !== styleId)
                }
              };
            }
          }
        }
        
        return prev;
      });
    } catch (error) {
      console.error("Error updating mentoring styles:", error);
    }
  };

  const handleDontMindChange = (checked: boolean) => {
    setPreferences(prev => ({
      ...prev,
      mentoringStyle: {
        required: [],
        niceToHave: [],
        dontMind: checked
      }
    }));
  };

  const handleNextStep = () => {
    
    // Validate that all required fields are filled
    const errors: Record<string, string> = {};
    preferenceFactors.forEach(factor => {
      
      if (factor.required) {
        if (factor.id === "mentoringStyle") {
          const mentoringStyle = preferences.mentoringStyle;
          
          if (mentoringStyle.dontMind) {
          } else if (mentoringStyle.required.length === 0) {
            const errorMsg = `${factor.label} is required`;
            errors[factor.id] = errorMsg;
          } else {
          }
        } else if (factor.type === "multiselect") {
          const value = preferences[factor.id];
          
          if (!Array.isArray(value) || (value as string[]).length === 0) {
            const errorMsg = `${factor.label} is required`;
            errors[factor.id] = errorMsg;
          }
        } else if (typeof preferences[factor.id] === "string" && (preferences[factor.id] as string).trim() === "") {
          const errorMsg = `${factor.label} is required`;
          errors[factor.id] = errorMsg;
        } else if (typeof preferences[factor.id] === "number" && preferences[factor.id] === 0) {
          const errorMsg = `${factor.label} is required`;
          errors[factor.id] = errorMsg;
        }
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
  };

  const handlePreviousStep = () => {
    setCurrentStep(1);
    // Don't reset preferences - keep them as they are
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

  // Validation function
  const validateForm = () => {
    
    const errors: { [key: string]: string } = {};
    
    preferenceFactors.forEach((factor) => {
      const value = preferences[factor.id];
      
      if (factor.required) {
        if (factor.id === "mentoringStyle") {
          const mentoringStyle = value as MentoringStylePreferences;
          
          if (mentoringStyle.dontMind) {
          } else if (mentoringStyle.required.length === 0) {
            const errorMsg = `${factor.label} is required - please select at least one required style or choose "I don't mind"`;
            errors[factor.id] = errorMsg;
          } else {
          }
          // Note: nice-to-have can be empty - that's perfectly fine
          // Users can have just required styles, or required + nice-to-have, or "I don't mind"
        } else if (factor.type === "multiselect") {
          if (!Array.isArray(value) || value.length === 0) {
            const errorMsg = `${factor.label} is required`;
            errors[factor.id] = errorMsg;
          }
        } else if (factor.id === "yearsExperience") {
          // Special handling for yearsExperience - it can be string or number
          const numValue = typeof value === "string" ? parseInt(value) : (typeof value === "number" ? value : NaN);
          if (!value || value === "" || value === "0" || numValue === 0 || isNaN(numValue)) {
            const errorMsg = `${factor.label} is required and must be greater than 0`;
            errors[factor.id] = errorMsg;
          }
        } else if (typeof value === "string" && value.trim() === "") {
          const errorMsg = `${factor.label} is required`;
          errors[factor.id] = errorMsg;
        } else if (typeof value === "number" && value === 0) {
          const errorMsg = `${factor.label} is required`;
          errors[factor.id] = errorMsg;
        }
      }
    });
    
    
    return Object.keys(errors).length === 0;
  };

  const handleStep2Finish = () => {
    window.location.href = '/dashboard';
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const formData = new FormData();
    formData.append('uid', uid);
    formData.append('role', role);
    
    // Debug: Log all FormData entries

    Object.keys(preferences).forEach((key) => {
      const value = preferences[key as keyof Preferences];
      
      if (key === 'mentoringStyle') {
        const mentoringStyle = value as MentoringStylePreferences;
        if (mentoringStyle.dontMind) {
          formData.append('mentoringStyle', 'dont_mind');
          // When "I don't mind" is selected, send empty strings for the other fields
          formData.append('requiredMentoringStyles', '');
          formData.append('niceToHaveStyles', '');
        } else {
          // Send all selected styles (required + nice-to-have)
          const allStyles = [...mentoringStyle.required, ...mentoringStyle.niceToHave];
          formData.append('mentoringStyle', allStyles.join(', '));
          
          // Send required styles separately for scoring
          if (mentoringStyle.required.length > 0) {
            formData.append('requiredMentoringStyles', mentoringStyle.required.join(', '));
          } else {
            formData.append('requiredMentoringStyles', '');
          }
          
          // Send nice-to-have styles separately (always send, even if empty)
          const niceToHaveStyles = mentoringStyle.niceToHave.filter(style => style !== 'none');
          if (niceToHaveStyles.length > 0) {
            formData.append('niceToHaveStyles', niceToHaveStyles.join(', '));
          } else if (mentoringStyle.niceToHave.includes('none')) {
            formData.append('niceToHaveStyles', 'None');
          } else {
            formData.append('niceToHaveStyles', '');
          }
        }
      } else if (typeof value === "string") {
        formData.append(key, value.trim());
      } else if (typeof value === "number") {
        formData.append(key, value.toString());
      } else if (Array.isArray(value)) {
        formData.append(key, value.join(', '));
      }
    });

    try {
      
      const response = await fetch('/api/mentee-preferences', {
        method: 'POST',
        body: formData,
      });


      if (response.ok) {
        // Move to Step 2 (Save & Review) after saving preferences
        
        // Use setTimeout to ensure state updates happen after the current execution
        setTimeout(() => {
          setCurrentStep(2);
          setHasReachedStep2(true);
          setSubmitting(false);
          
          // Fallback: If state doesn't update after 1 second, reload the page with step=2
          setTimeout(() => {
            if (currentStep === 1) {
              window.location.href = `${window.location.pathname}?uid=${uid}&role=${role}&step=2`;
            }
          }, 1000);
        }, 100);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to save preferences'}`);
      }
    } catch (error) {
      console.error('🔍 DEBUG: Error in try-catch:', error);
      alert('Error saving preferences. Please try again.');
    }
  };

  // Update the renderInput function to handle multiselect
  const renderInput = (factor: PreferenceFactor, step: number = currentStep) => {
    const value = preferences[factor.id];
    
    // In Step 2, show read-only values instead of input fields
    if (step === 2) {
      if (factor.id === "mentoringStyle") {
        const mentoringStyle = value as MentoringStylePreferences;
        
        // Special rendering for mentoring style to show better structure
        if (mentoringStyle.dontMind) {
          return (
            <div className={styles.readOnlyValue}>
              <div className={styles.mentoringStyleReview}>
                <div className={styles.mentoringStyleSection}>
                  <span className={styles.sectionLabel}>Mentoring Style Preference:</span>
                  <span className={styles.dontMindDisplay}>I don't mind any mentoring style</span>
                  <span className={styles.styleNote}>(Full score for all mentors)</span>
                </div>
              </div>
            </div>
          );
        } else {
          return (
            <div className={styles.readOnlyValue}>
              <div className={styles.mentoringStyleReview}>
                {mentoringStyle.required.length > 0 && (
                  <div className={styles.mentoringStyleSection}>
                    <span className={styles.sectionLabel}>Must Have:</span>
                    <div className={styles.styleTags}>
                      {mentoringStyle.required.map(styleId => {
                        const style = mentoringStyles.find(s => s.id === styleId);
                        return (
                          <span key={styleId} className={styles.requiredTag}>
                            {style ? style.label : styleId}
                          </span>
                        );
                      })}
                    </div>
                    {/* <span className={styles.styleNote}>(Affect matching score)</span> */}
                  </div>
                )}
                
                {mentoringStyle.niceToHave.length > 0 && mentoringStyle.niceToHave[0] !== 'none' && (
                  <div className={styles.mentoringStyleSection}>
                    <span className={styles.sectionLabel}>Nice-to-Have:</span>
                    <div className={styles.styleTags}>
                      {mentoringStyle.niceToHave.map(styleId => {
                        const style = mentoringStyles.find(s => s.id === styleId);
                        return (
                          <span key={styleId} className={styles.niceToHaveTag}>
                            {style ? style.label : styleId}
                          </span>
                        );
                      })}
                    </div>
                    {/* <span className={styles.styleNote}>(No scoring impact)</span> */}
                  </div>
                )}
                
                {mentoringStyle.niceToHave.includes('none') && (
                  <div className={styles.mentoringStyleSection}>
                    <span className={styles.sectionLabel}>Additional Preferences:</span>
                    <span className={styles.noneDisplay}>No additional styles selected</span>
                  </div>
                )}
              </div>
            </div>
          );
        }
      }
      
      // Handle other field types for read-only display
      let displayValue = '';
      
      if (typeof value === "string") {
        displayValue = value || "Not specified";
      } else if (Array.isArray(value)) {
        displayValue = value.join(', ') || "Not specified";
      } else if (typeof value === "number") {
        displayValue = value.toString() || "Not specified";
      } else {
        displayValue = "Not specified";
      }
      
      return (
        <div className={styles.readOnlyValue}>
          <span className={styles.readOnlyText}>{displayValue}</span>
        </div>
      );
    }
    
    // Handle editable form fields for Step 1
    if (factor.type === "multiselect" && factor.id === "mentoringStyle") {
      
      return (
        <div className={styles.mentoringStyleContainer}>
          <div className={styles.mentoringStyleSection}>
            <h4 className={styles.sectionTitle}>
              Required Mentoring Styles (Max 2 - Affect Matching) 
              {preferences.mentoringStyle.required.length < 2 && (
                <span className={styles.selectionCount}>
                  - {2 - preferences.mentoringStyle.required.length} more can be selected
                </span>
              )}
              {preferences.mentoringStyle.required.length >= 2 && (
                <span className={styles.selectionCount}>
                  - Maximum reached
                </span>
              )}
            </h4>
            <p className={styles.sectionDescription}>
              Select 1-2 mentoring styles that are essential for your match. At least one must be selected.
            </p>
            <div className={styles.styleGrid}>
              {mentoringStyles.map((style) => (
                <label key={style.id} className={styles.styleLabel}>
                  <input
                    type="checkbox"
                    checked={preferences.mentoringStyle.required.includes(style.id)}
                    onChange={(e) => handleMentoringStyleChange('required', style.id, e.target.checked)}
                    disabled={!preferences.mentoringStyle.required.includes(style.id) && 
                             preferences.mentoringStyle.required.length >= 2}
                    title={preferences.mentoringStyle.required.includes(style.id) && 
                           preferences.mentoringStyle.required.length === 1 ? 
                           "Cannot remove - at least one required style must remain" : ""}
                  />
                  <span className={styles.styleText}>{style.label}</span>
                  <MentoringStyleTooltip style={style} />
                  {preferences.mentoringStyle.required.includes(style.id) && 
                   preferences.mentoringStyle.required.length === 1 && (
                    <span className={styles.requiredIndicator}>*</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.mentoringStyleSection}>
            <h4 className={styles.sectionTitle}>
              Nice-to-Have Styles (Completely Optional - No Scoring Impact)
            </h4>
            <p className={styles.sectionDescription}>
              Select any additional styles you'd like to explore, or choose "None". These won't affect your matching result and are not required.
            </p>
            <div className={styles.styleGrid}>
              {niceToHaveOptions.map((style) => (
                <label key={style.id} className={styles.styleLabel}>
                  <input
                    type="checkbox"
                    checked={preferences.mentoringStyle.niceToHave.includes(style.id)}
                    onChange={(e) => handleMentoringStyleChange('niceToHave', style.id, e.target.checked)}
                    disabled={preferences.mentoringStyle.required.includes(style.id)}
                  />
                  <span className={styles.styleText}>{style.label}</span>
                  {style.id !== "none" && <MentoringStyleTooltip style={style} />}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.dontMindSection}>
            <label className={styles.dontMindLabel}>
              <input
                type="checkbox"
                checked={preferences.mentoringStyle.dontMind}
                onChange={(e) => handleDontMindChange(e.target.checked)}
              />
              <span className={styles.dontMindText}>
                I don't mind any mentoring style (Full score for all mentors)
              </span>
            </label>
          </div>
        </div>
      );
    }

    if (factor.type === "select") {
        return (
          <select
          value={typeof value === "string" ? value : ""}
            onChange={(e) => handleInputChange(factor.id, e.target.value)}
          className={styles.select}
          >
          <option value="">Select {factor.label}</option>
            {factor.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
    }

    if (factor.type === "number") {
        return (
          <input
            type="number"
          value={typeof value === "number" ? value : typeof value === "string" ? value : ""}
          onChange={(e) => {
            const inputValue = e.target.value;
            
            // Handle empty input
            if (inputValue === "") {
              handleInputChange(factor.id, "");
              return;
            }
            
            // Handle valid numbers
            const numValue = parseInt(inputValue);
            if (!isNaN(numValue) && numValue > 0) {
              handleInputChange(factor.id, numValue);
            } else {
              handleInputChange(factor.id, inputValue);
            }
          }}
          className={styles.input}
          placeholder={`Enter ${factor.label}`}
        />
      );
    }

    if (factor.type === "textarea") {
      const textareaRef = useRef<HTMLTextAreaElement>(null);
      
      const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        handleInputChange(factor.id, e.target.value);
        
        // Auto-resize textarea
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      };

      return (
        <textarea
          ref={textareaRef}
          value={typeof value === "string" ? value : ""}
          onChange={handleTextareaChange}
          className={`${styles.textarea} ${styles.textareaAutoResize}`}
          placeholder={factor.placeholder}
          rows={3}
        />
      );
    }

    // Default text input
        return (
          <input
            type="text"
        value={typeof value === "string" ? value : ""}
            onChange={(e) => handleInputChange(factor.id, e.target.value)}
        className={styles.input}
        placeholder={`Enter ${factor.label}`}
          />
        );
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
            Back to Dashboard
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
            {currentStep === 1 ? (
              <>
                Step 1:<br />
                Describe YOUR Ideal Mentor
              </>
            ) : (
              "Step 2: Rank your priorities"
            )}
          </h1>
          <p className={styles.subtitle}>
            {currentStep === 1 
              ? "Tell us about the kind of mentor who would best support your growth. Required fields are marked with an asterisk."
              : "Review your preferences below and rank the factors by importance. The top factor is most important to you."
            }
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.form}>
            {currentStep === 1 ? (
              // Step 1: Fill in the details
              <div className={styles.fillDetailsStep}>
                

                <div className={styles.factorsList}>
                  {orderedFactors.map((factor, index) => (
                    <div key={factor.id} className={styles.factorItem}>
                      <div className={styles.factorHeader}>
                        <span className={styles.labelText}>
                          {factor.label}
                          {factor.required && <span className={styles.required}>*</span>}
                        </span>
                        {factor.helperText && (
                          <p className={styles.helperText}>{factor.helperText}</p>
                        )}
                      </div>
                      
                      <div className={styles.factorInput}>
                        {renderInput(factor, currentStep)}
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
                          currentStep={currentStep}
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
                    Previous Page
              </button>
              <button
                    type="button"
                    onClick={handleManualSubmit}
                    className={styles.button}
                  >
                    Save & Finish
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
                    Back to Edit
              </button>
              <button
                    type="button"
                    onClick={() => {
                      handleStep2Finish();
                    }}
                disabled={submitting}
                className={styles.button}
              >
                    {submitting ? "Saving Preferences..." : "Save & Finish"}
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
            Back to Dashboard
          </button>
        </div> */}
      </div>
    </div>
  );
}