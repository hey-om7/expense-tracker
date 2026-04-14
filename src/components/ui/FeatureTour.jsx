import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useOnboarding } from '../../context/OnboardingContext';
import { onboardingSteps, sectionToFlag } from '../../utils/onboardingSteps';
import FeatureCard from './FeatureCard';

/**
 * FeatureTour - Orchestrates a section's onboarding tour.
 * Renders an overlay + positioned FeatureCard.
 *
 * Props:
 *   section  (string) - e.g. "dashboard", "history"
 */
const FeatureTour = ({ section }) => {
  const {
    onboardingData,
    activeSection,
    currentStep,
    isReady,
    startOnboarding,
    nextStep,
    skipOnboarding,
    completeOnboarding,
    pauseOnboarding,
  } = useOnboarding();

  const [targetRect, setTargetRect] = useState(null);
  const [animKey, setAnimKey] = useState(0); // triggers re-animation on step change
  const rafRef = useRef(null);

  const steps = onboardingSteps[section] || [];
  const flagKey = sectionToFlag[section];
  const isSeen = onboardingData[flagKey];
  const isActive = activeSection === section;

  // Auto-start onboarding when section mounts and hasn't been seen
  useEffect(() => {
    if (!isReady || isSeen) return;
    // Small delay to let the page render first
    const timer = setTimeout(() => {
      startOnboarding(section);
    }, 600);
    return () => clearTimeout(timer);
  }, [isReady, isSeen, section, startOnboarding]);

  // Pause onboarding on unmount (user navigated away)
  useEffect(() => {
    return () => {
      if (isActive) {
        pauseOnboarding();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Calculate target element position
  const updateTargetRect = useCallback(() => {
    if (!isActive || currentStep >= steps.length) return;
    
    const step = steps[currentStep];
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        return;
      }
    }
    setTargetRect(null);
  }, [isActive, currentStep, steps]);

  useEffect(() => {
    updateTargetRect();
    setAnimKey(prev => prev + 1);

    // Update position on scroll/resize
    const handleUpdate = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTargetRect);
    };
    
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateTargetRect, currentStep]);

  // Handlers
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      nextStep();
    }
  };

  const handleDone = () => {
    completeOnboarding(section);
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  // Don't render if not active or section already seen
  if (!isActive || isSeen || !isReady || currentStep >= steps.length) return null;

  const currentStepData = steps[currentStep];

  return (
    <div className="feature-tour-overlay" key={`tour-${section}`}>
      {/* Semi-transparent backdrop */}
      <div className="feature-tour-backdrop" onClick={handleSkip} />

      {/* Highlight ring around target element */}
      {targetRect && (
        <div
          className="feature-tour-highlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Card positioned relative to target or centered */}
      <div
        className={`feature-tour-card-positioner ${targetRect ? 'feature-tour-card-positioner--targeted' : 'feature-tour-card-positioner--centered'}`}
        key={animKey}
        style={targetRect ? getCardPosition(targetRect) : undefined}
      >
        <FeatureCard
          step={currentStepData}
          stepIndex={currentStep}
          totalSteps={steps.length}
          onNext={handleNext}
          onSkip={handleSkip}
          onDone={handleDone}
        />
      </div>
    </div>
  );
};

/**
 * Calculate card position relative to a target element.
 * Tries below the element first, then above, then centered.
 */
function getCardPosition(rect) {
  const cardWidth = 360;
  const cardHeight = 260;
  const padding = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // For mobile (< 768px), always use bottom-sheet positioning via CSS
  if (vw < 768) {
    return {};
  }

  let top, left;

  // Prefer positioning below the target
  if (rect.top + rect.height + cardHeight + padding < vh) {
    top = rect.top + rect.height + 12;
  } else if (rect.top - cardHeight - padding > 0) {
    // Position above
    top = rect.top - cardHeight - 12;
  } else {
    // Center vertically
    top = Math.max(padding, (vh - cardHeight) / 2);
  }

  // Horizontal: try to center on target
  left = rect.left + rect.width / 2 - cardWidth / 2;
  // Clamp to viewport
  left = Math.max(padding, Math.min(left, vw - cardWidth - padding));

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
  };
}

export default FeatureTour;
