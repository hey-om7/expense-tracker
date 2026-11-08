import React, { useMemo } from 'react';
import LegalDocument from '../components/legal/LegalDocument';
import { privacyPolicy } from '../legal/privacyPolicy';

const PrivacyPolicyScreen = () => {
  const doc = useMemo(privacyPolicy, []);
  return <LegalDocument doc={doc} other={{ to: '/terms', label: 'Terms of Service' }} />;
};

export default PrivacyPolicyScreen;
