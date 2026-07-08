import sys
import os
import re

filepath = r'c:\STORAGE\M\Manifold-Grace\1-PROJECTS(Stove)\212G-TARSUS-Main-Ministry-Platform\src\components\MainLayoutPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

imports_addition = "import { useWindowSize } from '@/hooks/useWindowSize';\nimport { useRef } from 'react';\n"
code = code.replace("import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';", 
                    "import { BibleNavigationProvider, useBibleNavigation } from '@/context/BibleContext';\n" + imports_addition)

hooks_addition = """
  // Layout state
  const windowSize = useWindowSize();
  const isMobile = windowSize.width <= 760;
  const [leftWidth, setLeftWidth] = useState(300);
  const [mobilePanel, setMobilePanel] = useState(1);
  const [dragPx, setDragPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const resizeRef = useRef<{ startX: number; startLeft: number } | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // Resize Handlers
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
    const threshold = (typeof window !== 'undefined' ? window.innerWidth : 400) * 18 / 100;
    let panel = mobilePanel;
    if (dragPx > threshold) panel = Math.max(0, panel - 1);
    else if (dragPx < -threshold) panel = Math.min(1, panel + 1);
    setMobilePanel(panel);
    setDragPx(0);
    setIsDragging(false);
    touchStartRef.current = null;
  };

  const centerMin = 360;
  const dividerTotal = 8;
  const available = Math.max(0, windowSize.width - centerMin - dividerTotal);
  let clampedLeft = leftWidth;
  if (clampedLeft > available && clampedLeft > 0) {
    clampedLeft = Math.max(160, available);
  }
"""

code = code.replace("  const visiblePages = useMemo(() => {", hooks_addition + "\n  const visiblePages = useMemo(() => {")


return_match = re.search(r'  return \(\s*<div className="app-container">', code)
if not return_match:
    print("Could not find return statement")
    sys.exit(1)

pre_return = code[:return_match.start()]

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
          <div className="mobile-tab-strip">
            <div className={`mobile-tab ${mobilePanel === 0 ? 'active' : ''}`} onClick={() => { setMobilePanel(0); setDragPx(0); }}>Sources</div>
            <div className={`mobile-tab ${mobilePanel === 1 ? 'active' : ''}`} onClick={() => { setMobilePanel(1); setDragPx(0); }}>Study</div>
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
                width: '200%',
                transform: `translateX(calc(${-mobilePanel * 50}% + ${dragPx}px))`,
                transition: isDragging ? 'none' : 'transform 0.28s ease'
              }}
            >
              <div className="mobile-panel" style={{ width: '50%' }}>{sourcesContent}</div>
              <div className="mobile-panel" style={{ width: '50%' }}>{studyContent}</div>
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
            {studyContent}
          </div>
        </div>
      )}
    </div>
  );
}
"""

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(pre_return + pane_contents)
