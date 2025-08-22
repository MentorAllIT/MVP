'use client';

import { useState, useEffect } from 'react';

export function useFeatureFlag(flagName: string, defaultValue: boolean = false) {
  const [isEnabled, setIsEnabled] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check environment variable first (for build-time flags)
    const envValue = process.env.NEXT_PUBLIC_LOCKED_MODE;
    
    if (envValue !== undefined) {
      setIsEnabled(envValue === 'true');
      setIsLoading(false);
      return;
    }

    // Check localStorage for runtime toggles
    const storedValue = localStorage.getItem(`feature_flag_${flagName}`);
    if (storedValue !== null) {
      setIsEnabled(storedValue === 'true');
      setIsLoading(false);
      return;
    }

    // Default value
    setIsEnabled(defaultValue);
    setIsLoading(false);
  }, [flagName, defaultValue]);

  const toggleFlag = (value?: boolean) => {
    const newValue = value !== undefined ? value : !isEnabled;
    setIsEnabled(newValue);
    localStorage.setItem(`feature_flag_${flagName}`, newValue.toString());
  };

  return {
    isEnabled,
    isLoading,
    toggleFlag
  };
}

// Specific hook for locked mode
export function useLockedMode() {
  return useFeatureFlag('LOCKED_MODE', true); // Default to locked
}
