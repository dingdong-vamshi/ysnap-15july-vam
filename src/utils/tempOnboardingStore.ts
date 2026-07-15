export interface TempOnboardingData {
  native: string;
  target: string;
  purpose: string;
  selected_goals: string[];
  experience_level: string;
  preferred_mode: string;
  reminder_enabled: boolean;
}

let tempOnboardingData: TempOnboardingData | null = null;

export const tempOnboardingStore = {
  set(data: TempOnboardingData) {
    tempOnboardingData = data;
  },
  get(): TempOnboardingData | null {
    return tempOnboardingData;
  },
  clear() {
    tempOnboardingData = null;
  }
};

import { Platform } from 'react-native';

export interface DemoProfileData {
  onboarding_completed: boolean;
  native_language: string | null;
  primary_target_language: string | null;
  translation_purpose: string | null;
}

const SESSION_KEY = 'ysnap-demo-profile';

function getInitialDemoProfile(): DemoProfileData {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
  }
  return {
    onboarding_completed: false,
    native_language: null,
    primary_target_language: null,
    translation_purpose: null,
  };
}

let demoProfileData: DemoProfileData = getInitialDemoProfile();

export const demoProfileStore = {
  set(data: Partial<DemoProfileData>) {
    demoProfileData = { ...demoProfileData, ...data };
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(demoProfileData));
    }
  },
  get(): DemoProfileData {
    return demoProfileData;
  },
  reset() {
    demoProfileData = {
      onboarding_completed: false,
      native_language: null,
      primary_target_language: null,
      translation_purpose: null,
    };
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('ysnap-demo');
    }
  }
};
