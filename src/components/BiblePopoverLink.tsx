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

export default function BiblePopoverLink({ refText, book, chapter, startVerse, endVerse }: BiblePopoverLinkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [verses, setVerses] = useState<any[]>([]);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const { navigateToBible } = useBibleNavigation();

  const handleMouseEnter = async (e: React.MouseEvent) => {
    setIsOpen(true);
    
    // Position popover
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      setPopoverPos({
        top: rect.bottom + scrollY + 5,
        left: rect.left + scrollX
      });
    }

    try {
      const res = await fetch(`/api/bible?book=${encodeURIComponent(book)}&chapter=${chapter}${startVerse ? `&start=${startVerse}` : ''}${endVerse ? `&end=${endVerse}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setVerses(data.verses || []);
      }
    } catch (err) {
      console.error("Error fetching verses:", err);
    }
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateToBible(book, chapter, startVerse, endVerse);
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
            top: popoverPos.top,
            left: popoverPos.left,
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="verse-popover-header">
            <span>{refText} (KJV)</span>
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
