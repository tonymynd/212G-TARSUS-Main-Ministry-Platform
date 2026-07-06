'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

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
        clearMarkedPages
      }}
    >
      {children}
    </BibleContext.Provider>
  );
}

export function useBibleNavigation() {
  const context = useContext(BibleContext);
  if (!context) {
    // Return a dummy context so it doesn't crash if rendered outside the provider (e.g. in some isolated view)
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
      clearMarkedPages: () => {}
    };
  }
  return context;
}

