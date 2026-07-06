'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import BibleRefRenderer from './BibleRefRenderer';

export interface Citation {
  title: string;
  link: string;
  snippet: string;
}

interface MarkdownBibleRendererProps {
  text: string;
  citations?: Record<string, Citation>;
}

// Citation superscript with hover popover
function CitationBadge({ num, citation }: { num: string; citation: Citation }) {
  const [visible, setVisible] = useState(false);

  let linkHref = citation.link;
  let isInternalCitation = false;
  
  // Rewrite godshew.org absolute URLs to local paths
  if (/^https?:\/\/(?:www\.)?godshew\.org/.test(linkHref)) {
    linkHref = linkHref.replace(/^https?:\/\/(?:www\.)?godshew\.org/, '');
    isInternalCitation = true;
  }
  
  // If it's already a relative path, it's internal
  if (linkHref.startsWith('/') || linkHref.startsWith('.')) {
    isInternalCitation = true;
  }

  if (isInternalCitation) {
    let targetSlug = linkHref;
    let hash = '';
    if (targetSlug.includes('#')) {
      const parts = targetSlug.split('#');
      targetSlug = parts[0];
      hash = '#' + parts.slice(1).join('#');
    }
    
    targetSlug = targetSlug.replace(/\.(md|htm|html)$/i, '').replace(/^\.\//, '');
    
    // If the link is already /pages/something, we don't want to double /pages/_pages_
    if (targetSlug.startsWith('/pages/')) {
      linkHref = targetSlug + hash;
    } else {
      const sanitizedSlug = targetSlug
        .toLowerCase()
        .replace(/[^a-z0-9_&]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      linkHref = `/pages/${sanitizedSlug}${hash}`;
    }
  }

  return (
    <span 
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <sup
        onTouchStart={() => setVisible(v => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '18px',
          height: '18px',
          padding: '0 4px',
          fontSize: '0.72rem',
          fontWeight: '600',
          color: visible ? 'var(--primary)' : '#5f6368',
          background: visible ? '#e8eaed' : '#f1f3f4',
          borderRadius: '9px',
          cursor: 'pointer',
          marginLeft: '-6px',
          marginRight: '2px',
          userSelect: 'none',
          transition: 'background 0.15s, color 0.15s',
          verticalAlign: 'super',
          textIndent: 0,
        }}
        title={citation.snippet}
      >
        {num}
      </sup>
      {visible && (
        <span
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '-10px',
            zIndex: 2000,
            width: '280px',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            marginBottom: '8px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'left',
            color: 'black'
          }}
        >
          <span
            style={{
              display: 'block',
              fontWeight: 'bold',
              color: 'var(--primary)',
              marginBottom: '0.4rem',
              borderBottom: '1px solid var(--border-light)',
              paddingBottom: '0.3rem',
              fontSize: '0.95rem',
            }}
          >
            📖 Source {num}
          </span>
          {citation.snippet && (
            <span
              style={{
                display: 'block',
                fontStyle: 'italic',
                color: '#444',
                marginBottom: '0.6rem',
              }}
            >
              "{citation.snippet}"
            </span>
          )}
          {isInternalCitation ? (
            <Link
              href={linkHref}
              style={{
                color: 'var(--accent)',
                textDecoration: 'underline',
                fontSize: '0.95rem',
                fontWeight: 500,
                pointerEvents: 'auto',
              }}
            >
              {citation.title} →
            </Link>
          ) : (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent)',
                textDecoration: 'underline',
                fontSize: '0.95rem',
                fontWeight: 500,
                pointerEvents: 'auto',
              }}
            >
              {citation.title} →
            </a>
          )}
        </span>
      )}
    </span>
  );
}

// Parses markdown links [text](url), [[wikilinks]], [^N] citations, and bible refs
function parseLinksAndBibleRefs(
  text: string,
  citations?: Record<string, Citation>
): React.ReactNode[] {
  const regex = /\s*\[\^(\d+)\]|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(((?:[^()]+|\([^()]*\))+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(
        <BibleRefRenderer key={`text-${lastIndex}`} text={text.substring(lastIndex, matchIndex)} />
      );
    }

    if (match[1]) {
      // It's a footnote reference [^N]
      const num = match[1];
      const citation = citations?.[num];
      if (citation) {
        parts.push(<CitationBadge key={`cite-${matchIndex}`} num={num} citation={citation} />);
      } else {
        // Fallback: render as plain superscript
        parts.push(
          <sup key={`sup-${matchIndex}`} style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>
            [{num}]
          </sup>
        );
      }
    } else if (match[2]) {
      // It's a wikilink [[Target|Alias]]
      const target = match[2];
      const alias = match[3] || target;
      const slug = target
        .toLowerCase()
        .replace(/[^a-z0-9_&]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      parts.push(
        <Link
          key={`wiki-${matchIndex}`}
          href={`/pages/${slug}`}
          style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 500 }}
        >
          {alias}
        </Link>
      );
    } else {
      // Standard markdown link [text](url)
      const label = match[4];
      let url = match[5];
      
      // Rewrite godshew.org absolute URLs to local paths
      url = url.replace(/^https?:\/\/(?:www\.)?godshew\.org/, '');
      
      const isInternal = url.startsWith('/') || url.startsWith('.') || (!url.includes('://') && !url.startsWith('mailto:'));
      
      if (isInternal) {
        let targetSlug = url;
        let hash = '';
        if (targetSlug.includes('#')) {
          const parts = targetSlug.split('#');
          targetSlug = parts[0];
          hash = '#' + parts.slice(1).join('#');
        }
        
        targetSlug = targetSlug.replace(/\.(md|htm|html)$/i, '').replace(/^\.\//, '');

        if (targetSlug) {
          const sanitizedSlug = targetSlug
            .toLowerCase()
            .replace(/[^a-z0-9_&]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
          url = `/pages/${sanitizedSlug}${hash}`;
        } else {
          url = hash;
        }

        parts.push(
          <Link
            key={`link-${matchIndex}`}
            href={url}
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            {label}
          </Link>
        );
      } else {
        const isLocalFile = url.startsWith('<file://') || url.startsWith('file://');
        
        parts.push(
          <a
            key={`link-${matchIndex}`}
            href={isLocalFile ? '#' : url}
            target={isLocalFile ? undefined : '_blank'}
            rel={isLocalFile ? undefined : 'noopener noreferrer'}
            style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={isLocalFile ? (e) => {
              e.preventDefault();
              let cleanUrl = url.replace(/^</, '').replace(/>$/, '');
              fetch(`/api/open-local?path=${encodeURIComponent(cleanUrl)}`).catch(err => console.error("Failed to open file", err));
            } : undefined}
          >
            {label}
          </a>
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <BibleRefRenderer key={`text-${lastIndex}`} text={text.substring(lastIndex)} />
    );
  }

  return parts;
}

export default function MarkdownBibleRenderer({ text, citations }: MarkdownBibleRendererProps) {
  const lines = text.split('\n');

  const renderedElements = lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={lineIdx} style={{ height: '0.8rem' }} />;
    }

    let ElementType: any = 'div';
    let cleanLine = trimmed;
    let style: React.CSSProperties = { marginBottom: '0.8rem', textIndent: '1rem', lineHeight: '1.7' };
    let headerId: string | undefined = undefined;

    // Headers
    if (trimmed.startsWith('# ')) {
      ElementType = 'h1';
      cleanLine = trimmed.substring(2);
      style = { fontSize: '1.8rem', marginTop: '1.5rem', marginBottom: '0.8rem', color: 'var(--primary)', textIndent: 0, fontWeight: 'bold' };
      headerId = cleanLine.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
    } else if (trimmed.startsWith('## ')) {
      ElementType = 'h2';
      cleanLine = trimmed.substring(3);
      style = { fontSize: '1.4rem', marginTop: '1.2rem', marginBottom: '0.6rem', color: 'var(--primary)', textIndent: 0, fontWeight: 'bold' };
      headerId = cleanLine.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
    } else if (trimmed.startsWith('### ')) {
      ElementType = 'h3';
      cleanLine = trimmed.substring(4);
      style = { fontSize: '1.2rem', marginTop: '1rem', marginBottom: '0.4rem', color: 'var(--primary)', textIndent: 0, fontWeight: 'bold' };
      headerId = cleanLine.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
    }
    // Blockquotes
    else if (trimmed.startsWith('>')) {
      ElementType = 'blockquote';
      cleanLine = trimmed.substring(1).trim();
      style = { borderLeft: '4px solid var(--primary)', paddingLeft: '1rem', fontStyle: 'italic', margin: '1.5rem 0', color: '#333', textIndent: 0 };
    }
    // Lists
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      ElementType = 'li';
      cleanLine = trimmed.substring(2);
      style = { marginLeft: '2rem', marginBottom: '0.4rem', listStyleType: 'disc', textIndent: 0 };
    }

    // Parse bold text: **text**
    const boldParts = cleanLine.split(/\*\*(.*?)\*\*/g);
    const contentNodes = boldParts.map((bPart, bIdx) => {
      const isBold = bIdx % 2 === 1;
      
      // Parse italics: *text*
      const italicParts = bPart.split(/\*(.*?)\*/g);
      const parsedItalics = italicParts.map((iPart, iIdx) => {
        const isItalic = iIdx % 2 === 1;
        const content = parseLinksAndBibleRefs(iPart, citations);
        
        if (isItalic) {
          return <em key={iIdx}>{content}</em>;
        }
        return <React.Fragment key={iIdx}>{content}</React.Fragment>;
      });

      if (isBold) {
        return <strong key={bIdx}>{parsedItalics}</strong>;
      }
      return <React.Fragment key={bIdx}>{parsedItalics}</React.Fragment>;
    });

    const props: any = { key: lineIdx, style };
    if (headerId) props.id = headerId;
    return React.createElement(ElementType, props, contentNodes);
  });

  return <div className="markdown-content">{renderedElements}</div>;
}
