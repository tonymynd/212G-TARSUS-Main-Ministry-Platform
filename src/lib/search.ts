import fs from 'fs';
import path from 'path';

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

export function searchCorpus(query: string, limit = 5) {
  const index = loadIndex();
  if (!index) return [];

  // Tokenize query
  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s←→&]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const scores: { doc: SearchDoc; score: number }[] = [];
  const k1 = 1.5;
  const b = 0.75;

  // Calculate average doc length
  const avgDocLen = index.documents.reduce((sum, d) => sum + d.length, 0) / index.total_docs;

  for (const doc of index.documents) {
    let score = 0;
    for (const token of queryTokens) {
      if (doc.tf[token]) {
        const tf = doc.tf[token];
        const idf = index.idf[token] || 0;
        
        // BM25 term weight
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.length / avgDocLen));
        score += idf * (numerator / denominator);
      }
    }
    
    // Boost title match
    const titleLower = doc.title.toLowerCase();
    for (const token of queryTokens) {
      if (titleLower.includes(token)) {
        score += 5.0; // Significant boost for title matches
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
      if (fs.existsSync(s.doc.path)) {
        const rawContent = fs.readFileSync(s.doc.path, 'utf-8');
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
