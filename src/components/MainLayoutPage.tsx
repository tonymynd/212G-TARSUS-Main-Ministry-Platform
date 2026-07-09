'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import MarkdownBibleRenderer from './MarkdownBibleRenderer';
import ThemeToggle from './ThemeToggle';
import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useRef } from 'react';


interface PageItem {
  id: string;
  title: string;
  group?: string;
}

interface MainLayoutPageProps {
  initialPages: PageItem[];
  initialBooks: string[];
  pageId: string;
  pageTitle: string;
  pageContent: string;
}

export default function MainLayoutPage({
  initialPages,
  initialBooks,
  pageId,
  pageTitle,
  pageContent,
}: MainLayoutPageProps) {
  return (
    <BibleNavigationProvider defaultBook={initialBooks[0] || 'Genesis'}>
      <MainLayoutPageContent
        initialPages={initialPages}
        initialBooks={initialBooks}
        pageId={pageId}
        pageTitle={pageTitle}
        pageContent={pageContent}
      />
    </BibleNavigationProvider>
  );
}

function MainLayoutPageContent({
  initialPages,
  initialBooks,
  pageId,
  pageTitle,
  pageContent,
}: MainLayoutPageProps) {
  const {
    activeTab,
    setActiveTab,
    selectedBook,
    setSelectedBook,
    selectedChapter,
    setSelectedChapter,
    highlightedVerses,
    setHighlightedVerses,
    markedPageIds,
    toggleMarkPage
  } = useBibleNavigation();

  const [availableChapters, setAvailableChapters] = useState<number[]>([1]);
  const [verses, setVerses] = useState<any[]>([]);

  // Search and Pagination for Studies
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [visiblePageCount, setVisiblePageCount] = useState(100);

  const filteredPages = useMemo(() => {
    if (!pageSearchQuery) return initialPages;
    const q = pageSearchQuery.toLowerCase();
    return initialPages.filter(p => p.title.toLowerCase().includes(q));
  }, [initialPages, pageSearchQuery]);


  // Layout state
  const windowSize = useWindowSize();
  const isMobile = windowSize.width <= 760;
  const [leftWidth, setLeftWidth] = useState(300);
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false);
  const resizeRef = useRef<{ startX: number; startLeft: number } | null>(null);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!resizeRef.current) return;
      const { startX, startLeft } = resizeRef.current;
      const dx = e.clientX - startX;
      setLeftWidth(Math.max(160, Math.min(480, startLeft + dx)));
    };
    const handleUp = () => { resizeRef.current = null; };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, []);

  const startResizeLeft = (e: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = { startX: e.clientX, startLeft: leftWidth };
  };

  const centerMin = 360;
  const dividerTotal = 8;
  const available = Math.max(0, windowSize.width - centerMin - dividerTotal);
  let clampedLeft = leftWidth;
  if (clampedLeft > available && clampedLeft > 0) {
    clampedLeft = Math.max(160, available);
  }

  const visiblePages = useMemo(() => {
    return filteredPages.slice(0, visiblePageCount);
  }, [filteredPages, visiblePageCount]);

  // Load Bible chapters/verses when book or chapter changes
  useEffect(() => {
    const loadVerses = async () => {
      try {
        const res = await fetch(`/api/bible?book=${encodeURIComponent(selectedBook)}&chapter=${selectedChapter}&start=1&end=200`);
        if (res.ok) {
          const data = await res.json();
          setVerses(data.verses || []);
        }
      } catch (err) {
        console.error("Error loading verses:", err);
      }
    };
    loadVerses();
  }, [selectedBook, selectedChapter]);

  // Fetch available chapters when book changes
  useEffect(() => {
    const loadChapters = async () => {
      const maxChapters: Record<string, number> = {
        'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
        'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28, 'Romans': 16,
        '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6, 'Ephesians': 6,
        'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
        '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1, 'Hebrews': 13,
        'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1,
        'Jude': 1, 'Revelation': 22
      };
      const maxCh = maxChapters[selectedBook] || 10;
      const chapters = Array.from({ length: maxCh }, (_, i) => i + 1);
      setAvailableChapters(chapters);
    };
    loadChapters();
  }, [selectedBook]);

  // Scroll to highlighted verse
  useEffect(() => {
    if (activeTab === 'bible' && highlightedVerses) {
      setTimeout(() => {
        const el = document.getElementById(`verse-${highlightedVerses.start}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [activeTab, highlightedVerses, verses]);


  const sourcesContent = (
    <>
      <div className="sidebar-header brand-row">
        <Link href="/">
          <h1 className="brand-text" style={{ margin: 0 }}>212G TARSUS</h1>
        </Link>
        <ThemeToggle />
      </div>

      <div className="sidebar-tabs">
        <button
          className={`tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pages')}
        >
          Studies
        </button>
        <button
          className={`tab-btn ${activeTab === 'bible' ? 'active' : ''}`}
          onClick={() => setActiveTab('bible')}
        >
          Bible
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'pages' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ paddingBottom: '10px' }}>
              <input
                type="text"
                placeholder="Filter studies..."
                value={pageSearchQuery}
                onChange={(e) => {
                  setPageSearchQuery(e.target.value);
                  setVisiblePageCount(100);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--chat-input-bg)',
                  color: 'var(--text)',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <ul className="page-list" style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', flex: 1 }}>
              {Object.entries(
                filteredPages.reduce((acc, p) => {
                  const group = p.group || 'Other Studies';
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(p);
                  return acc;
                }, {} as Record<string, PageItem[]>)
              ).map(([group, pages]) => (
                <details key={group} open={pageSearchQuery.length > 0} style={{ marginBottom: '12px' }}>
                  <summary style={{ 
                    cursor: 'pointer', 
                    fontWeight: 600, 
                    padding: '6px', 
                    backgroundColor: 'rgba(0,0,0,0.03)', 
                    borderRadius: '4px', 
                    marginBottom: '6px',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)'
                  }}>
                    {group} ({pages.length})
                  </summary>
                  <ul style={{ listStyle: 'none', paddingLeft: '10px', margin: 0 }}>
                    {pages.slice(0, visiblePageCount).map((p) => (
                      <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={markedPageIds.includes(p.id)}
                          onChange={() => toggleMarkPage(p.id)}
                          style={{ cursor: 'pointer', margin: 0, flexShrink: 0 }}
                          title="Mark study for chat operations"
                        />
                        <Link
                          href={`/pages/${p.id}`}
                          className={`page-item-link ${p.id === pageId ? 'active' : ''}`}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {pages.length > visiblePageCount && (
                    <div style={{ paddingLeft: '10px', marginTop: '4px', marginBottom: '8px' }}>
                      <button 
                        onClick={() => setVisiblePageCount(prev => prev + 100)}
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--accent)',
                          fontSize: '0.85rem'
                        }}
                      >
                        + Show {pages.length - visiblePageCount} more in this group...
                      </button>
                    </div>
                  )}
                </details>
              ))}
              {filteredPages.length === 0 && (
                <li style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '10px' }}>
                  No studies found.
                </li>
              )}
            </ul>
          </div>
        )}

        {activeTab === 'bible' && (
          <div className="bible-explorer">
            <div className="bible-selectors">
              <select
                className="bible-select"
                value={selectedBook}
                onChange={(e) => {
                  setSelectedBook(e.target.value);
                  setSelectedChapter(1);
                }}
              >
                {initialBooks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                className="bible-chapter-select"
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(parseInt(e.target.value, 10))}
              >
                {availableChapters.map((ch) => (
                  <option key={ch} value={ch}>
                    Ch {ch}
                  </option>
                ))}
              </select>
            </div>

            <div className="bible-verses-list">
              {verses.map((v, i) => {
                const isHighlighted = highlightedVerses && v.verse >= highlightedVerses.start && v.verse <= (highlightedVerses.end || highlightedVerses.start);
                return (
                  <div 
                    key={i}
                    id={`verse-${v.verse}`}
                    className="bible-verse-item"
                    onClick={() => setHighlightedVerses({ start: v.verse, end: v.verse })}
                    style={{
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      ...(isHighlighted ? { backgroundColor: '#e2e8f0', borderRadius: '4px', padding: '4px', margin: '-4px 0 4px 0', borderLeft: '3px solid #64748b' } : {})
                    }}
                  >
                    <span className="bible-verse-num" style={isHighlighted ? { fontWeight: 'bold', color: '#334155' } : {}}>{v.verse}</span>
                    {v.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );

  const studyContent = (
    <>
      <div className="main-header">
        <h2>Study Viewer</h2>
        <div className="nav-links">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/pages/about" className="nav-link">About</Link>
          <Link href="/pages/daniels_testimony" className="nav-link">Testimony</Link>
        </div>
      </div>

      <div className="study-viewer">
        <h1 className="study-title">{pageTitle}</h1>
        <div className="study-content">
          <MarkdownBibleRenderer text={pageContent} />
        </div>
      </div>
    </>
  );

  return (
    <div className="app-container">
      {isMobile ? (
        <>
          {/* Sources Drawer Overlay */}
          {mobileSourcesOpen && (
            <div
              className="mobile-drawer-backdrop"
              onClick={() => setMobileSourcesOpen(false)}
            />
          )}
          <div className={`mobile-drawer mobile-drawer-left ${mobileSourcesOpen ? 'open' : ''}`}>
            <div className="mobile-drawer-handle">
              <button
                className="mobile-drawer-close"
                onClick={() => setMobileSourcesOpen(false)}
                aria-label="Close Sources"
              >
                ✕
              </button>
            </div>
            {sourcesContent}
          </div>

          {/* Mobile top bar */}
          <div className="mobile-topbar">
            <button
              className="mobile-topbar-btn"
              onClick={() => setMobileSourcesOpen(true)}
              aria-label="Open Sources"
            >
              ☰
            </button>
            <span className="mobile-topbar-title">Study Viewer</span>
            <Link href="/" className="mobile-topbar-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>← Chat</Link>
          </div>

          {/* Full-screen study content */}
          <div className="mobile-chat-fullscreen">
            {studyContent}
          </div>
        </>
      ) : (
        <div className="desktop-row">
          <div className="left-pane-desktop" style={{ width: clampedLeft, minWidth: 160, maxWidth: 480 }}>
            {sourcesContent}
          </div>
          <div className="resize-divider" onPointerDown={startResizeLeft}>
            <div className="resize-grip" />
          </div>
          <div className="center-pane" style={{ flex: `1 0 ${centerMin}px`, minWidth: centerMin }}>
            {studyContent}
          </div>
        </div>
      )}
    </div>
  );
}
