import sys
import os

filepath = r'c:\STORAGE\M\Manifold-Grace\1-PROJECTS(Stove)\212G-TARSUS-Main-Ministry-Platform\src\components\MainLayout.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

imports_addition = "import { useWindowSize } from '@/hooks/useWindowSize';\n"
code = code.replace("import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';", 
                    "import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';\n" + imports_addition)

hooks_addition = """
  // Layout state
  const windowSize = useWindowSize();
  const isMobile = windowSize.width <= 760;
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(320);
  const [mobilePanel, setMobilePanel] = useState(1);
  const [dragPx, setDragPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const resizeRef = useRef<{ side: 'left' | 'right'; startX: number; startLeft: number; startRight: number } | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // Resize Handlers
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

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartRef.current === null) return;
    setDragPx(e.touches[0].clientX - touchStartRef.current);
  };
  const handleTouchEnd = () => {
    const threshold = (typeof window !== 'undefined' ? window.innerWidth : 400) * 0.18;
    let panel = mobilePanel;
    if (dragPx > threshold) panel = Math.max(0, panel - 1);
    else if (dragPx < -threshold) panel = Math.min(2, panel + 1);
    setMobilePanel(panel);
    setDragPx(0);
    setIsDragging(false);
    touchStartRef.current = null;
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
"""
code = code.replace("  const fetchSessions = async () => {", hooks_addition + "\n  const fetchSessions = async () => {")

# Now I'll replace the return block with the new layout logic.
# First, I'll extract everything before the `return (` statement.
import re

return_match = re.search(r'  return \(\s*<div className="app-container">', code)
if not return_match:
    print("Could not find return statement")
    sys.exit(1)

pre_return = code[:return_match.start()]

# Add variables for pane contents
pane_contents = """
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
      <div className="main-header">
        <h2>Tarsus Chat</h2>
        <div className="nav-links">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/pages/about" className="nav-link">About</Link>
          <Link href="/pages/daniels_testimony" className="nav-link">Testimony</Link>
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)} 
            className="tab-btn" 
            style={{ 
              padding: '4px 10px', 
              fontSize: '15px', 
              cursor: 'pointer', 
              borderBottom: 'none',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px'
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

        <form className="chat-input-form" onSubmit={handleSend} style={{ display: 'flex', gap: '12px', padding: '18px 24px', borderTop: '1px solid var(--border)' }}>
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
          <div className="mobile-tab-strip">
            <div className={`mobile-tab ${mobilePanel === 0 ? 'active' : ''}`} onClick={() => { setMobilePanel(0); setDragPx(0); }}>Sources</div>
            <div className={`mobile-tab ${mobilePanel === 1 ? 'active' : ''}`} onClick={() => { setMobilePanel(1); setDragPx(0); }}>Chat</div>
            <div className={`mobile-tab ${mobilePanel === 2 ? 'active' : ''}`} onClick={() => { setMobilePanel(2); setDragPx(0); }}>History</div>
          </div>
          <div 
            className="mobile-track-wrap"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="mobile-track" 
              style={{
                transform: `translateX(calc(${-mobilePanel * 33.3333}% + ${dragPx}px))`,
                transition: isDragging ? 'none' : 'transform 0.28s ease'
              }}
            >
              <div className="mobile-panel">{sourcesContent}</div>
              <div className="mobile-panel">{chatContent}</div>
              <div className="mobile-panel">{historyContent}</div>
            </div>
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
"""

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(pre_return + pane_contents)
