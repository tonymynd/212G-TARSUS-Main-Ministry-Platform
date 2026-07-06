'use client';

import React from 'react';
import BiblePopoverLink from './BiblePopoverLink';

interface BibleRefRendererProps {
  text: string;
}

export default function BibleRefRenderer({ text }: BibleRefRendererProps) {
  // Group 1: Book name, Group 2: Chapter, Group 3: Start Verse (optional), Group 4: End Verse (optional)
  const regex = /(?<=^|[\s(\[;:,&"'\-\/\\])((?:[1-3]\s*)?[A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ.]+(?:\s+[a-záéíóúñ+]+)?(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s+(\d+)(?::(\d+)(?:-(\d+))?)?(?=$|[\s.,!?)\];:"'\-\/\\])/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Clone text to parse
  const cleanText = text;

  while ((match = regex.exec(cleanText)) !== null) {
    const matchIndex = match.index;
    
    // Add text before match
    if (matchIndex > lastIndex) {
      parts.push(cleanText.substring(lastIndex, matchIndex));
    }

    let fullMatchText = match[0];
    const book = match[1];
    const chapter = parseInt(match[2], 10);
    const startVerse = match[3] ? parseInt(match[3], 10) : undefined;
    const endVerse = match[4] ? parseInt(match[4], 10) : undefined;
    
    let prefix = '';
    let suffix = '';
    
    // Extract any leading whitespace (e.g. regular space, non-breaking space, etc)
    const leadingWhitespaceMatch = fullMatchText.match(/^\s+/);
    if (leadingWhitespaceMatch) {
      prefix = leadingWhitespaceMatch[0];
      fullMatchText = fullMatchText.substring(prefix.length);
    }
    
    // Extract any trailing whitespace
    const trailingWhitespaceMatch = fullMatchText.match(/\s+$/);
    if (trailingWhitespaceMatch) {
      suffix = trailingWhitespaceMatch[0];
      fullMatchText = fullMatchText.substring(0, fullMatchText.length - suffix.length);
    }

    if (prefix) {
      parts.push(prefix);
    }

    parts.push(
      <BiblePopoverLink
        key={matchIndex}
        refText={fullMatchText}
        book={book}
        chapter={chapter}
        startVerse={startVerse}
        endVerse={endVerse}
      />
    );

    if (suffix) {
      parts.push(suffix);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanText.length) {
    parts.push(cleanText.substring(lastIndex));
  }

  return <>{parts}</>;
}
