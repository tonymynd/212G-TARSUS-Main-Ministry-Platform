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
      const mockText = isSpanish 
        ? expectedSalutation + '\n\nParece que al mirar tu pregunta, debemos dividir la cOLD Ley del Antiguo Testamento de la Gracia del Nuevo Testamento. Jesucristo vino no para mantenernos bajo la ley, sino para traernos gracia y verdad. ¿Por qué? Porque la ley por medio de Moisés fue dada, pero la gracia y la verdad vinieron por medio de Jesucristo. Mmmm...\n\nSe requiere dejar el modo cOLD de Mt y Mk para entrar en el modo LukeWarm de Lk, Jn y Hechos, donde la Voz del NT dice: "vive" ← & → la Voz del OT que dice: "juicio también". Escuchemos todos y tengamos una sola voz: "vive".\n\nLearn More:\n' + references.map(r => '- [' + r.title + '](' + r.link + ')').join('\n') + '\n\n' + expectedBenediction
        : expectedSalutation + '\n\nSeems when looking at your question, we must divide cOLD OT Law from NT Grace. JC came not to keep us under the law, but to bring us into grace and truth. Why? Because the law was given by Moses, but grace and truth came by Jesus Christ. Hmmm...\n\nIt takes leaving the cOLD mode of Mt and Mk to enter into the LukeWarm mode of Lk, Jn, and Acts, where the NT Voice says: "live" ← & → OT Voice which says: "judgment also". Let\'s all hear and have only one voice: "live".\n\nLearn More:\n' + references.map(r => '- [' + r.title + '](' + r.link + ')').join('\n') + '\n\n' + expectedBenediction;
      
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          const words = mockText.split(' ');
          for (const word of words) {
            controller.enqueue(encoder.encode(word + ' '));
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          controller.close();
        }
      });
      return new Response(customStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Helper to parse Gemini's chunked stream array JSON structure
    function parseGeminiChunks(buffer: string): { objects: any[], remaining: string } {
      const objects: any[] = [];
      let startIdx = 0;
      
      while (true) {
        const openBrace = buffer.indexOf('{', startIdx);
        if (openBrace === -1) {
          break;
        }
        
        let braceCount = 0;
        let endBrace = -1;
        let inString = false;
        let escape = false;
        
        for (let i = openBrace; i < buffer.length; i++) {
          const char = buffer[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (char === '\\') {
            escape = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endBrace = i;
                break;
              }
            }
          }
        }
        
        if (endBrace === -1) {
          break;
        }
        
        const jsonStr = buffer.substring(openBrace, endBrace + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          objects.push(parsed);
        } catch (e) {
          // ignore parsing error of incomplete json chunks
        }
        startIdx = endBrace + 1;
      }
      
      return {
        objects,
        remaining: buffer.substring(startIdx)
      };
    }

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        let fullText = '';
        try {
          if (DEEPSEEK_API_KEY) {
            let response = await fetch(
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
                      content: systemPrompt
                    },
                    ...historyDeepSeek
                  ],
                  temperature: 0.2,
                  max_tokens: 8192,
                  stream: true
                })
              }
            );

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error('DeepSeek API error: ' + response.status + ' - ' + JSON.stringify(errData));
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed.startsWith('data: ')) {
                  const dataStr = trimmed.substring(6);
                  if (dataStr === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    const text = parsed.choices?.[0]?.delta?.content || '';
                    if (text) {
                      fullText += text;
                      controller.enqueue(encoder.encode(text));
                    }
                  } catch (e) {
                    // ignore
                  }
                }
              }
            }
          } else {
            const response = await fetch(
              'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=' + GEMINI_API_KEY,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  systemInstruction: {
                    parts: [{ text: systemPrompt }]
                  },
                  contents: historyGemini,
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

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const result = parseGeminiChunks(buffer);
              buffer = result.remaining;

              for (const obj of result.objects) {
                const text = obj.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) {
                  fullText += text;
                  controller.enqueue(encoder.encode(text));
                }
              }
            }
          }

          // Trigger background memory extraction after streaming ends
          updateMemory(userQuery, fullText).catch(console.error);
          
          controller.close();
        } catch (err: any) {
          console.error('Error during streaming:', err);
          controller.error(err);
        }
      }
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
