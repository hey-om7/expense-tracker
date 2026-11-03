import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import { sectionToFlag } from '../utils/onboardingSteps';

const OnboardingContext = createContext();

const DEFAULT_ONBOARDING = {
  dashboardSeen: false,
  historySeen: false,
  investmentsSeen: false,
  cyclicSeen: false,
  aiSeen: false,
  settingsSeen: false,
};

export const OnboardingProvider = ({ children }) => {
  const [onboardingData, setOnboardingData] = useState(DEFAULT_ONBOARDING);
  const [activeSection, setActiveSection] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Fetch onboarding state from backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.fetchOnboarding();
        setOnboardingData(data || DEFAULT_ONBOARDING);
      } catch (err) {
        console.warn('Failed to fetch onboarding state:', err.message);
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, []);

  const startOnboarding = useCallback((section) => {
    // Only start if no other section is active
    if (activeSection && activeSection !== section) return;
    setActiveSection(section);
    setCurrentStep(0);
  }, [activeSection]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const completeOnboarding = useCallback(async (section) => {
    const flagKey = sectionToFlag[section];
    if (!flagKey) return;

    // Update local state immediately
    setOnboardingData(prev => ({ ...prev, [flagKey]: true }));
    setActiveSection(null);
    setCurrentStep(0);

    // Persist to backend
    try {
      await api.updateOnboarding({ [flagKey]: true });
    } catch (err) {
      console.error('Failed to update onboarding:', err);
    }
  }, []);

  const skipOnboarding = useCallback(() => {
    if (activeSection) {
      completeOnboarding(activeSection);
    }
  }, [activeSection, completeOnboarding]);

  const replayTutorial = useCallback(() => {
    // Reset local state to start from beginning without hitting backend
    setOnboardingData(DEFAULT_ONBOARDING);
    setActiveSection(null);
    setCurrentStep(0);
  }, []);

  const resetTutorial = useCallback(async () => {
    try {
      const data = await api.resetOnboarding();
      setOnboardingData(data || DEFAULT_ONBOARDING);
      setActiveSection(null);
      setCurrentStep(0);
    } catch (err) {
      console.error('Failed to reset onboarding:', err);
    }
  }, []);

  // Pause tour when navigating away (called by FeatureTour on unmount)
  const pauseOnboarding = useCallback(() => {
    setActiveSection(null);
    setCurrentStep(0);
  }, []);

  return (
    <OnboardingContext.Provider value={{
      onboardingData,
      activeSection,
      currentStep,
      isReady,
      startOnboarding,
      nextStep,
      skipOnboarding,
      completeOnboarding,
      replayTutorial,
      resetTutorial,
      pauseOnboarding,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => useContext(OnboardingContext);
