import path from 'path';

const fs = require('fs');

interface SearchDoc {
  title: string;
  path: string;
  type: string;
  tf: Record<string, number>;
  length: number;
}

interface IndexData {
  documents: SearchDoc[];
  idf: Record<string, number>;
  total_docs: number;
}

let searchIndex: IndexData | null = null;

function loadIndex() {
  if (!searchIndex) {
    const indexPath = path.join(process.cwd(), 'src', 'data', 'search_index.json');
    if (fs.existsSync(indexPath)) {
      const rawData = fs.readFileSync(indexPath, 'utf-8');
      searchIndex = JSON.parse(rawData);
    } else {
      console.error("Search index not found at:", indexPath);
    }
  }
  return searchIndex;
}

const STOPWORDS = new Set([
  'the', 'is', 'in', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'with', 'about', 'there', 'on', 'at', 'by', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'our', 'your', 'my', 'he', 'she', 'him', 'her', 'we', 'us', 'you', 'me', 'i', 'has', 'have', 'had', 'been', 'was', 'were', 'be', 'do', 'does', 'did', 'but', 'not', 'no', 'yes',
  'el', 'la', 'los', 'las', 'en', 'y', 'o', 'de', 'un', 'una', 'con', 'sobre', 'para', 'por', 'este', 'esta', 'estos', 'estas', 'eso', 'esa', 'esos', 'esas', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'yo', 'nosotros', 'ellos', 'ellas', 'del', 'al', 'lo'
]);

export function searchCorpus(query: string, limit = 5) {
  const index = loadIndex();
  if (!index) return [];

  // Tokenize query
  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s←→&]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  // Query expansion for semantic/conceptual search
  const expandedTokens = [...queryTokens];
  for (const token of queryTokens) {
    if (token === '2sonjesus' || token === '2sonsjesus' || token === 'twosonsjesus' || token === 'twosonjesus') {
      expandedTokens.push('2sonsjesus', '2sonjesus', 'two', 'sons', 'jesus');
    }
    if (token === '1sonchrist' || token === '1sonschrist' || token === 'onesonchrist' || token === 'onesonschrist') {
      expandedTokens.push('1sonchrist', '1sonschrist', 'one', 'son', 'christ');
    }
  }
  const finalTokens = Array.from(new Set(expandedTokens));

  const scores: { doc: SearchDoc; score: number }[] = [];
  const k1 = 1.5;
  const b = 0.75;

  // Calculate average doc length
  const avgDocLen = index.documents.reduce((sum, d) => sum + d.length, 0) / index.total_docs;

  for (const doc of index.documents) {
    let score = 0;
    
    // BM25 term weight
    for (const token of finalTokens) {
      if (doc.tf[token]) {
        const tf = doc.tf[token];
        const idf = index.idf[token] || 0;
        
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.length / avgDocLen));
        score += idf * (numerator / denominator);
      }
    }
    
    // Boost title match using whole-word matches and ignoring stopwords
    const titleLower = doc.title.toLowerCase();
    const titleWords = titleLower.split(/[^a-z0-9]/).filter(Boolean);
    for (const token of finalTokens) {
      if (STOPWORDS.has(token)) continue;
      if (titleWords.includes(token)) {
        score += 5.0; // Significant boost for title matches
      }
    }

    // Boost filename match using whole-word matches and ignoring stopwords
    const filename = path.basename(doc.path).toLowerCase();
    const filenameWords = filename.split(/[^a-z0-9]/).filter(Boolean);
    for (const token of finalTokens) {
      if (STOPWORDS.has(token)) continue;
      if (filenameWords.includes(token)) {
        score += 8.0; // Significant boost for filename matches
      }
    }

    if (score > 0) {
      scores.push({ doc, score });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, limit).map(s => {
    // Read the actual body of the file
    let body = '';
    try {
      if (fs['existsSync'](s.doc.path)) {
        const rawContent = fs['readFileSync'](s.doc.path, 'utf-8');
        // Strip frontmatter if present
        body = rawContent.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '');
      }
    } catch (e) {
      console.error(`Error reading document at ${s.doc.path}:`, e);
    }
    
    return {
      title: s.doc.title,
      path: s.doc.path,
      type: s.doc.type,
      score: s.score,
      content: body
    };
  });
}
