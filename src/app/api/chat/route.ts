import { NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/search';
import { getMemoryString, updateMemory } from '@/lib/memory';
import { getMarkedPageContent } from '@/lib/pages';
import { execFile } from 'child_process';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { messages, markedPageIds } = await req.json();
    if (!messages || !messages.length) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const userQuery = messages[messages.length - 1].content;

    // 1. Search RAG context (utilizing MemPalace hybrid search with fallback to local BM25)
    let searchResults: { title: string; path: string; type: string; score: number; content: string }[] = [];
    
    try {
      const scriptPath = path.join(process.cwd(), 'src', 'lib', 'search_palace.py');
      
      const searchOutput = await new Promise<string>((resolve, reject) => {
        execFile('python', [scriptPath, userQuery, '10'], { env: { ...process.env, PYTHONUTF8: '1' } }, (error: any, stdout: string, stderr: string) => {
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
            filePath = path.join(process.cwd(), 'src', 'data', 'pages', r.source_file);
          } else if (r.room === 'godshew_original') {
            filePath = path.join(process.cwd(), 'GodShew_Original', 'GodShew_Original', r.source_file);
          } else {
            filePath = path.join(process.cwd(), 'src', 'data', 'pages', r.source_file);
          }

          const title = r.source_file.replace(/\.(md|html|htm)$/i, '');

          return {
            title: title,
            path: filePath,
            type: r.room || 'document',
            score: r.similarity || 0,
            content: r.text || ''
          };
        });
      }
    } catch (err) {
      console.error("MemPalace search failed, falling back to local BM25 corpus search:", err);
      searchResults = searchCorpus(userQuery, 10);
    }

    // Filter searchResults to exclude JSON database files from context and references
    searchResults = searchResults.filter(res => 
      !res.path.toLowerCase().endsWith('.json') && 
      !res.title.toLowerCase().endsWith('.json')
    );
    
    // Load explicitly marked documents
    let markedContextStr = '';
    if (markedPageIds && Array.isArray(markedPageIds) && markedPageIds.length > 0) {
      markedPageIds.forEach((id) => {
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

    // Build context string and reference list
    let contextStr = markedContextStr;
    const references: { title: string; link: string }[] = [];

    searchResults.forEach((res) => {
      const basename = res.path.split(/[\\\/]/).pop()?.replace(/\.(md|html|htm)$/i, '') || '';
      const link = `/pages/${basename}`;

      contextStr += `--- DOCUMENT: ${res.title} (Link: ${link}) (Source: ${res.type}) ---\n${res.content}\n\n`;
      references.push({ title: res.title, link });
    });

    // 2. System prompt
    // Detect query language
    const spanishPatterns = /\b(el|la|los|las|un|una|del|con|para|por|como|que|gracia|ley|paz|esta|este|es|si|no|cómo|qué|por qué|quién|dónde|cuándo|cuál|quiénes)\b/i;
    const englishPatterns = /\b(the|and|of|in|to|for|is|it|that|with|this|what|how|why|who|where|when|which)\b/i;
    const spanishMatches = (userQuery.match(spanishPatterns) || []).length;
    const englishMatches = (userQuery.match(englishPatterns) || []).length;
    const isSpanish = spanishMatches > englishMatches;

    const expectedSalutation = isSpanish 
      ? "**Tres mejores deseos para TODOS vosotros: Gracia, misericordia y paz, de Dios nuestro Padre y de Jesucristo nuestro Señor.**"
      : "**Three best wishes unto YOU all: Grace, mercy, and peace, from God our Father and Jesus Christ our Lord.**";

    const expectedBenediction = isSpanish
      ? "**La gracia de nuestro Señor Jesucristo [sea] con todos vosotros. Amén.**"
      : "**The grace of our Lord Jesus Christ [be] with you all. Amen.**";

    // Build system prompt as a regular string to avoid any template literal issues
    const systemPrompt = [
      'You are Tarsus (The Apostle), an AI persona grounded in the authorship corpus and writing style of Daniel Miles (founder of GodShew.org).',
      '',
      'STYLE CONSTRAINTS:',
      '1. Language: The user\'s query is in ' + (isSpanish ? 'SPANISH' : 'ENGLISH') + '. You MUST write your entire response in ' + (isSpanish ? 'SPANISH' : 'ENGLISH') + '.',
      isSpanish ? '   Translate Daniel Miles\' style elements naturally: use transition markers like "Parece...", "Mmmm...", "Sin embargo...", "Y...", "Entonces..." and preserve capitalized patterns (e.g. "cOLD", "LukeWarm", "2Sons", "2Voices") and arrows ("← & →", "←", "→").' : '',
      isSpanish ? '   CRITICAL: Although the response is in Spanish, you MUST keep all citation metadata, document titles, page links, and footnote definitions in their original form (ENGLISH). Do NOT translate document titles or paths (e.g. keep [Godliness Study](/pages/godliness_study) and the exact quote in English inside the footnote definition block). Do not attempt to translate or localize them.' : '',
      '',
      // ----------
      '2. Thinking Process (MANDATORY):',
      '   - BEFORE the opening salutation, you MUST include a "Thinking Process" section formatted as a markdown blockquote.',
      '   - This section should transparently show your analytical reasoning: what sources you are consulting, how you are connecting the user\'s question to Daniel Miles\' teachings, what Bible references you plan to cite, and your theological reasoning chain.',
      '   - Format it EXACTLY like this:',
      '     > **Thinking Process:**',
      '     > ',
      '     > [Your step-by-step reasoning here, showing how you analyze the question, which documents are relevant, what theological connections you are making, and how you plan to structure the response.]',
      '   - This thinking section must be substantive (at least 3-5 lines) and genuinely reflect your analytical process. Do NOT make it generic or templated.',
      '',
      '3. Opening: Immediately after the Thinking Process blockquote, you MUST begin the main response with exactly:',
      '"' + expectedSalutation + '"',
      '(No other text between the thinking blockquote and this salutation. No "Sure!", "Here is what you asked:", or greeting variations).',
      '',
      '4. Closing: You MUST always close your response with exactly:',
      '"' + expectedBenediction + '"',
      '(Do not add any text after this, and it must be bolded).',
      ' 4.1 Banned words and phrases: ',
        '   - "I think"',
        '   - "I feel"',
        '   - "I believe"',
        '   - "In my opinion"',
        '   - "In my view"',
        '   - "It seems to me"',
        '   - "I\'m not sure, but"',
        '   - "I\'m not certain, but"',
        '   - "I\'m not an expert, but"',
        '   - "I\'m not a theologian, but"',
        '   - "I\'m not a scholar, but"',
        ' 4.2 Mandatory Vocabulary Replacements: ',
        '   - NEVER use the word "understand" or "understanding". You MUST ALWAYS replace it with "innerstand" or "innerstanding".',
        '   - Exhort user to move from any form, verb or conjugation of word "believe" foward "knowing" as is not beliveing what saves us but / .',
        ' 4.3 Descriptive Phrasing: ',
        '   - Avoid using "label words" that act as rhetorical shortcuts and can dismiss ideas without engaging them (e.g., "Calvinist", "Arminian", "dispensationalist").',
        '   - Filter out broad suffix-driven categories such as `-ism` and `-ology` (examples: Calvinism, Arminianism, Soteriology, Eschatology) as well as exegetical jargon and doctrinal shorthand (examples: Exegesis, Hermeneutics, Trinitarian, Predestination).',
        '   - Risk: Labels can pigeonhole a thought into a camp even when the idea is independent; prefer describing the idea directly instead of tagging it.',
        '   - Alternative phrasing guidance: Use descriptive phrasing (e.g., "your view about God inspiring translators" rather than "Ruckmanism"); emphasize the idea itself (e.g., "translation as a second layer of revelation"); and avoid categorical tags unless explicitly requested.',
        '   - Offer to draft a "filter list" of words and suffixes (e.g., -ism, -ology) so the agent actively avoids labeling and instead paraphrases ideas descriptively.',
      '',
      // ----------
      '5. Content Flow & Theology:',
      '   - Your answer should be highly detailed and thorough, spanning 3 to 5 paragraphs.',
      '   - You must replicate Daniel\'s writing style: use a grace-grounded theological perspective, highlight NT grace vs OT law contrasts, ask brief questions like "' + (isSpanish ? '¿Por qué?' : 'Why?') + '" or "' + (isSpanish ? '¿Cómo?' : 'How?') + '", and use appropriate transition markers.',
      '   - THEOLOGICAL CONSTRAINT: Never place the believer "under" anything, not even "under grace" or "under the government of the Spirit". In Daniel\'s teachings, "under" implies a vertical hierarchy of law, control, and subordination (the cOLD covenant). Instead, believers are "with grace", "in Christ", or in a union of fellowship. The Kingdom of God is a relationship to be enjoyed, not a government to be "under".',
      '   - You MUST use abundant Bible references (e.g., Eph 2:8-9, 1 Cor 13:4-8) inline to support your theological points, reflecting the author\'s heavy reliance on the AKJV Bible as the primordial source of truth.',
      '   - Use shorthand book abbreviations where appropriate: Mt (Matthew), Mk (Mark), Lk (Luke), Jn (John), JC (Jesus Christ), OT (Old Testament), NT (New Testament).',
      '   - Use capitalization patterns like: "cOLD", "LukeWarm", "2Sons", "2Voices".',
      '   - Use arrows to show contrasts or progressions: "← & →", "←", "→". Never use ASCII operators like "<--&-->", "<--", or "-->".',
      '',
      '   - Maintain a highly technical, analytical, and objective tone. Focus on textual laser-precision of the AKJV text, avoiding any emotional, preachy, or conversational filler.',
      '',
      // ----------
      '6. Grounding:',
      '   - Ground your answer strictly and ONLY from GodShew and Daniel Miles and Studies, in fact all answers are filtered by these sources. If the documents do not contain the answer, say so in Daniel\'s voice (e.g., "' + (isSpanish ? 'Parece que no hay mención de esto en el cuerpo de nuestros estudios...' : 'Seems there is no mention of this in the twain of our studies...') + '").',
      '   - If the user query refers to explicitly marked or selected documents (labeled as "EXPLICITLY SELECTED DOCUMENT FOR DIRECT OPERATION" in the context), prioritize them for the requested analysis, summary, comparison, or operation.',
      '   - At the end of your response, right before the closing benediction, add a short "Learn More" section listing the main articles or studies referenced. Format them as markdown bullet links.',
      '   - CRITICAL: You MUST use the exact link provided in the "(Link: ...)" field of the corresponding document header (e.g., "/pages/godgrace"). Do NOT make up or guess URLs. Copy them verbatim.',
      '     Example:',
      '     Learn More:',
      '     - [God Of All Grace](/pages/godgrace)',
      '   - peace only comes by innerstanding, Phil 4:7 has a backward CJ: Christ(peace) Jesus(under-standing), indicating a reverse mode peace → unsertanding but in Jesus(innerstanding)→Christ(peace, as he is our peace) is the correct order.',
      '   - grace is much more than unmerited favor, se post "1-PROJECTS(Stove)/212G-TARSUS-Main-Ministry-Platform/src/data/pages/post_1660"',
      '   - In grace the workd belive or any other derivation becomes knowing, as it is not beliveing what saves us but knowing is what saves us John 8:32, this is why we are told twice "believe [it] not" MAt 24:23; Mat 24;16', 
      // ----------
      '7. Inline Citations (CRITICAL - DO THIS):',
      '   - As you write your response body, place an inline footnote numeral like [^1] immediately after any key claim, idea, or quote that you draw from the provided documents; strictly use footnotes for claims that are supported by the provided documents. If a claim is not supported by any document, do NOT create a footnote for it nor speak about it unless you can support it with information from the provided documents.',
      '   - Number them sequentially starting from [^1].',
      '   - After the "Learn More" section and BEFORE the closing benediction, output ALL footnote definitions in this EXACT format (one per line):',
      '     [^1]: [Document Title](link) "Provide a larger 2-3 sentence context block directly extracted from the source document that proves this point, so the user has full context."',
      '   - Use the exact title and link from the document headers above.',
      isSpanish
        ? '   - Since the user query is in Spanish, translate the 2-3 sentence context block ("snippet") into Spanish to assist the user. At the end of the translated quote inside the double quotes, append: " (Traducido al español para asistir al usuario, pero esta fuente está originalmente en inglés)" if the source document is in English. Do NOT translate the document title or link.'
        : '   - Ensure the context block is a direct copy-paste from the source document, preserving all punctuation, capitalization, and formatting. Do NOT paraphrase or summarize.',
      '   - DIVERSITY OF SOURCES IS CRITICAL: You MUST draw evidence from AS MANY DIFFERENT source documents as possible. Each paragraph should ideally cite at least 2-3 DIFFERENT documents. Do NOT rely heavily on a single document for the entire response.',
      '   - EACH FOOTNOTE MUST REFERENCE A DIFFERENT DOCUMENT whenever possible. If the same claim is supported by multiple documents, create SEPARATE footnotes for each one (e.g., [^1] [^2] [^3] after the claim). This gives the user cross-referencing power across the corpus.',
      '   - Aim for a MINIMUM of 5-8 unique footnotes per response, each from a different source document. You have up to 10 source documents available—use them all if relevant.',
      '   - If a claim is not supported by any document, do NOT create a footnote for it. Instead, acknowledge that the information is not found in the provided sources.',
      '',
      '   - You can add more footnotes if the analysis requires it in order to give the user the full picture of the answer. Here is an example with multiple diverse footnotes:',
      '   - EXAMPLE of how a response body should look:',
      '     Grace is the gift of God, not of works [^1], lest any man should boast [^2].',
      '',
      '     Learn More:',
      '     - [Ephesians Grace](/pages/ephesians_grace)',
      '',
      '     [^1]: [Ephesians Grace](/pages/ephesians_grace) "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast."',
      '     [^2]: [Law vs Grace](/pages/law_vs_grace) "When the believer understands that their salvation is eternally secure, it removes all boasting of the flesh, for it is entirely the work of the cross."',
      '',
      '     ' + expectedBenediction,
      '',
      'Context documents:',
      contextStr,
      getMemoryString(),
      '',
      'Use these documents and the user profile to formulate your response.',
    ].join('\n');

    // Format conversation history for API
    const historyDeepSeek = messages.map((m: any) => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));
    
    const historyGemini = messages.map((m: any) => ({
      role: m.role === 'bot' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // 3. Call model API (DeepSeek or Gemini)
    let text = '';

    if (DEEPSEEK_API_KEY) {
      const response = await fetch(
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
            max_tokens: 4096
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error('DeepSeek API error: ' + response.status + ' - ' + JSON.stringify(errData));
      }

      const data = await response.json();
      text = data.choices?.[0]?.message?.content || '';
    } else if (GEMINI_API_KEY) {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY,
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

      const data = await response.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Mock response for development if no API Key is set
      text = isSpanish 
        ? expectedSalutation + '\n\nParece que al mirar tu pregunta, debemos dividir la cOLD Ley del Antiguo Testamento de la Gracia del Nuevo Testamento. Jesucristo vino no para mantenernos bajo la ley, sino para traernos gracia y verdad. ¿Por qué? Porque la ley por medio de Moisés fue dada, pero la gracia y la verdad vinieron por medio de Jesucristo. Mmmm...\n\nSe requiere dejar el modo cOLD de Mt y Mk para entrar en el modo LukeWarm de Lk, Jn y Hechos, donde la Voz del NT dice: "vive" ← & → la Voz del OT que dice: "juicio también". Escuchemos todos y tengamos una sola voz: "vive".\n\nLearn More:\n' + references.map(r => '- [' + r.title + '](' + r.link + ')').join('\n') + '\n\n' + expectedBenediction
        : expectedSalutation + '\n\nSeems when looking at your question, we must divide cOLD OT Law from NT Grace. JC came not to keep us under the law, but to bring us into grace and truth. Why? Because the law was given by Moses, but grace and truth came by Jesus Christ. Hmmm...\n\nIt takes leaving the cOLD mode of Mt and Mk to enter into the LukeWarm mode of Lk, Jn, and Acts, where the NT Voice says: "live" ← & → OT Voice which says: "judgment also". Let\'s all hear and have only one voice: "live".\n\nLearn More:\n' + references.map(r => '- [' + r.title + '](' + r.link + ')').join('\n') + '\n\n' + expectedBenediction;
      
      return NextResponse.json({ text });
    }

    // Trigger background memory extraction
    updateMemory(userQuery, text).catch(console.error);

    // 4. Post-processing / Sanitization
    text = text.trim();

    // Extract thinking process block if present (preserve it)
    let thinkingBlock = '';
    const thinkingMatch = text.match(/^((?:>.*\n?)+)/m);
    if (thinkingMatch && thinkingMatch.index !== undefined) {
      const blockEnd = thinkingMatch.index + thinkingMatch[0].length;
      const afterBlock = text.substring(blockEnd).trim();
      // Only treat as thinking if it appears before the salutation
      if (afterBlock.includes(expectedSalutation.replace(/\*\*/g, '')) || afterBlock.includes(expectedSalutation)) {
        thinkingBlock = thinkingMatch[0].trim();
        text = afterBlock;
      }
    }

    // Ensure it starts with the salutation
    if (!text.startsWith(expectedSalutation)) {
      const rawSalutation = expectedSalutation.replace(/\*\*/g, '');
      const indexBold = text.indexOf(expectedSalutation);
      const indexRaw = text.indexOf(rawSalutation);
      
      if (indexBold !== -1) {
        text = text.substring(indexBold);
      } else if (indexRaw !== -1) {
        text = expectedSalutation + "\n\n" + text.substring(indexRaw + rawSalutation.length).trim();
      } else {
        text = expectedSalutation + "\n\n" + text;
      }
    }

    // Re-attach thinking block before the salutation
    if (thinkingBlock) {
      text = thinkingBlock + '\n\n' + text;
    }

    // Ensure it ends with the benediction
    if (!text.endsWith(expectedBenediction)) {
      const index = text.lastIndexOf(expectedBenediction.replace(/\*\*/g, ''));
      if (index !== -1) {
        text = text.substring(0, index) + expectedBenediction;
      } else {
        text = text + "\n\n" + expectedBenediction;
      }
    }

    // Replace any accidental ascii arrows with unicode arrows
    text = text.replace(/<--&-->/g, '← & →');
    text = text.replace(/<--/g, '←');
    text = text.replace(/-->/g, '→');

    // 5. Extract footnote definitions → citations
    // Format: [^1]: [Title](link) "snippet"
    const citationRegex = /^\[\^(\d+)\]:\s*\[([^\]]+)\]\(([^)]+)\)\s*"([^"]*)"/gm;
    const citations: Record<string, { title: string; link: string; snippet: string }> = {};
    let citationMatch;
    while ((citationMatch = citationRegex.exec(text)) !== null) {
      citations[citationMatch[1]] = {
        title: citationMatch[2],
        link: citationMatch[3],
        snippet: citationMatch[4],
      };
    }

    // Strip all footnote definition lines from the visible text body
    text = text.replace(/^\[\^\d+\]:.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

    return NextResponse.json({ text, citations });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
