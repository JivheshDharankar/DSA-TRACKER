import React from 'react';
import { TrackerPage } from '../components/problems/TrackerPage';

export const PersonalDsaPage: React.FC = () => {
  return (
    <TrackerPage
      section="PERSONAL"
      title="Personal DSA Tracker"
      subtitle="Track problems solved independently for LeetCode mastery and MAANG interview preparation with LeetCode number support."
      loadingMessage="Loading Personal DSA problems..."
    />
  );
};
