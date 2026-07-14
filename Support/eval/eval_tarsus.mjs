import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

// Helper to check if page exists
function pageResolves(slug) {
  if (!slug) return false;
  
  // Clean up any query parameters or hash anchors
  slug = slug.split(/[?#]/)[0];
  
  const pagesDir = path.join(projectRoot, 'data', 'pages');
  if (!fs.existsSync(pagesDir)) return false;

  const directPath = path.join(pagesDir, `${slug}.md`);
  if (fs.existsSync(directPath)) return true;

  // Normalized matching (mirroring pages.ts:61)
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const files = fs.readdirSync(pagesDir);

  // First pass: match normalized filename
  for (const file of files) {
    if (file.endsWith('.md')) {
      const fileBasename = file.replace('.md', '');
      const normalizedFile = fileBasename.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        normalizedFile === normalizedSlug ||
        (normalizedFile.length >= 5 && (normalizedSlug.includes(normalizedFile) || normalizedFile.includes(normalizedSlug)))
      ) {
        return true;
      }
    }
  }

  // Second pass: match YAML frontmatter title
  for (const file of files) {
    if (file.endsWith('.md')) {
      try {
        const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
        const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (fmMatch) {
          const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\n]+)["']?/m);
          if (titleMatch) {
            const title = titleMatch[1].trim();
            const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (
              normalizedTitle === normalizedSlug ||
              (normalizedTitle.length >= 5 && (normalizedTitle.includes(normalizedSlug) || normalizedSlug.includes(normalizedTitle)))
            ) {
              return true;
            }
          }
        }
      } catch (e) {}
    }
  }

  return false;
}

// Parse env variables manually from .env.local
let hasApiKey = false;
let apiKeySource = 'none';
try {
  const envPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine && !cleanLine.startsWith('#')) {
        const parts = cleanLine.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if ((key === 'DEEPSEEK_API_KEY' || key === 'GEMINI_API_KEY') && val) {
            hasApiKey = true;
            apiKeySource = key;
          }
        }
      }
    }
  }
} catch (e) {
  console.warn('Could not check .env.local file:', e.message);
}

// Load golden questions
const questionsPath = path.join(__dirname, 'golden_questions.json');
if (!fs.existsSync(questionsPath)) {
  console.error('golden_questions.json not found at:', questionsPath);
  process.exit(1);
}
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));

console.log(`Starting Tarsus Evaluation with ${questions.length} questions...`);
console.log(`API Key status: ${hasApiKey ? `Configured via ${apiKeySource}` : 'NOT Configured (Mock mode will run)'}`);

const results = [];

const expectedSalutationEn = "**Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.**";
const expectedSalutationEs = "**Tres mejores deseos para TODOS vosotros: Gracia, misericordia y paz, de Dios nuestro Padre y de Jesucristo nuestro Señor.**";

const expectedBenedictionEn = "**The grace of our Lord Jesus Christ [be] with you all. Amen.**";
const expectedBenedictionEs = "**La gracia de nuestro Señor Jesucristo [sea] con todos vosotros. Amén.**";

const bannedPhrases = [
  'i think', 'i feel', 'i believe', 'in my opinion', 'in my view',
  'it seems to me', "i'm not sure, but", "i'm not certain, but",
  "i'm not an expert, but", "i'm not a theologian, but", "i'm not a scholar, but"
];

const wordplayTerms = [
  'f-laws', 'ear what', 'lukewarm', '2sons', '2voices', '2covenants', 'cold', 'innerstand', 'innerstood', 'lawful-awful'
];

async function runEval() {
  for (const q of questions) {
    console.log(`[${q.id}] Querying: "${q.question}"`);
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: q.question }] })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const bodyText = data.text || '';
      const citations = data.citations || {};

      // Score rubric R1 to R10
      const scoreDetails = {};
      
      // Extract thinking process if present to get clean text for salutation check
      let cleanText = bodyText;
      let hasThinking = false;
      const thinkingMatch = bodyText.match(/^((?:>.*\n?)+)/m);
      if (thinkingMatch && thinkingMatch.index !== undefined) {
        const blockEnd = thinkingMatch.index + thinkingMatch[0].length;
        const afterBlock = bodyText.substring(blockEnd).trim();
        const expectedSal = q.lang === 'es' ? expectedSalutationEs : expectedSalutationEn;
        if (afterBlock.includes(expectedSal.replace(/\*\*/g, '')) || afterBlock.includes(expectedSal)) {
          cleanText = afterBlock;
          hasThinking = true;
        }
      }

      // R1: Salutation check
      const expectedSal = q.lang === 'es' ? expectedSalutationEs : expectedSalutationEn;
      scoreDetails.R1 = cleanText.startsWith(expectedSal) ? 10 : 0;

      // R2: Benediction check
      const expectedBen = q.lang === 'es' ? expectedBenedictionEs : expectedBenedictionEn;
      scoreDetails.R2 = cleanText.endsWith(expectedBen) ? 10 : 0;

      // R3: Arrow check
      scoreDetails.R3 = (cleanText.includes('→') || cleanText.includes('←')) ? 10 : 0;

      // R4: Wordplay check
      const cleanLower = cleanText.toLowerCase();
      let matchedWordplays = 0;
      for (const wp of wordplayTerms) {
        // Special case for 'cold' and 'ear what': handle casing specifically if needed, but since it's case insensitive,
        // let's do a word boundary or substring match. Let's do word boundary check for "cold" so we don't match "scold"
        if (wp === 'cold') {
          if (/\bcold\b/i.test(cleanLower) || /\bcold\b/i.test(cleanText)) matchedWordplays++;
        } else if (wp === 'ear what') {
          if (cleanLower.includes('ear what')) matchedWordplays++;
        } else {
          if (cleanLower.includes(wp)) matchedWordplays++;
        }
      }
      scoreDetails.R4 = matchedWordplays >= 2 ? 10 : 0;

      // R5: Banned phrases check
      let hasBanned = false;
      for (const phrase of bannedPhrases) {
        if (cleanLower.includes(phrase)) {
          hasBanned = true;
          break;
        }
      }
      if (q.lang === 'en') {
        if (/\bunderstand\b/i.test(cleanLower) || /\bunderstanding\b/i.test(cleanLower)) {
          hasBanned = true;
        }
      }
      scoreDetails.R5 = !hasBanned ? 10 : 0;

      // R6: Citations count and diversity
      const citKeys = Object.keys(citations);
      const uniqueLinks = new Set(citKeys.map(k => citations[k].link));
      scoreDetails.R6 = (citKeys.length >= 5 && uniqueLinks.size >= 3) ? 10 : 0;

      // R7: Link validity
      let allLinksValid = true;
      // Check citations links
      for (const k of citKeys) {
        const link = citations[k].link || '';
        const slug = link.startsWith('/pages/') ? link.substring(7) : link;
        if (!pageResolves(slug)) {
          allLinksValid = false;
        }
      }
      // Check "Learn More" links from text
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(cleanText)) !== null) {
        const link = linkMatch[2];
        if (link.startsWith('/pages/')) {
          const slug = link.substring(7);
          if (!pageResolves(slug)) {
            allLinksValid = false;
          }
        }
      }
      scoreDetails.R7 = allLinksValid ? 10 : 0;

      // R8: Paragraph sentence count guardrail
      // split cleanText by double newlines into paragraphs
      const paragraphs = cleanText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      let r8Passed = true;
      for (const p of paragraphs) {
        // Skip thinking block, salutation, benediction, and footnote definition block (which we stripped, but double check)
        if (p.startsWith('>') || p.startsWith('**Tres mejores') || p.startsWith('**Three best') || p.startsWith('**La gracia') || p.startsWith('**The grace') || p.startsWith('[^')) {
          continue;
        }
        // Count sentences using a simple heuristic
        const sentences = p.split(/[.!?]\s+/).filter(Boolean);
        if (sentences.length >= 6) {
          const hasBullet = p.startsWith('-') || p.startsWith('*') || /^\d+\./.test(p);
          const hasArrow = p.includes('→') || p.includes('←');
          // Check for standalone scripture lines by checking if any line is just a scripture reference
          const lines = p.split('\n').map(l => l.trim());
          const hasStandaloneScripture = lines.some(l => /^[12]?\s*[A-Z][a-z]+\.?\s+\d+[:.]\d+(-\d+)?$/.test(l));
          if (!hasBullet && !hasArrow && !hasStandaloneScripture) {
            r8Passed = false;
            break;
          }
        }
      }
      scoreDetails.R8 = r8Passed ? 10 : 0;

      // R9: Language match check
      let langMatch = false;
      if (q.lang === 'es') {
        const esMatches = (cleanLower.match(/\b(el|la|los|de|que|gracia|vosotros)\b/g) || []).length;
        langMatch = esMatches >= 3;
      } else {
        const enMatches = (cleanLower.match(/\b(the|and|of|in|to|for|is|it|that|with|this)\b/g) || []).length;
        langMatch = enMatches >= 3;
      }
      scoreDetails.R9 = langMatch ? 10 : 0;

      // R10: Doctrinal "under" violation check
      const underViolation = cleanLower.includes('under grace') || cleanLower.includes('bajo la gracia');
      scoreDetails.R10 = !underViolation ? 10 : 0;

      const totalScore = Object.values(scoreDetails).reduce((a, b) => a + b, 0);

      results.push({
        id: q.id,
        question: q.question,
        lang: q.lang,
        score: totalScore,
        rubric: scoreDetails,
        text: bodyText,
        citations: citations
      });

      console.log(`[${q.id}] Score: ${totalScore}/100`);
    } catch (e) {
      console.error(`[${q.id}] Failed to evaluate:`, e.message);
      results.push({
        id: q.id,
        question: q.question,
        lang: q.lang,
        score: 0,
        error: e.message
      });
    }
  }

  // Calculate stats
  const validResults = results.filter(r => r.score !== undefined);
  const averageScore = validResults.length ? (validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length).toFixed(1) : 0;

  const rubricAverages = {};
  for (let i = 1; i <= 10; i++) {
    const rubricKey = `R${i}`;
    const scores = validResults.map(r => r.rubric?.[rubricKey] || 0);
    rubricAverages[rubricKey] = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
  }

  // Print summary table to stdout
  console.log('\n=======================================');
  console.log('            EVALUATION RESULTS         ');
  console.log('=======================================');
  console.log(`Average Score: ${averageScore}/100`);
  console.log('Rubric Breakdown (Average Points out of 10):');
  for (let i = 1; i <= 10; i++) {
    const key = `R${i}`;
    let desc = '';
    switch (key) {
      case 'R1': desc = 'Salutation (starts with exact expected salutation)'; break;
      case 'R2': desc = 'Benediction (ends with exact expected benediction)'; break;
      case 'R3': desc = 'Arrows (contains → or ←)'; break;
      case 'R4': desc = 'Wordplay (contains >= 2 signature terms)'; break;
      case 'R5': desc = 'Banned words (no "I think", "understand" in EN, etc)'; break;
      case 'R6': desc = 'Citation diversity (>= 5 footnotes, >= 3 links)'; break;
      case 'R7': desc = 'Link validity (all links resolve correctly)'; break;
      case 'R8': desc = 'Staccato guardrail (paragraph sentence limit)'; break;
      case 'R9': desc = 'Language match'; break;
      case 'R10': desc = 'Doctrinal "under grace" check'; break;
    }
    console.log(`  ${key}: ${rubricAverages[key]}/10.0 - ${desc}`);
  }
  console.log('=======================================');

  // Ensure results directory exists
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = path.join(resultsDir, `${timestamp}.json`);
  
  const outputJson = {
    header: {
      timestamp: new Date().toISOString(),
      apiKeyConfigured: hasApiKey,
      apiKeySource: apiKeySource,
      averageScore: parseFloat(averageScore),
      rubricAverages: rubricAverages
    },
    results: results
  };

  fs.writeFileSync(resultFile, JSON.stringify(outputJson, null, 2));
  console.log(`Detailed results written to: ${resultFile}`);
}

runEval();
