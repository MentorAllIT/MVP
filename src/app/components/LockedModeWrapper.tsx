'use client';

import { ReactNode } from 'react';
import { useLockedMode } from '@/lib/useFeatureFlag';
import OnboardingCompletePopup from './OnboardingCompletePopup';

interface LockedModeWrapperProps {
  children: ReactNode;
  showPopup?: boolean;
  onPopupClose?: () => void;
}

export default function LockedModeWrapper({ 
  children, 
  showPopup = false, 
  onPopupClose 
}: LockedModeWrapperProps) {
  const { isEnabled: isLocked, isLoading } = useLockedMode();

  // Show loading state while checking feature flag
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If not locked, show normal content
  if (!isLocked) {
    return <>{children}</>;
  }

  // If locked, show locked mode message
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Coming Soon!
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Our magic matching system is being fine-tuned to ensure you meet your perfect mentor. 
            We'll notify you as soon as it's ready!
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
            <p className="text-blue-800 text-sm">
              <strong>Stay tuned!</strong> We're working hard to bring you the best mentor matching experience.
            </p>
          </div>
        </div>
      </div>
      
      {/* Show popup if requested */}
      {showPopup && (
        <OnboardingCompletePopup 
          isOpen={showPopup} 
          onClose={onPopupClose || (() => {})} 
        />
      )}
    </div>
  );
}
