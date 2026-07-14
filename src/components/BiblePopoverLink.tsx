'use client';

import React, { useState, useRef } from 'react';
import { useBibleNavigation } from '@/context/BibleContext';

interface BiblePopoverLinkProps {
  refText: string;
  book: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}

export const abbrevMap: Record<string, string> = {
  'gen': 'Genesis', 'gnesis': 'Genesis', 'gn': 'Genesis', 'ex': 'Exodus', 'exo': 'Exodus', 'xodo': 'Exodus', 'lev': 'Leviticus', 'levtico': 'Leviticus', 'lv': 'Leviticus', 'num': 'Numbers', 'nmeros': 'Numbers', 'nm': 'Numbers', 'deu': 'Deuteronomy', 'deut': 'Deuteronomy', 'deuteronomio': 'Deuteronomy',
  'jos': 'Joshua', 'josh': 'Joshua', 'josu': 'Joshua', 'jud': 'Judges', 'judg': 'Judges', 'jueces': 'Judges', 'jue': 'Judges', 'rut': 'Ruth', 'ruth': 'Ruth', 'rt': 'Ruth',
  '1sa': '1 Samuel', '1sam': '1 Samuel', '1s': '1 Samuel', '2sa': '2 Samuel', '2sam': '2 Samuel', '2s': '2 Samuel', '1ki': '1 Kings', '1kin': '1 Kings', '1reyes': '1 Kings', '1r': '1 Kings',
  '2ki': '2 Kings', '2kin': '2 Kings', '2reyes': '2 Kings', '2r': '2 Kings', '1ch': '1 Chronicles', '1chr': '1 Chronicles', '1crnicas': '1 Chronicles', '1cr': '1 Chronicles', '2ch': '2 Chronicles', '2chr': '2 Chronicles', '2crnicas': '2 Chronicles', '2cr': '2 Chronicles',
  'ezr': 'Ezra', 'esdras': 'Ezra', 'esd': 'Ezra', 'neh': 'Nehemiah', 'nehemas': 'Nehemiah', 'est': 'Esther', 'ester': 'Esther', 'esth': 'Esther', 'job': 'Job', 'ps': 'Psalms', 'psa': 'Psalms', 'salmos': 'Psalms', 'sal': 'Psalms', 'pro': 'Proverbs', 'prov': 'Proverbs', 'proverbios': 'Proverbs',
  'ecc': 'Ecclesiastes', 'eccl': 'Ecclesiastes', 'eclesiasts': 'Ecclesiastes', 'ecl': 'Ecclesiastes', 'son': 'Song of Solomon', 'song': 'Song of Solomon', 'cantares': 'Song of Solomon', 'ct': 'Song of Solomon', 'isa': 'Isaiah', 'isaas': 'Isaiah', 'jer': 'Jeremiah', 'jeremas': 'Jeremiah', 'jr': 'Jeremiah',
  'lam': 'Lamentations', 'lamentaciones': 'Lamentations', 'lm': 'Lamentations', 'eze': 'Ezekiel', 'ezek': 'Ezekiel', 'ezequiel': 'Ezekiel', 'dan': 'Daniel', 'hos': 'Hosea', 'oseas': 'Hosea', 'os': 'Hosea', 'joe': 'Joel', 'amo': 'Amos',
  'oba': 'Obadiah', 'abdas': 'Obadiah', 'abd': 'Obadiah', 'obad': 'Obadiah', 'jon': 'Jonah', 'jons': 'Jonah', 'mic': 'Micah', 'miqueas': 'Micah', 'nah': 'Nahum', 'hab': 'Habakkuk', 'habacuc': 'Habakkuk', 'zep': 'Zephaniah', 'zeph': 'Zephaniah', 'sofonas': 'Zephaniah', 'sof': 'Zephaniah',
  'hag': 'Haggai', 'hageo': 'Haggai', 'zec': 'Zechariah', 'zech': 'Zechariah', 'zacaras': 'Zechariah', 'zac': 'Zechariah', 'mal': 'Malachi', 'malaquas': 'Malachi',
  'mat': 'Matthew', 'matt': 'Matthew', 'mt': 'Matthew', 'mateo': 'Matthew', 'mar': 'Mark', 'mrk': 'Mark', 'mk': 'Mark', 'marcos': 'Mark', 'mc': 'Mark', 'luk': 'Luke', 'lk': 'Luke', 'lucas': 'Luke', 'lc': 'Luke',
  'joh': 'John', 'jn': 'John', 'juan': 'John', 'acts': 'Acts', 'act': 'Acts', 'ac': 'Acts', 'hechos': 'Acts', 'hch': 'Acts', 'rom': 'Romans', 'ro': 'Romans', 'romanos': 'Romans', '1co': '1 Corinthians', '1cor': '1 Corinthians', '1corintios': '1 Corinthians',
  '2co': '2 Corinthians', '2cor': '2 Corinthians', '2corintios': '2 Corinthians', 'gal': 'Galatians', 'glatas': 'Galatians', 'gl': 'Galatians', 'eph': 'Ephesians', 'ep': 'Ephesians', 'efesios': 'Ephesians', 'ef': 'Ephesians', 'phi': 'Philippians',
  'php': 'Philippians', 'ph': 'Philippians', 'filipenses': 'Philippians', 'flp': 'Philippians', 'phil': 'Philippians', 'col': 'Colossians', 'colosenses': 'Colossians', '1th': '1 Thessalonians', '1the': '1 Thessalonians', '1thess': '1 Thessalonians', '1tesalonicenses': '1 Thessalonians', '1ts': '1 Thessalonians',
  '2th': '2 Thessalonians', '2the': '2 Thessalonians', '2thess': '2 Thessalonians', '2tesalonicenses': '2 Thessalonians', '2ts': '2 Thessalonians', '1ti': '1 Timothy', '1tim': '1 Timothy', '1timoteo': '1 Timothy', '2ti': '2 Timothy', '2tim': '2 Timothy', '2timoteo': '2 Timothy',
  'tit': 'Titus', 'ti': 'Titus', 'tito': 'Titus', 'phm': 'Philemon', 'phile': 'Philemon', 'filemn': 'Philemon', 'flm': 'Philemon', 'heb': 'Hebrews', 'he': 'Hebrews', 'hebreos': 'Hebrews', 'jam': 'James', 'jas': 'James', 'santiago': 'James', 'stg': 'James',
  '1pe': '1 Peter', '1pet': '1 Peter', '1pedro': '1 Peter', '2pe': '2 Peter', '2pet': '2 Peter', '2pedro': '2 Peter', '1jo': '1 John', '1jon': '1 John', '1jn': '1 John', '1juan': '1 John',
  '2jo': '2 John', '2jon': '2 John', '2jn': '2 John', '2juan': '2 John', '3jo': '3 John', '3jon': '3 John', '3jn': '3 John', '3juan': '3 John', 'jde': 'Jude', 'judas': 'Jude',
  'rev': 'Revelation', 're': 'Revelation', 'apocalipsis': 'Revelation', 'ap': 'Revelation',
  // Starman's Two-Letter Abbreviations
  'am': 'Amos', 'cl': 'Colossians', 'da': 'Daniel', 'dt': 'Deuteronomy', 'ec': 'Ecclesiastes', 'er': 'Ezra', 'es': 'Esther', 'ez': 'Ezekiel', 
  'ga': 'Galatians', 'ge': 'Genesis', 'hb': 'Habakkuk', 'hg': 'Haggai', 'ho': 'Hosea', 'is': 'Isaiah', 'ja': 'James', 'jb': 'Job', 'jd': 'Jude', 
  'je': 'Jeremiah', 'jg': 'Judges', 'jl': 'Joel', 'jo': 'Jonah', 'js': 'Joshua', 'la': 'Lamentations', 'le': 'Leviticus', 'ma': 'Malachi', 'mi': 'Micah',
  'na': 'Nahum', 'ne': 'Nehemiah', 'nu': 'Numbers', 'ob': 'Obadiah', 'pm': 'Philemon', 'pr': 'Proverbs', 'ru': 'Ruth', 'so': 'Song of Solomon', 
  'ze': 'Zechariah', 'zp': 'Zephaniah'
};

export default function BiblePopoverLink({ refText, book, chapter, startVerse, endVerse }: BiblePopoverLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [verses, setVerses] = useState<any[]>([]);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { navigateToBible, bibleVersion } = useBibleNavigation();

  const versionLabels: Record<string, string> = {
    kjv: 'AKJV',
    rv1602p: 'RV1602P',
    rvg10: 'RVG-10',
  };

  const handleMouseEnter = async (e: React.MouseEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
    
    // Position popover
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      const estimatedHeight = 220; // estimate verse popover height
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Calculate screen-relative bounds
      let left = rect.left;
      let top = rect.bottom + 5; // default position below trigger
      
      // If it goes off the bottom of the viewport
      if (top + estimatedHeight > viewportHeight) {
        // Place above the trigger
        top = rect.top - estimatedHeight - 5;
      }
      
      // If it goes off the right side of the screen
      if (left + popoverWidth > viewportWidth) {
        left = viewportWidth - popoverWidth - 20;
      }
      
      // Prevent off-screen left
      if (left < 10) {
        left = 10;
      }
      
      setPopoverPos({ top, left });
    }

    if (verses.length > 0) return;

    try {
      const res = await fetch(`/api/bible?book=${encodeURIComponent(book)}&chapter=${chapter}${startVerse ? `&start=${startVerse}` : ''}${endVerse ? `&end=${endVerse}` : ''}&version=${bibleVersion}`);
      if (res.ok) {
        const data = await res.json();
        setVerses(data.verses || []);
      }
    } catch (err) {
      console.error("Error fetching verses:", err);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300); // 300ms delay to cross the gap
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const normalizedQueryBook = book.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mappedBook = abbrevMap[normalizedQueryBook] || book;
    navigateToBible(mappedBook, chapter, startVerse, endVerse);
  };

  return (
    <span>
      <span
        ref={triggerRef}
        className="bible-ref-link"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {refText}
      </span>

      {isOpen && (
        <div
          className="verse-popover"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 10000, // On top of panels
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="verse-popover-header">
            <span>{refText} ({versionLabels[bibleVersion] || 'AKJV'})</span>
          </div>
          <div className="verse-popover-text">
            {verses.length > 0 ? (
              verses.map((v, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <sup className="bible-verse-num">{v.verse}</sup> {v.text}
                </div>
              ))
            ) : (
              <div style={{ color: '#888' }}>Loading verses...</div>
            )}
          </div>
          <span className="verse-popover-footer">
            Powered by Tarsus Bible Reference
          </span>
        </div>
      )}
    </span>
  );
}
