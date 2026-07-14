import { NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/search';
import { getMemoryString, updateMemory } from '@/lib/memory';
import { getMarkedPageContent, getPageData } from '@/lib/pages';
import { detectSpanish, buildTarsusSystemPrompt } from '@/lib/prompt';
import { validateResponse } from '@/lib/validate';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

function truncateToSentenceBoundary(content: string, cap = 4000): string {
  if (content.length <= cap) return content;
  const sub = content.substring(0, cap);
  const match = sub.match(/[.!?](?=\s|$)[^.!?]*$/);
  if (match && match.index !== undefined && match.index > cap - 1000) {
    return content.substring(0, match.index + 1) + ' [...truncated]';
  }
  return sub + ' [...truncated]';
}

export async function POST(req: Request) {
  try {
    const { messages, markedPageIds } = await req.json();
    if (!messages || !messages.length) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const userQuery = messages[messages.length - 1].content;

    // Detect query language
    const isSpanish = detectSpanish(userQuery);

    // Expand search query with English equivalents if the query is in Spanish
    let searchQuery = userQuery;
    if (isSpanish) {
      const queryLower = userQuery.toLowerCase();
      const expansions: string[] = [];
      const SPANISH_TO_ENGLISH_THEOLOGY: Record<string, string> = {
        'tibio': 'lukewarm',
        'tibios': 'lukewarm',
        'reino': 'kingdom',
        'resurreccion': 'resurrection',
        'resurrección': 'resurrection',
        'ley': 'law',
        'leyes': 'laws',
        'gracia': 'grace',
        'perdon': 'forgiveness',
        'perdón': 'forgiveness',
        'fariseo': 'pharisee',
        'fariseos': 'pharisees',
        'cordero': 'lamb',
        'velo': 'veil',
        'oracion': 'prayer',
        'oración': 'prayer',
        'oraciones': 'prayers',
        'templo': 'temple',
        'enemigo': 'enemy',
        'enemigos': 'enemies',
        'amor': 'love charity',
        'caridad': 'charity',
        'soteriologia': 'soteriology',
        'soteriología': 'soteriology',
        'fe': 'faith',
        'salvacion': 'salvation',
        'salvación': 'salvation',
        'pecado': 'sin',
        'pecados': 'sins',
        'justicia': 'righteousness',
        'justificacion': 'justification',
        'justificación': 'justification',
        'pacto': 'covenant',
        'pactos': 'covenants',
        'dos hijos': '2sons two sons',
        '2 hijos': '2sons two sons',
        'hijo de dios': 'son of god',
        'hijo del hombre': 'son of man',
        '2 voces': '2voices two voices',
        'dos voces': '2voices two voices',
        '2sonjesus': '2sonsjesus 2sonjesus two sons jesus',
        '1sonchrist': '1sonchrist 1sonschrist one son christ',
        'misterio': 'mystery',
        'misterios': 'mysteries',
        'apocalipsis': 'revelation',
        'escritura': 'scripture',
        'escrituras': 'scriptures',
        'verdad': 'truth',
        'vida': 'life',
        'muerte': 'death',
        'ira': 'wrath',
        'paz': 'peace',
        'joven rico': 'rich young ruler',
        'publicano': 'publican',
        'crucificado': 'crucified',
        'cruz': 'cross',
        'misericordia': 'mercy',
        'obra': 'work',
        'obras': 'works',
        'salvador': 'saviour',
        'salvadores': 'saviours',
        'creyente': 'believer',
        'creyentes': 'believers'
      };
      
      for (const [esKey, enVal] of Object.entries(SPANISH_TO_ENGLISH_THEOLOGY)) {
        if (queryLower.includes(esKey)) {
          expansions.push(enVal);
        }
      }
      
      if (expansions.length > 0) {
        searchQuery = `${userQuery} ${expansions.join(' ')}`;
      }
    }

    // 1. Search RAG context (utilizing MemPalace hybrid search with fallback to local BM25)
    let searchResults: { title: string; path: string; type: string; score: number; content: string }[] = [];
    
    try {
      const scriptPath = path.join(process.cwd(), 'src', 'lib', 'search_palace.py');
      
      const searchOutput = await new Promise<string>((resolve, reject) => {
        execFile('python', [scriptPath, searchQuery, '10'], { env: { ...process.env, PYTHONUTF8: '1' } }, (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
      
      const parsed = JSON.parse(searchOutput);
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      
      if (parsed.results && Array.isArray(parsed.results)) {
        searchResults = parsed.results.map((r: any) => {
          let filePath = '';
          if (r.room === 'data') {
            filePath = path.join(process.cwd(), 'data', 'pages', r.source_file);
          } else if (r.room === 'godshew_original') {
            filePath = path.join(process.cwd(), 'GodShew_Original', 'GodShew_Original', r.source_file);
          } else {
            filePath = path.join(process.cwd(), 'data', 'pages', r.source_file);
          }

          const title = r.source_file.replace(/\.(md|html|htm)$/i, '');
          let content = r.text || '';

          // Enrich thin chunks (< 700 chars)
          if (content.length < 700 && fs.existsSync(filePath)) {
            try {
              const rawContent = fs.readFileSync(filePath, 'utf-8');
              const body = rawContent.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '');
              const first4k = body.substring(0, 4000);
              if (!first4k.includes(content)) {
                content = first4k + '\n\n' + content;
              } else {
                content = first4k;
              }
            } catch (e) {
              console.error(`Error reading/enriching thin chunk for ${r.source_file}:`, e);
            }
          }

          return {
            title: title,
            path: filePath,
            type: r.room || 'document',
            score: r.similarity || 0,
            content: content
          };
        });
      }
    } catch (err) {
      console.error("MemPalace search failed, falling back to local BM25 corpus search:", err);
      searchResults = searchCorpus(searchQuery, 10);
    }

    // Filter searchResults to exclude JSON database files from context and references
    searchResults = searchResults.filter(res => 
      !res.path.toLowerCase().endsWith('.json') && 
      !res.title.toLowerCase().endsWith('.json')
    );
    
    // Group by source_file path (dedup + diversity)
    const groups: Record<string, { title: string; path: string; type: string; score: number; chunks: string[] }> = {};
    searchResults.forEach(res => {
      const key = res.path;
      if (!groups[key]) {
        groups[key] = {
          title: res.title,
          path: res.path,
          type: res.type,
          score: res.score,
          chunks: []
        };
      }
      if (res.score > groups[key].score) {
        groups[key].score = res.score;
      }
      // Keep at most 2 chunks per document
      if (groups[key].chunks.length < 2) {
        groups[key].chunks.push(res.content);
      }
    });

    // Convert back to array, join chunks, cap at 4,000 chars per document
    let processedDocs = Object.values(groups).map(g => {
      const combinedContent = g.chunks.join('\n\n');
      const cappedContent = truncateToSentenceBoundary(combinedContent, 4000);
      return {
        title: g.title,
        path: g.path,
        type: g.type,
        score: g.score,
        content: cappedContent
      };
    });

    // Sort by score descending and take top 8 distinct documents
    processedDocs.sort((a, b) => b.score - a.score);
    processedDocs = processedDocs.slice(0, 8);

    // Load explicitly marked documents
    let markedContextStr = '';
    if (markedPageIds && Array.isArray(markedPageIds) && markedPageIds.length > 0) {
      markedPageIds.forEach((id: string) => {
        const content = getMarkedPageContent(id);
        if (content) {
          try {
            let body = content;
            let title = id;
            const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
            if (fmMatch) {
              body = content.substring(fmMatch[0].length);
              const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\n]+)["']?/m);
              if (titleMatch) title = titleMatch[1].trim();
            }
            markedContextStr += `--- EXPLICITLY SELECTED DOCUMENT FOR DIRECT OPERATION: ${title} (Link: /pages/${id}) ---\n${body}\n\n`;
          } catch (e) {
            console.error(`Error loading marked document ${id}:`, e);
          }
        }
      });
    }

    // Build context string and reference list with 60,000 char budget
    let contextStr = markedContextStr;
    const references: { title: string; link: string }[] = [];

    processedDocs.forEach((res) => {
      const basename = res.path.split(/[\\\/]/).pop()?.replace(/\.(md|html|htm)$/i, '') || '';
      let resolvedLink = `/pages/${basename}`;
      
      // Verify link validity
      let linkIsValid = fs.existsSync(path.join(process.cwd(), 'data', 'pages', basename + '.md'));
      if (!linkIsValid) {
        const pageData = getPageData(basename);
        if (pageData && pageData.id) {
          resolvedLink = `/pages/${pageData.id}`;
          linkIsValid = true;
        }
      }

      if (!linkIsValid) {
        resolvedLink = 'NONE';
      }

      let docHeader = '';
      if (resolvedLink === 'NONE') {
        docHeader = `--- DOCUMENT: ${res.title} (Link: NONE — do not cite this document in Learn More or footnotes) (Source: ${res.type}) ---\n`;
      } else {
        docHeader = `--- DOCUMENT: ${res.title} (Link: ${resolvedLink}) (Source: ${res.type}) ---\n`;
      }

      const docContent = res.content + '\n\n';
      const proposedAddition = docHeader + docContent;

      if (contextStr.length + proposedAddition.length <= 60000) {
        contextStr += proposedAddition;
        if (resolvedLink !== 'NONE') {
          references.push({ title: res.title, link: resolvedLink });
        }
      }
    });

    // 2. System prompt
    const expectedSalutation = isSpanish 
      ? "**Tres mejores deseos para TODOS vosotros: Gracia, misericordia y paz, de Dios nuestro Padre y de Jesucristo nuestro Señor.**"
      : "**Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.**";

    const expectedBenediction = isSpanish
      ? "**La gracia de nuestro Señor Jesucristo [sea] con todos vosotros. Amén.**"
      : "**The grace of our Lord Jesus Christ [be] with you all. Amen.**";

    const systemPrompt = buildTarsusSystemPrompt({
      isSpanish,
      contextStr,
      memoryStr: getMemoryString(),
      expectedSalutation,
      expectedBenediction
    });

    // Format conversation history for API
    const historyDeepSeek = messages.map((m: any) => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));
    
    const historyGemini = messages.map((m: any) => ({
      role: m.role === 'bot' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Check for mock mode first
    if (!DEEPSEEK_API_KEY && !GEMINI_API_KEY) {
      const text = isSpanish 
        ? expectedSalutation + '\n\nParece que al mirar tu pregunta, debemos dividir la cOLD Ley del Antiguo Testamento de la Gracia del Nuevo Testamento. Jesucristo vino no para mantenernos bajo la ley, sino para traernos gracia y verdad. ¿Por qué? Porque la ley por medio de Moisés fue dada, pero la gracia y la verdad vinieron por medio de Jesucristo. Mmmm...\n\nSe requiere dejar el modo cOLD de Mt y Mk para entrar en el modo LukeWarm de Lk, Jn y Hechos, donde la Voz del NT dice: "vive" ← & → la Voz del OT que dice: "juicio también". Escuchemos todos y tengamos una sola voz: "vive".\n\nLearn More:\n' + references.map(r => '- [' + r.title + '](' + r.link + ')').join('\n') + '\n\n' + expectedBenediction
        : expectedSalutation + '\n\nSeems when looking at your question, we must divide cOLD OT Law from NT Grace. JC came not to keep us under the law, but to bring us into grace and truth. Why? Because the law was given by Moses, but grace and truth came by Jesus Christ. Hmmm...\n\nIt takes leaving the cOLD mode of Mt and Mk to enter into the LukeWarm mode of Lk, Jn, and Acts, where the NT Voice says: "live" ← & → OT Voice which says: "judgment also". Let\'s all hear and have only one voice: "live".\n\nLearn More:\n' + references.map(r => '- [' + r.title + '](' + r.link + ')').join('\n') + '\n\n' + expectedBenediction;
      
      return NextResponse.json({ text });
    }

    async function executeModelCall(customSystemPrompt: string, customHistoryDeepSeek: any[], customHistoryGemini: any[]): Promise<string> {
      if (DEEPSEEK_API_KEY) {
        let attempts = 0;
        let response;
        while (attempts < 3) {
          response = await fetch(
            'https://api.deepseek.com/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
              },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                  {
                    role: 'system',
                    content: customSystemPrompt
                  },
                  ...customHistoryDeepSeek
                ],
                temperature: 0.2,
                max_tokens: 8192
              })
            }
          );

          if (response.ok) {
            break;
          }

          if (response.status === 429 || response.status === 503 || response.status === 502) {
            attempts++;
            console.warn(`[tarsus-api] DeepSeek API returned status ${response.status}. Retrying attempt ${attempts}/3 after delay...`);
            await new Promise(resolve => setTimeout(resolve, attempts * 2000));
          } else {
            break;
          }
        }

        if (!response || !response.ok) {
          const errData = await response?.json().catch(() => ({})) || {};
          throw new Error('DeepSeek API error: ' + (response?.status || 'unknown') + ' - ' + JSON.stringify(errData));
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } else {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: customSystemPrompt }]
              },
              contents: customHistoryGemini,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 12288,
              },
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error('Gemini API error: ' + response.status + ' - ' + JSON.stringify(errData));
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    }

    function sanitize(rawText: string): string {
      let t = rawText.trim();

      // Extract thinking process block if present (preserve it)
      let thinkingBlock = '';
      const thinkingMatch = t.match(/^((?:>.*\n?)+)/m);
      if (thinkingMatch && thinkingMatch.index !== undefined) {
        const blockEnd = thinkingMatch.index + thinkingMatch[0].length;
        const afterBlock = t.substring(blockEnd).trim();
        // Only treat as thinking if it appears before the salutation
        if (afterBlock.includes(expectedSalutation.replace(/\*\*/g, '')) || afterBlock.includes(expectedSalutation)) {
          thinkingBlock = thinkingMatch[0].trim();
          t = afterBlock;
        }
      }

      // Ensure it starts with the salutation
      if (!t.startsWith(expectedSalutation)) {
        const rawSalutation = expectedSalutation.replace(/\*\*/g, '');
        const indexBold = t.indexOf(expectedSalutation);
        const indexRaw = t.indexOf(rawSalutation);
        
        if (indexBold !== -1) {
          t = t.substring(indexBold);
        } else if (indexRaw !== -1) {
          t = expectedSalutation + "\n\n" + t.substring(indexRaw + rawSalutation.length).trim();
        } else {
          t = expectedSalutation + "\n\n" + t;
        }
      }

      // Re-attach thinking block before the salutation
      if (thinkingBlock) {
        t = thinkingBlock + '\n\n' + t;
      }

      // Ensure it ends with the benediction
      if (!t.endsWith(expectedBenediction)) {
        const index = t.lastIndexOf(expectedBenediction.replace(/\*\*/g, ''));
        if (index !== -1) {
          t = t.substring(0, index) + expectedBenediction;
        } else {
          t = t + "\n\n" + expectedBenediction;
        }
      }

      // Replace any accidental ascii arrows with unicode arrows
      t = t.replace(/<--&-->/g, '← & →');
      t = t.replace(/<--/g, '←');
      t = t.replace(/-->/g, '→');

      return t;
    }

    // First model generation call
    let text = await executeModelCall(systemPrompt, historyDeepSeek, historyGemini);
    
    // First sanitization + validation
    let sanitizedText = sanitize(text);
    let validation = validateResponse(sanitizedText, isSpanish, references);
    
    // Truncation check
    const hasBenediction = text.includes(expectedBenediction) || text.includes(expectedBenediction.replace(/\*\*/g, ''));
    if (!hasBenediction) {
      validation.ok = false;
      validation.violations.push('Response was truncated (missing benediction)');
    }

    // One corrective retry loop if validation fails
    if (!validation.ok) {
      console.warn('[tarsus-validate] First response failed validation. Initiating corrective retry. Violations:', validation.violations);
      
      const violationListStr = validation.violations.map(v => `- ${v}`).join('\n');
      const retryUserMessageContent = `Your previous response violated these mandatory rules:\n${violationListStr}\n\nRegenerate the FULL response, correcting every violation. All other rules still apply.`;
      
      const retryHistoryDeepSeek = [
        ...historyDeepSeek,
        { role: 'assistant', content: text },
        { role: 'user', content: retryUserMessageContent }
      ];
      
      const retryHistoryGemini = [
        ...historyGemini,
        { role: 'model', parts: [{ text: text }] },
        { role: 'user', parts: [{ text: retryUserMessageContent }] }
      ];

      // Second generation attempt
      text = await executeModelCall(systemPrompt, retryHistoryDeepSeek, retryHistoryGemini);
      
      // Post-retry sanitization + validation
      sanitizedText = sanitize(text);
      validation = validateResponse(sanitizedText, isSpanish, references);
      const hasBenedictionSecond = text.includes(expectedBenediction) || text.includes(expectedBenediction.replace(/\*\*/g, ''));
      if (!hasBenedictionSecond) {
        validation.violations.push('Response was truncated (missing benediction) on retry');
      }

      if (!validation.ok) {
        console.warn('[tarsus-validate] Retry response also failed validation. Violations:', validation.violations);
      } else {
        console.log('[tarsus-validate] Retry response passed validation successfully.');
      }
    } else {
      console.log('[tarsus-validate] First response passed validation successfully.');
    }

    // Trigger background memory extraction
    updateMemory(userQuery, sanitizedText).catch(console.error);

    // Extract footnote definitions → citations
    // Format: [^1]: [Title](link) "snippet"
    const citationRegex = /^\[\^(\d+)\]:\s*\[([^\]]+)\]\(([^)]+)\)\s*"([^"]*)"/gm;
    const citations: Record<string, { title: string; link: string; snippet: string }> = {};
    let citationMatch;
    citationRegex.lastIndex = 0;
    while ((citationMatch = citationRegex.exec(sanitizedText)) !== null) {
      citations[citationMatch[1]] = {
        title: citationMatch[2],
        link: citationMatch[3],
        snippet: citationMatch[4],
      };
    }

    // Strip all footnote definition lines from the visible text body
    const cleanedBody = sanitizedText.replace(/^\[\^\d+\]:.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

    return NextResponse.json({ text: cleanedBody, citations });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
