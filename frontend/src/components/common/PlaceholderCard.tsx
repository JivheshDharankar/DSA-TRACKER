import React from 'react';
import styles from './PlaceholderCard.module.css';

interface PlaceholderCardProps {
  title: string;
  phase: string;
  description: string;
  icon: React.ReactNode;
  upcomingFeatures?: string[];
}

export const PlaceholderCard: React.FC<PlaceholderCardProps> = ({
  title,
  phase,
  description,
  icon,
  upcomingFeatures,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.glowOrb} />
      <div className={styles.iconWrapper}>{icon}</div>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.phaseBadge}>{phase}</div>
      <p className={styles.description}>{description}</p>

      {upcomingFeatures && upcomingFeatures.length > 0 && (
        <ul className={styles.featuresList}>
          {upcomingFeatures.map((feature, index) => (
            <li key={index} className={styles.featureItem}>
              <span className={styles.bullet} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
