import React from 'react';
import { TrackerPage } from '../components/problems/TrackerPage';

export const CollegeDsaPage: React.FC = () => {
  return (
    <TrackerPage
      section="COLLEGE"
      title="College DSA Tracker"
      subtitle="Track problems learned across lectures, assignments, labs, and semester exams with isolated S.No sequencing."
      loadingMessage="Loading College DSA problems..."
    />
  );
};
