'use client';

import React from 'react';
import BiblePopoverLink, { abbrevMap } from './BiblePopoverLink';
import { useBibleNavigation } from '@/context/BibleContext';

interface BibleRefRendererProps {
  text: string;
}

const standardThreeLetterMap: Record<string, string> = {
  'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
  'Joshua': 'Jos', 'Judges': 'Jud', 'Ruth': 'Rut', '1 Samuel': '1Sa', '2 Samuel': '2Sa',
  '1 Kings': '1Ki', '2 Kings': '2Ki', '1 Chronicles': '1Ch', '2 Chronicles': '2Ch',
  'Ezra': 'Ezr', 'Nehemiah': 'Neh', 'Esther': 'Est', 'Job': 'Job', 'Psalms': 'Psa',
  'Proverbs': 'Pro', 'Ecclesiastes': 'Ecc', 'Song of Solomon': 'Sng', 'Isaiah': 'Isa',
  'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Eze', 'Daniel': 'Dan',
  'Hosea': 'Hos', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Oba', 'Jonah': 'Jon',
  'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zep', 'Haggai': 'Hag',
  'Zechariah': 'Zec', 'Malachi': 'Mal',
  'Matthew': 'Mat', 'Mark': 'Mar', 'Luke': 'Luk', 'John': 'Joh', 'Acts': 'Act',
  'Romans': 'Rom', '1 Corinthians': '1Co', '2 Corinthians': '2Co', 'Galatians': 'Gal',
  'Ephesians': 'Eph', 'Philippians': 'Php', 'Colossians': 'Col', '1 Thessalonians': '1Th',
  '2 Thessalonians': '2Th', '1 Timothy': '1Ti', '2 Timothy': '2Ti', 'Titus': 'Tit',
  'Philemon': 'Phm', 'Hebrews': 'Heb', 'James': 'Jam', '1 Peter': '1Pe', '2 Peter': '2Pe',
  '1 John': '1Jo', '2 John': '2Jo', '3 John': '3Jo', 'Jude': 'Jde', 'Revelation': 'Rev'
};

const spanishThreeLetterMap: Record<string, string> = {
  'Genesis': 'Gen', 'Exodus': 'Éxo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
  'Joshua': 'Jos', 'Judges': 'Jue', 'Ruth': 'Rut', '1 Samuel': '1Sa', '2 Samuel': '2Sa',
  '1 Kings': '1Re', '2 Kings': '2Re', '1 Chronicles': '1Cr', '2 Chronicles': '2Cr',
  'Ezra': 'Esd', 'Nehemiah': 'Neh', 'Esther': 'Est', 'Job': 'Job', 'Psalms': 'Sal',
  'Proverbs': 'Pro', 'Ecclesiastes': 'Ecl', 'Song of Solomon': 'Can', 'Isaiah': 'Isa',
  'Jeremiah': 'Jer', 'Lamentations': 'Lam', 'Ezekiel': 'Eze', 'Daniel': 'Dan',
  'Hosea': 'Ose', 'Joel': 'Joe', 'Amos': 'Amo', 'Obadiah': 'Abd', 'Jonah': 'Jon',
  'Micah': 'Miq', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Sof', 'Haggai': 'Hag',
  'Zechariah': 'Zac', 'Malachi': 'Mal',
  'Matthew': 'Mat', 'Mark': 'Mar', 'Luke': 'Luc', 'John': 'Jn', 'Acts': 'Hch',
  'Romans': 'Rom', '1 Corinthians': '1Co', '2 Corinthians': '2Co', 'Galatians': 'Gál',
  'Ephesians': 'Efe', 'Philippians': 'Fil', 'Colossians': 'Col', '1 Thessalonians': '1Te',
  '2 Thessalonians': '2Te', '1 Timothy': '1Ti', '2 Timothy': '2Ti', 'Titus': 'Tit',
  'Philemon': 'Flm', 'Hebrews': 'Heb', 'James': 'Stg', '1 Peter': '1Pe', '2 Peter': '2Pe',
  '1 John': '1Jn', '2 John': '2Jn', '3 John': '3Jn', 'Jude': 'Jud', 'Revelation': 'Apo'
};

export default function BibleRefRenderer({ text }: BibleRefRendererProps) {
  const { bibleVersion } = useBibleNavigation();
  const isSpanish = bibleVersion === 'rv1602p' || bibleVersion === 'rvg10';
  const abbrevMapToUse = isSpanish ? spanishThreeLetterMap : standardThreeLetterMap;

  // Group 1: Book name, Group 2: Chapter, Group 3: Start Verse (optional), Group 4: End Verse (optional), Group 5: End Chapter (optional)
  const regex = /(?<=^|[\s(\[;:,&"'\-\/\\])((?:[1-3]\s*)?[A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ.]+(?:\s+[a-záéíóúñ+]+)?(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s+(\d+)(?::(\d+)(?:-(\d+))?|-(\d+))?(?=$|[\s.,!?)\];:"'\-\/\\])/g;

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

    // Split check for patterns like "Jesús en Mateo" -> "Jesús en " + "Mateo"
    let cleanBook = book;
    const splitMatch = book.match(/(.+)\s+(en|in|of|de)\s+([1-3]?\s*[A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i);
    if (splitMatch) {
      const leftPart = splitMatch[1];
      const connector = splitMatch[2];
      const rightPart = splitMatch[3];
      const normalizedRight = rightPart.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (abbrevMap[normalizedRight]) {
        parts.push(leftPart + " " + connector + " ");
        cleanBook = rightPart;
      }
    }

    const normalizedQueryBook = cleanBook.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalBook = abbrevMap[normalizedQueryBook];

    if (!canonicalBook) {
      // If it's not a valid Bible book name, render the match as plain text and skip popover
      if (splitMatch) {
        const rightPartAndRest = fullMatchText.substring(book.length - cleanBook.length);
        parts.push(rightPartAndRest);
      } else {
        parts.push(fullMatchText);
      }
      if (suffix) {
        parts.push(suffix);
      }
      lastIndex = regex.lastIndex;
      continue;
    }

    // Always format displayed reference to standard three letter abbreviation format
    const abbrevBook = abbrevMapToUse[canonicalBook] || canonicalBook;
    let formattedRefText = abbrevBook + " " + chapter;
    if (startVerse !== undefined) {
      formattedRefText += ":" + startVerse;
      if (endVerse !== undefined) {
        formattedRefText += "-" + endVerse;
      }
    }

    parts.push(
      <BiblePopoverLink
        key={matchIndex}
        refText={formattedRefText}
        book={cleanBook}
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
