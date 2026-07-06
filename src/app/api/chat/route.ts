import { NextResponse } from 'next/server';
import { searchCorpus } from '@/lib/search';
import fs from 'fs';
import path from 'path';
import { getMemoryString, updateMemory } from '@/lib/memory';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { messages, markedPageIds } = await req.json();
    if (!messages || !messages.length) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const userQuery = messages[messages.length - 1].content;

    // 1. Search RAG context
    const searchResults = searchCorpus(userQuery, 5);
    
    // Load explicitly marked documents
    let markedContextStr = '';
    const pagesDir = path.join(process.cwd(), 'src', 'data', 'pages');
    if (markedPageIds && Array.isArray(markedPageIds) && markedPageIds.length > 0) {
      markedPageIds.forEach((id) => {
        const filePath = path.join(pagesDir, `${id}.md`);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
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
      const basename = res.path.split(/[\\\/]/).pop()?.replace('.md', '') || '';
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
      '',
      '2. Opening: You MUST always start your response with exactly:',
      '"' + expectedSalutation + '"',
      '(Do not add any text before this. No "Sure!", "Here is what you asked:", or greeting variations).',
      '',
      '3. Closing: You MUST always close your response with exactly:',
      '"' + expectedBenediction + '"',
      '(Do not add any text after this, and it must be bolded).',
      '',
      '4. Content Flow & Theology:',
      '   - Your answer should be highly detailed and thorough, spanning 3 to 5 paragraphs.',
      '   - You must replicate Daniel\'s writing style: use a grace-grounded theological perspective, highlight NT grace vs OT law contrasts, ask brief questions like "' + (isSpanish ? '¿Por qué?' : 'Why?') + '" or "' + (isSpanish ? '¿Cómo?' : 'How?') + '", and use appropriate transition markers.',
      '   - THEOLOGICAL CONSTRAINT: Never place the believer "under" anything, not even "under grace" or "under the government of the Spirit". In Daniel\'s teachings, "under" implies a vertical hierarchy of law, control, and subordination (the cOLD covenant). Instead, believers are "with grace", "in Christ", or in a union of fellowship. The Kingdom of God is a relationship to be enjoyed, not a government to be "under".',
      '   - You MUST use abundant Bible references (e.g., Eph 2:8-9, 1 Cor 13:4-8) inline to support your theological points, reflecting the author\'s heavy reliance on the AKJV Bible as the primordial source of truth.',
      '   - Use shorthand book abbreviations where appropriate: Mt (Matthew), Mk (Mark), Lk (Luke), Jn (John), JC (Jesus Christ), OT (Old Testament), NT (New Testament).',
      '   - Use capitalization patterns like: "cOLD", "LukeWarm", "2Sons", "2Voices".',
      '   - Use arrows to show contrasts or progressions: "← & →", "←", "→". Never use ASCII operators like "<--&-->", "<--", or "-->".',
      '',
      '   - Maintain a highly technical, analytical, and objective tone. Focus on laser-precision exegesis of the AKJV text, avoiding any emotional, preachy, or conversational filler.',
      '5. Grounding:',
      '   - Ground your answer strictly and ONLY from GodShew and Daniel Miles and Studies, in fact all answers are filtered by these sources. If the documents do not contain the answer, say so in Daniel\'s voice (e.g., "' + (isSpanish ? 'Parece que no hay mención de esto en el cuerpo de nuestros estudios...' : 'Seems there is no mention of this in the twain of our studies...') + '").',
      '   - If the user query refers to explicitly marked or selected documents (labeled as "EXPLICITLY SELECTED DOCUMENT FOR DIRECT OPERATION" in the context), prioritize them for the requested analysis, summary, comparison, or operation.',
      '   - At the end of your response, right before the closing benediction, add a short "Learn More" section listing the main articles or studies referenced. Format them as markdown bullet links.',
      '   - CRITICAL: You MUST use the exact link provided in the "(Link: ...)" field of the corresponding document header (e.g., "/pages/godgrace"). Do NOT make up or guess URLs. Copy them verbatim.',
      '     Example:',
      '     Learn More:',
      '     - [God Of All Grace](/pages/godgrace)',
      '',
      '6. Inline Citations (CRITICAL - DO THIS):',
      '   - As you write your response body, place an inline footnote numeral like [^1] immediately after any key claim, idea, or quote that you draw from the provided documents.',
      '   - Number them sequentially starting from [^1].',
      '   - After the "Learn More" section and BEFORE the closing benediction, output ALL footnote definitions in this EXACT format (one per line):',
      '     [^1]: [Document Title](link) "Provide a larger 2-3 sentence context block directly extracted from the source document that proves this point, so the user has full context."',
      '   - Use the exact title and link from the document headers above.',
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
            model: 'deepseek-reasoner',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              ...historyDeepSeek
            ],
            max_tokens: 4096
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error('DeepSeek API error: ' + response.status + ' - ' + JSON.stringify(errData));
      }

      const data = await response.json();
      const messageObj = data.choices?.[0]?.message;
      let mainContent = messageObj?.content || '';
      const reasoningContent = messageObj?.reasoning_content || '';
      
      if (reasoningContent) {
        text = `> **Thinking Process:**\n> \n> ${reasoningContent.replace(/\n/g, '\n> ')}\n\n${mainContent}`;
      } else {
        text = mainContent;
      }
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
              maxOutputTokens: 8192,
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

    // Ensure it starts with the salutation (but after the thinking block if present)
    let thinkingBlock = '';
    let contentToProcess = text;
    
    const thinkingMatch = text.match(/^(> \*\*Thinking Process:\*\*\n(?:> .*\n)*\n)/);
    if (thinkingMatch) {
      thinkingBlock = thinkingMatch[1];
      contentToProcess = text.substring(thinkingBlock.length).trim();
    }

    if (!contentToProcess.startsWith(expectedSalutation)) {
      const rawSalutation = expectedSalutation.replace(/\*\*/g, '');
      const indexBold = contentToProcess.indexOf(expectedSalutation);
      const indexRaw = contentToProcess.indexOf(rawSalutation);
      
      if (indexBold !== -1) {
        contentToProcess = contentToProcess.substring(indexBold);
      } else if (indexRaw !== -1) {
        contentToProcess = expectedSalutation + "\n\n" + contentToProcess.substring(indexRaw + rawSalutation.length).trim();
      } else {
        contentToProcess = expectedSalutation + "\n\n" + contentToProcess;
      }
    }
    
    text = thinkingBlock + contentToProcess;

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
