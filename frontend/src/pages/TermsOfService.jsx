import React, { useMemo } from 'react';
import LegalDocument from '../components/legal/LegalDocument';
import { termsOfService } from '../legal/termsOfService';

const TermsOfServiceScreen = () => {
  const doc = useMemo(termsOfService, []);
  return <LegalDocument doc={doc} other={{ to: '/privacy', label: 'Privacy Policy' }} />;
};

export default TermsOfServiceScreen;
