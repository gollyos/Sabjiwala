'use client';

import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  phrases: string[];
  typingSpeedMs?: number;
  deletingSpeedMs?: number;
  pauseMs?: number;
  className?: string;
}

// Cycles through `phrases`, typing and deleting one character at a time.
export function TypewriterText({
  phrases,
  typingSpeedMs = 60,
  deletingSpeedMs = 32,
  pauseMs = 1700,
  className = '',
}: TypewriterTextProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentPhrase = phrases[phraseIndex % phrases.length];

  useEffect(() => {
    if (!isDeleting && charCount === currentPhrase.length) {
      const pauseTimer = setTimeout(() => setIsDeleting(true), pauseMs);
      return () => clearTimeout(pauseTimer);
    }

    if (isDeleting && charCount === 0) {
      setIsDeleting(false);
      setPhraseIndex((i) => (i + 1) % phrases.length);
      return;
    }

    const step = setTimeout(() => {
      setCharCount((c) => c + (isDeleting ? -1 : 1));
    }, isDeleting ? deletingSpeedMs : typingSpeedMs);

    return () => clearTimeout(step);
  }, [charCount, isDeleting, currentPhrase, phrases.length, typingSpeedMs, deletingSpeedMs, pauseMs]);

  return (
    <span className={className}>
      <span aria-hidden="true">
        {currentPhrase.slice(0, charCount)}
        <span className="ml-0.5 inline-block h-[0.85em] w-[3px] translate-y-[0.1em] animate-pulse bg-current align-middle" />
      </span>
      <span className="sr-only">{phrases.join('. ')}</span>
    </span>
  );
}
