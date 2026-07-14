import { getPageData } from './pages';

export function validateResponse(
  text: string,
  isSpanish: boolean,
  references: { title: string; link: string }[]
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];

  // Extract thinking process block if present (to validate the clean body)
  let cleanText = text;
  const thinkingMatch = text.match(/^((?:>.*\n?)+)/m);
  if (thinkingMatch && thinkingMatch.index !== undefined) {
    const blockEnd = thinkingMatch.index + thinkingMatch[0].length;
    cleanText = text.substring(blockEnd).trim();
  }

  // R3: Arrow check
  if (!cleanText.includes('→') && !cleanText.includes('←')) {
    violations.push('Response must contain at least one arrow-based contrast line (← or →)');
  }

  // R4: Wordplay check
  const cleanLower = cleanText.toLowerCase();
  const wordplayTerms = [
    'f-laws', 'ear what', 'lukewarm', '2sons', '2voices', '2covenants', 'cold', 'innerstand', 'innerstood', 'lawful-awful'
  ];
  let matchedWordplays = 0;
  for (const wp of wordplayTerms) {
    if (wp === 'cold') {
      if (/\bcold\b/i.test(cleanLower) || /\bcold\b/i.test(cleanText)) matchedWordplays++;
    } else if (wp === 'ear what') {
      if (cleanLower.includes('ear what')) matchedWordplays++;
    } else {
      if (cleanLower.includes(wp)) matchedWordplays++;
    }
  }
  if (matchedWordplays < 2) {
    violations.push('Response must contain at least two signature wordplay terms (e.g. f-laws, ear what, LukeWarm, 2Sons, 2Voices, cOLD, innerstand, innerstood, lawful-awful)');
  }

  // R5: Banned words and phrases
  const bannedPhrases = [
    'i think', 'i feel', 'i believe', 'in my opinion', 'in my view',
    'it seems to me', "i'm not sure, but", "i'm not certain, but",
    "i'm not an expert, but", "i'm not a theologian, but", "i'm not a scholar, but"
  ];
  for (const phrase of bannedPhrases) {
    if (cleanLower.includes(phrase)) {
      violations.push(`Banned phrase found: "${phrase}"`);
    }
  }
  if (!isSpanish) {
    if (/\bunderstand\b/i.test(cleanLower) || /\bunderstanding\b/i.test(cleanLower)) {
      violations.push('The words "understand" or "understanding" are banned. Use "innerstand" or "innerstanding" instead.');
    }
  }

  // R10: Doctrinal "under" violation
  if (cleanLower.includes('under grace') || cleanLower.includes('bajo la gracia')) {
    violations.push('Believers must never be placed "under grace" or "bajo la gracia". Use "with grace" or "in Christ" instead.');
  }

  // Footnote formatting and validation
  // Extract footnotes from the response text
  const citationRegex = /^\[\^(\d+)\]:\s*\[([^\]]+)\]\(([^)]+)\)\s*"([^"]*)"/gm;
  const citations: { num: string; title: string; link: string; snippet: string }[] = [];
  let citationMatch;
  citationRegex.lastIndex = 0;
  while ((citationMatch = citationRegex.exec(text)) !== null) {
    citations.push({
      num: citationMatch[1],
      title: citationMatch[2],
      link: citationMatch[3],
      snippet: citationMatch[4]
    });
  }

  if (citations.length < 3) {
    violations.push(`Response must contain at least 3 citation footnotes (found ${citations.length})`);
  }

  // Verify footnote links are in the context references list
  citations.forEach(cit => {
    let link = cit.link || '';
    // Normalize absolute godshew links to relative paths
    link = link.replace(/^https?:\/\/(?:www\.)?godshew\.org/, '');
    
    const inReferences = references.some(r => r.link.toLowerCase() === link.toLowerCase());
    if (!inReferences) {
      violations.push(`Citation [^${cit.num}] link "${cit.link}" is not in the allowed context references list`);
    }

    // Verify snippet fidelity
    if (cit.snippet) {
      const slug = link.startsWith('/pages/') ? link.substring(7) : link;
      const pageData = getPageData(slug);
      if (!pageData) {
        violations.push(`Source page for citation [^${cit.num}] ("${link}") not found`);
      } else {
        // Normalize whitespace and quotes
        const normalize = (str: string) => str.toLowerCase().replace(/[\s\r\n\t"'`“™”‘’]+/g, ' ').trim();
        const normSnippet = normalize(cit.snippet);
        const normBody = normalize(pageData.content);
        if (!normBody.includes(normSnippet)) {
          // If query is Spanish and the source page is in English, the snippet is translated
          const pageIsEnglish = /\b(the|and|of|in|to)\b/i.test(pageData.content);
          if (isSpanish && pageIsEnglish) {
            // Skip verbatim check for translated snippet
          } else {
            violations.push(`Citation [^${cit.num}] snippet is not a verbatim extract from the source page: "${cit.snippet.substring(0, 40)}..."`);
          }
        }
      }
    } else {
      violations.push(`Citation [^${cit.num}] is missing a verbatim context snippet`);
    }
  });

  // Verify all /pages/ links in cleanText are in references
  const pagesRegex = /(?:https?:\/\/(?:www\.)?godshew\.org)?\/pages\/([a-zA-Z0-9_-]+)/g;
  let pageMatch;
  pagesRegex.lastIndex = 0;
  while ((pageMatch = pagesRegex.exec(cleanText)) !== null) {
    const slug = pageMatch[1];
    const link = `/pages/${slug}`;
    const inReferences = references.some(r => r.link.toLowerCase() === link.toLowerCase());
    if (!inReferences) {
      violations.push(`Link ${link} in response text is not in the allowed context references list`);
    }
  }

  return {
    ok: violations.length === 0,
    violations
  };
}
