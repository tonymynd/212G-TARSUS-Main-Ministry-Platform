'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { type BibleVersion } from '@/lib/bible-shared';

type TabType = 'pages' | 'bible' | 'graph';

interface BibleContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedBook: string;
  setSelectedBook: (book: string) => void;
  selectedChapter: number;
  setSelectedChapter: (chapter: number) => void;
  highlightedVerses: { start: number; end?: number } | null;
  setHighlightedVerses: (verses: { start: number; end?: number } | null) => void;
  navigateToBible: (book: string, chapter: number, startVerse?: number, endVerse?: number) => void;
  markedPageIds: string[];
  toggleMarkPage: (id: string) => void;
  clearMarkedPages: () => void;
  bibleLanguage: 'en' | 'es';
  setBibleLanguage: (lang: 'en' | 'es') => void;
  bibleVersion: BibleVersion;
  setBibleVersion: (version: BibleVersion) => void;
}

const BibleContext = createContext<BibleContextType | undefined>(undefined);

export function BibleNavigationProvider({
  children,
  defaultBook = 'Genesis'
}: {
  children: ReactNode;
  defaultBook?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabType>('pages');
  const [selectedBook, setSelectedBook] = useState<string>(defaultBook);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [highlightedVerses, setHighlightedVerses] = useState<{ start: number; end?: number } | null>(null);
  const [markedPageIds, setMarkedPageIds] = useState<string[]>([]);
  const [bibleLanguage, setBibleLanguageState] = useState<'en' | 'es'>('en');
  const [bibleVersion, setBibleVersionState] = useState<BibleVersion>('kjv');

  useEffect(() => {
    const savedLang = localStorage.getItem('tarsus-bible-language') as 'en' | 'es';
    const savedVer = localStorage.getItem('tarsus-bible-version') as BibleVersion;
    if (savedLang === 'en' || savedLang === 'es') {
      setBibleLanguageState(savedLang);
    }
    if (savedVer === 'kjv' || savedVer === 'rv1602p' || savedVer === 'rvg10') {
      setBibleVersionState(savedVer);
    }
  }, []);

  const setBibleLanguage = (lang: 'en' | 'es') => {
    setBibleLanguageState(lang);
    localStorage.setItem('tarsus-bible-language', lang);
    const defaultVer = lang === 'en' ? 'kjv' : 'rvg10';
    setBibleVersionState(defaultVer);
    localStorage.setItem('tarsus-bible-version', defaultVer);
  };

  const setBibleVersion = (version: BibleVersion) => {
    setBibleVersionState(version);
    localStorage.setItem('tarsus-bible-version', version);
    const lang = version === 'kjv' ? 'en' : 'es';
    setBibleLanguageState(lang);
    localStorage.setItem('tarsus-bible-language', lang);
  };

  const navigateToBible = (book: string, chapter: number, startVerse?: number, endVerse?: number) => {
    setSelectedBook(book);
    setSelectedChapter(chapter);
    if (startVerse) {
      setHighlightedVerses({ start: startVerse, end: endVerse });
    } else {
      setHighlightedVerses(null);
    }
    setActiveTab('bible');
  };

  const toggleMarkPage = (id: string) => {
    setMarkedPageIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearMarkedPages = () => {
    setMarkedPageIds([]);
  };

  return (
    <BibleContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedBook,
        setSelectedBook,
        selectedChapter,
        setSelectedChapter,
        highlightedVerses,
        setHighlightedVerses,
        navigateToBible,
        markedPageIds,
        toggleMarkPage,
        clearMarkedPages,
        bibleLanguage,
        setBibleLanguage,
        bibleVersion,
        setBibleVersion
      }}
    >
      {children}
    </BibleContext.Provider>
  );
}


export function useBibleNavigation() {
  const context = useContext(BibleContext);
  if (!context) {
    return {
      activeTab: 'pages' as TabType,
      setActiveTab: () => {},
      selectedBook: 'Genesis',
      setSelectedBook: () => {},
      selectedChapter: 1,
      setSelectedChapter: () => {},
      highlightedVerses: null,
      setHighlightedVerses: () => {},
      navigateToBible: () => {},
      markedPageIds: [] as string[],
      toggleMarkPage: () => {},
      clearMarkedPages: () => {},
      bibleLanguage: 'en' as const,
      setBibleLanguage: () => {},
      bibleVersion: 'kjv' as const,
      setBibleVersion: () => {}
    };
  }
  return context;
}

