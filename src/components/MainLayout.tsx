'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import MarkdownBibleRenderer, { Citation } from './MarkdownBibleRenderer';
import MindOfChristGraph from './MindOfChristGraph';
import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';

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
    markedPageIds,
    toggleMarkPage,
    clearMarkedPages
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
    fetchSessions();
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
        }
      }
    } catch (e) {
      console.error("Error loading session:", e);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
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
      setSelectedChapter(1);
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

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <Link href="/">
            <h1>212G TARSUS</h1>
          </Link>
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
          <button
            className={`tab-btn ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            Mind Map
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
                    backgroundColor: 'var(--bg-light)',
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
              <div className="bible-selectors">
                <select
                  className="bible-select"
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
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
                  const isHighlighted = highlightedVerses && v.verse >= highlightedVerses.start && (!highlightedVerses.end || v.verse <= highlightedVerses.end);
                  return (
                    <div 
                      key={i}
                      id={`verse-${v.verse}`}
                      className="bible-verse-item"
                      style={isHighlighted ? { backgroundColor: '#f1f3f4', borderRadius: '4px', padding: '4px', margin: '-4px 0 4px 0' } : undefined}
                    >
                      <span className="bible-verse-num">{v.verse}</span>
                      {v.text}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'graph' && <MindOfChristGraph />}
        </div>
      </div>

      {/* Main Panel */}
      <div className="main-content">
        <div className="main-header">
          <h2>Tarsus Chat</h2>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/pages/about" className="nav-link">About</Link>
            <Link href="/pages/daniels_testimony" className="nav-link">Testimony</Link>
            <button 
              onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
              className="tab-btn" 
              style={{ 
                padding: '4px 10px', 
                fontSize: '0.85rem', 
                cursor: 'pointer', 
                borderBottom: 'none',
                background: 'var(--bg-light)',
                border: '1px solid var(--border)',
                borderRadius: '3px'
              }}
            >
              {isHistoryOpen ? 'Hide History' : 'History'}
            </button>
          </div>
        </div>

        <div className="chat-container">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            background: 'var(--bg-light)',
            borderBottom: '1px solid var(--border-light)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}>
            <span style={{ marginRight: '10px' }}>Context Memory:</span>
            <div style={{ flex: 1, background: '#e0e0e0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (Math.max(0, messages.length - 1) / 15) * 100)}%`,
                height: '100%',
                background: messages.length - 1 > 12 ? '#d32f2f' : (messages.length - 1 > 8 ? '#f57c00' : '#388e3c'),
                transition: 'width 0.3s'
              }} />
            </div>
            <span style={{ marginLeft: '10px', width: '50px', textAlign: 'right' }}>
              {Math.max(0, messages.length - 1)} / 15
            </span>
          </div>
          <div className="chat-history">
            {messages.map((msg, i) => {
              // Accumulate citations up to this message so follow-ups can reuse previous footnote numbers
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
              background: 'var(--bg-light)',
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
                  color: '#c00',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                Clear
              </button>
            </div>
          )}

          <form className="chat-input-form" onSubmit={handleSend}>
            <textarea
              className="chat-input"
              placeholder="Ask Tarsus about law vs grace, the 2Sons, cOLD vs LukeWarm..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isLoading}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputVal.trim() && !isLoading) {
                    handleSend(e as unknown as React.FormEvent);
                  }
                }
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
                  if (el.scrollHeight > 150) {
                    el.style.overflowY = 'auto';
                  } else {
                    el.style.overflowY = 'hidden';
                  }
                }
              }}
            />
            <button className="chat-send-btn" type="submit" disabled={isLoading}>
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Sidebar - Chat History */}
      {isHistoryOpen && (
        <div className="sidebar right-sidebar">
          <div className="sidebar-header" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', fontFamily: 'Times New Roman, serif', flex: 1 }}>History</h3>
            <button 
              className="chat-send-btn" 
              onClick={handleNewChat}
              style={{
                padding: '4px 8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                height: 'auto'
              }}
            >
              + New Chat
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsHistoryOpen(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.8rem',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center'
              }}
              title="Close History"
            >
              ×
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: '1rem', fontStyle: 'italic', color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>
                No saved chats.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sessions.map((s) => (
                  <li 
                    key={s.id} 
                    onClick={() => handleSelectSession(s.id)}
                    className="sidebar-tab-content"
                    style={{
                      padding: '8px 10px',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderRadius: '3px',
                      backgroundColor: currentSessionId === s.id ? 'var(--bg-light)' : 'transparent',
                      borderLeft: currentSessionId === s.id ? '3px solid var(--primary)' : '3px solid transparent',
                      transition: 'all 0.1s ease-in-out'
                    }}
                  >
                    <span 
                      style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap', 
                        flex: 1,
                        marginRight: '8px',
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
                        color: '#c00',
                        cursor: 'pointer',
                        padding: '0 4px',
                        fontSize: '1.1rem',
                        lineHeight: 1
                      }}
                      title="Delete chat"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
