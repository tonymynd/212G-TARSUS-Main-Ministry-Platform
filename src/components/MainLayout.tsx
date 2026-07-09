'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import MarkdownBibleRenderer, { Citation } from './MarkdownBibleRenderer';
import ThemeToggle from './ThemeToggle';
import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';
import { useWindowSize } from '@/hooks/useWindowSize';
import { getBookDisplayName, type BibleVersion } from '@/lib/bible-shared';


interface PageItem {
  id: string;
  title: string;
  group?: string;
}

interface MainLayoutProps {
  initialPages: PageItem[];
  initialBooks: string[];
}

export default function MainLayout({ initialPages, initialBooks }: MainLayoutProps) {
  return (
    <BibleNavigationProvider defaultBook={initialBooks[0] || 'Genesis'}>
      <MainLayoutContent initialPages={initialPages} initialBooks={initialBooks} />
    </BibleNavigationProvider>
  );
}

function MainLayoutContent({ initialPages, initialBooks }: MainLayoutProps) {
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
    toggleMarkPage,
    clearMarkedPages,
    bibleLanguage,
    setBibleLanguage,
    bibleVersion,
    setBibleVersion
  } = useBibleNavigation();

  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string; citations?: Record<string, Citation> }[]>([
    {
      role: 'bot',
      content: `**Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.**

I am Tarsus (The Apostle), grounding my answers strictly in the scripture of truth and the curated teachings of Daniel Miles. How can I assist you in dividing the word of truth today?

**The grace of our Lord Jesus Christ [be] with you all. Amen.**`
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Bible Explorer State
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

  // Chat History persistence state
  const [sessions, setSessions] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    // Open history by default only on wider screens to prevent mobile blocking
    if (typeof window !== 'undefined' && window.innerWidth > 850) {
      setIsHistoryOpen(true);
    }
  }, []);


  // Layout state
  const windowSize = useWindowSize();
  const isMobile = windowSize.width <= 760;
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(320);

  // Mobile drawer state (replaces carousel)
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  // Desktop resize handlers
  const resizeRef = useRef<{ side: 'left' | 'right'; startX: number; startLeft: number; startRight: number } | null>(null);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!resizeRef.current) return;
      const { side, startX, startLeft, startRight } = resizeRef.current;
      const dx = e.clientX - startX;
      if (side === 'left') {
        setLeftWidth(Math.max(160, Math.min(480, startLeft + dx)));
      } else {
        setRightWidth(Math.max(160, Math.min(480, startRight - dx)));
      }
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
    resizeRef.current = { side: 'left', startX: e.clientX, startLeft: leftWidth, startRight: rightWidth };
  };
  const startResizeRight = (e: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = { side: 'right', startX: e.clientX, startLeft: leftWidth, startRight: rightWidth };
  };

  const centerMin = 360;
  const dividerTotal = isHistoryOpen ? 16 : 8;
  const available = Math.max(0, windowSize.width - centerMin - dividerTotal);
  let clampedLeft = leftWidth;
  let clampedRight = isHistoryOpen ? rightWidth : 0;
  if (clampedLeft + clampedRight > available && (clampedLeft + clampedRight) > 0) {
    const scale = available / (clampedLeft + clampedRight);
    clampedLeft = Math.max(160, Math.floor(leftWidth * scale));
    if (isHistoryOpen) clampedRight = Math.max(160, Math.floor(rightWidth * scale));
  }

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error("Error fetching sessions:", e);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      await fetchSessions();
      const savedSessionId = sessionStorage.getItem('currentSessionId');
      if (savedSessionId) {
        try {
          const res = await fetch(`/api/sessions/${savedSessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session) {
              setCurrentSessionId(data.session.id);
              setMessages(data.session.messages);
            }
          }
        } catch (e) {
          console.error("Error restoring session:", e);
        }
      }
    };
    restoreSession();
  }, []);

  const saveCurrentSession = async (currentMessages: typeof messages, sessionId: string | null) => {
    const hasUserMsg = currentMessages.some(m => m.role === 'user');
    if (!hasUserMsg) return sessionId;

    const id = sessionId || `session_${Date.now()}`;
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, messages: currentMessages })
      });
      if (res.ok) {
        const data = await res.json();
        if (!sessionId) {
          setCurrentSessionId(id);
        }
        sessionStorage.setItem('currentSessionId', id);
        fetchSessions();
        return id;
      }
    } catch (e) {
      console.error("Error auto-saving session:", e);
    }
    return sessionId;
  };

  useEffect(() => {
    if (messages.length > 1) {
      saveCurrentSession(messages, currentSessionId);
    }
  }, [messages]);

  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setCurrentSessionId(data.session.id);
          setMessages(data.session.messages);
          sessionStorage.setItem('currentSessionId', data.session.id);
        }
      }
    } catch (e) {
      console.error("Error loading session:", e);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    sessionStorage.removeItem('currentSessionId');
    setMessages([
      {
        role: 'bot',
        content: `**Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.**

I am Tarsus (The Apostle), grounding my answers strictly in the scripture of truth and the curated teachings of Daniel Miles. How can I assist you in dividing the word of truth today?

**The grace of our Lord Jesus Christ [be] with you all. Amen.**`
      }
    ]);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentSessionId === id) {
          handleNewChat();
        }
        fetchSessions();
      }
    } catch (e) {
      console.error("Error deleting session:", e);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Bible chapters/verses when book or chapter changes
  useEffect(() => {
    const loadVerses = async () => {
      try {
        const res = await fetch(`/api/bible?book=${encodeURIComponent(selectedBook)}&chapter=${selectedChapter}&start=1&end=200&version=${bibleVersion}`);
        if (res.ok) {
          const data = await res.json();
          setVerses(data.verses || []);
        }
      } catch (err) {
        console.error("Error loading verses:", err);
      }
    };
    loadVerses();
  }, [selectedBook, selectedChapter, bibleVersion]);

  // Fetch available chapters when book changes (mocking a max chapter check, or fetch from api)
  useEffect(() => {
    // Basic book max chapters mapping
    const loadChapters = async () => {
      // Just fetch verse 1 of chapter 1..150 to check what chapters exist
      // In a real database, we can return the max chapter. To keep it simple, let's map standard book chapter lengths:
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userMsg = inputVal.trim();
    if (!userMsg) return;

    // Detect language of the user's message to update the default Bible Explorer version
    const spanishPatterns = /\b(el|la|los|las|un|una|del|con|para|por|como|que|gracia|ley|paz|esta|este|es|si|no|cómo|qué|por qué|quién|dónde|cuándo|cuál|quiénes)\b/i;
    const englishPatterns = /\b(the|and|of|in|to|for|is|it|that|with|this|what|how|why|who|where|when|which)\b/i;
    const spanishMatches = (userMsg.match(spanishPatterns) || []).length;
    const englishMatches = (userMsg.match(englishPatterns) || []).length;

    if (spanishMatches > englishMatches) {
      if (bibleLanguage !== 'es') {
        setBibleLanguage('es');
      }
    } else if (englishMatches > spanishMatches) {
      if (bibleLanguage !== 'en') {
        setBibleLanguage('en');
      }
    }

    setInputVal('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMsg }],
          markedPageIds
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'bot', content: data.text, citations: data.citations || {} }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', content: "Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.\n\nSeems there was a temporary error in our connection. Hmmm...\n\n**The grace of our Lord Jesus Christ [be] with you all. Amen.**" }]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: 'bot', content: "Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.\n\nSeems there was a network error. Hmmm...\n\n**The grace of our Lord Jesus Christ [be] with you all. Amen.**" }]);
    } finally {
      setIsLoading(false);
    }
  };


  const sourcesContent = (
    <>
      <div className="sidebar-header brand-row">
        <Link href="/">
          <h1 className="brand-text" style={{ margin: 0 }}>212G TARSUS</h1>
        </Link>
        <ThemeToggle />
      </div>

      {/* Nav links + controls moved here from chat header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap'
      }}>
        <Link href="/" className="nav-link" style={{ fontSize: '14px' }}>Home</Link>
        <Link href="/pages/about" className="nav-link" style={{ fontSize: '14px' }}>About</Link>
        <Link href="/pages/daniels_testimony" className="nav-link" style={{ fontSize: '14px' }}>Testimony</Link>
        <button
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          style={{
            marginLeft: 'auto',
            padding: '3px 10px',
            fontSize: '13px',
            cursor: 'pointer',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: 'var(--text-muted)',
            fontFamily: 'inherit'
          }}
        >
          {isHistoryOpen ? 'Hide History' : 'History ▶'}
        </button>
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
                        <Link href={`/pages/${p.id}`} className="page-item-link" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <div className="bible-selectors" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <select
                className="bible-select"
                value={bibleLanguage}
                onChange={(e) => setBibleLanguage(e.target.value as 'en' | 'es')}
                title="Language"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>

              <select
                className="bible-select"
                value={bibleVersion}
                onChange={(e) => setBibleVersion(e.target.value as BibleVersion)}
                title="Version"
              >
                {bibleLanguage === 'en' ? (
                  <option value="kjv">AKJV</option>
                ) : (
                  <>
                    <option value="rvg10">RVG-10</option>
                    <option value="rv1602p">RV1602P</option>
                  </>
                )}
              </select>
            </div>

            <div className="bible-selectors" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                    {getBookDisplayName(b, bibleLanguage)}
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
                    {bibleLanguage === 'es' ? `Cap ${ch}` : `Ch ${ch}`}
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

  const chatContent = (
    <>
      <div className="chat-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          fontSize: '15px',
          color: 'var(--text-muted)'
        }}>
          <span style={{ marginRight: '12px' }}>Context Memory:</span>
          <div style={{ flex: 1, background: '#e0e0e0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (Math.max(0, messages.length - 1) / 15) * 100)}%`,
              height: '100%',
              background: '#3fae5c',
              transition: 'width 0.3s'
            }} />
          </div>
          <span style={{ marginLeft: '12px', width: '50px', textAlign: 'right' }}>
            {Math.max(0, messages.length - 1)} / 15
          </span>
        </div>
        <div className="chat-history">
          {messages.map((msg, i) => {
            const accumulatedCitations = messages.slice(0, i + 1).reduce((acc, m) => ({...acc, ...(m.citations || {})}), {});
            return (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.role === 'bot' ? (
                    <MarkdownBibleRenderer text={msg.content} citations={accumulatedCitations} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="chat-message bot">
              <div style={{ fontStyle: 'italic', color: '#666' }}>Tarsus is writing...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {markedPageIds.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            background: 'var(--chat-bot-bg)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.85rem',
            fontFamily: 'Times New Roman, serif'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              <strong>Marked for operations ({markedPageIds.length}):</strong>{' '}
              {markedPageIds.map(id => {
                const pg = initialPages.find(p => p.id === id);
                return pg ? pg.title : id;
              }).join(', ')}
            </span>
            <button 
              onClick={clearMarkedPages}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              Clear
            </button>
          </div>
        )}

        <form className="chat-input-form" onSubmit={handleSend} style={{ display: 'flex', gap: '10px', padding: '12px 16px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
          <input
            type="text"
            className="chat-input"
            placeholder=""
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputVal.trim() && !isLoading) {
                handleSend(e as unknown as React.FormEvent);
              }
            }}
            style={{ height: '44px', resize: 'none', overflowY: 'hidden' }}
          />
          <button className="chat-send-btn" type="submit" disabled={isLoading} style={{ height: '44px', flexShrink: 0 }}>
            Send
          </button>
        </form>
      </div>
    </>
  );

  const historyContent = (
    <>
      <div className="sidebar-header" style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>History</h3>
        <button 
          className="chat-send-btn" 
          onClick={handleNewChat}
          style={{
            padding: '8px 14px',
            fontSize: '14px',
            background: 'var(--primary)',
            color: '#fff',
            cursor: 'pointer',
            height: 'auto'
          }}
        >
          + New Chat
        </button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {sessions.length === 0 ? (
          <div style={{ padding: '1rem', fontStyle: 'italic', color: '#666', fontSize: '15px', textAlign: 'center' }}>
            No saved chats.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sessions.map((s) => (
              <li 
                key={s.id} 
                onClick={() => handleSelectSession(s.id)}
                style={{
                  padding: '13px 20px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-light)',
                  backgroundColor: currentSessionId === s.id ? 'var(--chat-bot-bg)' : 'transparent',
                }}
              >
                <span 
                  style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap', 
                    flex: 1,
                    marginRight: '10px',
                    color: currentSessionId === s.id ? 'var(--primary)' : 'var(--text)',
                    fontWeight: currentSessionId === s.id ? 'bold' : 'normal'
                  }}
                  title={s.title}
                >
                  {s.title}
                </span>
                <button 
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  title="Delete chat"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <div className="app-container">
      {isMobile ? (
        <>
          {/* Mobile: Full-screen chat with slide-in drawers */}

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

          {/* History Drawer Overlay */}
          {mobileHistoryOpen && (
            <div
              className="mobile-drawer-backdrop"
              onClick={() => setMobileHistoryOpen(false)}
            />
          )}
          <div className={`mobile-drawer mobile-drawer-right ${mobileHistoryOpen ? 'open' : ''}`}>
            <div className="mobile-drawer-handle">
              <button
                className="mobile-drawer-close"
                onClick={() => setMobileHistoryOpen(false)}
                aria-label="Close History"
              >
                ✕
              </button>
            </div>
            {historyContent}
          </div>

          {/* Mobile top bar with drawer triggers */}
          <div className="mobile-topbar">
            <button
              className="mobile-topbar-btn"
              onClick={() => { setMobileSourcesOpen(true); setMobileHistoryOpen(false); }}
              aria-label="Open Sources"
            >
              ☰
            </button>
            <span className="mobile-topbar-title">Tarsus Chat</span>
            <button
              className="mobile-topbar-btn"
              onClick={() => { setMobileHistoryOpen(true); setMobileSourcesOpen(false); }}
              aria-label="Open History"
            >
              🕐
            </button>
          </div>

          {/* Full-screen chat */}
          <div className="mobile-chat-fullscreen">
            {chatContent}
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
            {chatContent}
          </div>
          {isHistoryOpen && (
            <>
              <div className="resize-divider" onPointerDown={startResizeRight}>
                <div className="resize-grip" />
              </div>
              <div className="right-pane-desktop" style={{ width: clampedRight, minWidth: 160, maxWidth: 480 }}>
                {historyContent}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
