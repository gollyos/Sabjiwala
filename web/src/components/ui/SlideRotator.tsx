'use client';

import { useEffect, useState } from 'react';

interface SlideRotatorProps {
  phrases: string[];
  intervalMs?: number;
  className?: string;
}

// Cycles through `phrases`, sliding each one up into view on an interval.
export function SlideRotator({ phrases, intervalMs = 2600, className = '' }: SlideRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [phrases.length, intervalMs]);

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <span key={index} className="block animate-hero-slide-in">
        {phrases[index]}
      </span>
      <span className="sr-only">{phrases.join('. ')}</span>
    </span>
  );
}
