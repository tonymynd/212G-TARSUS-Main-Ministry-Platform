import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const chatsDir = path.join(process.cwd(), 'src', 'data', 'chats');

// Helper to ensure chats directory exists
function ensureChatsDir() {
  if (!fs.existsSync(chatsDir)) {
    fs.mkdirSync(chatsDir, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureChatsDir();
    const files = fs.readdirSync(chatsDir);
    const sessions = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(chatsDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);
          
          sessions.push({
            id: data.id || file.replace('.json', ''),
            title: data.title || 'Untitled Chat',
            updatedAt: data.updatedAt || fs.statSync(filePath).mtime.toISOString(),
          });
        } catch (e) {
          console.error(`Error reading session file ${file}:`, e);
        }
      }
    }

    // Sort by updatedAt descending
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error('Error listing sessions:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    ensureChatsDir();
    const { id, messages, title } = await req.json();

    if (!id || !messages) {
      return NextResponse.json({ error: 'Missing id or messages' }, { status: 400 });
    }

    // If no title is provided, try to generate one from the first user message
    let finalTitle = title;
    if (!finalTitle || finalTitle === 'Untitled Chat') {
      const firstUserMsg = messages.find((m: any) => m.role === 'user');
      if (firstUserMsg) {
        const text = firstUserMsg.content;
        // Basic fallback: slice the first 30 chars
        finalTitle = text.length > 35 ? text.substring(0, 35).trim() + '...' : text;
        
        // Try to generate a clean title using DeepSeek or Gemini if keys are present
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        
        if (DEEPSEEK_API_KEY) {
          try {
            const prompt = `Summarize this user question into a very short, concise 3-4 word title for a conversation history list. Do not use quotes or punctuation: "${text}"`;
            const deepseekRes = await fetch(
              'https://api.deepseek.com/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                  model: 'deepseek-chat',
                  messages: [
                    {
                      role: 'user',
                      content: prompt
                    }
                  ],
                  temperature: 0.1,
                  max_tokens: 15
                })
              }
            );
            if (deepseekRes.ok) {
              const deepseekData = await deepseekRes.json();
              const genTitle = deepseekData.choices?.[0]?.message?.content?.trim();
              if (genTitle) {
                finalTitle = genTitle.replace(/["']/g, ''); // strip quotes
              }
            }
          } catch (e) {
            console.error('Failed to auto-generate title with DeepSeek, using fallback:', e);
          }
        } else if (GEMINI_API_KEY) {
          try {
            const prompt = `Summarize this user question into a very short, concise 3-4 word title for a conversation history list. Do not use quotes or punctuation: "${text}"`;
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
                })
              }
            );
            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const genTitle = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (genTitle) {
                finalTitle = genTitle.replace(/["']/g, ''); // strip quotes
              }
            }
          } catch (e) {
            console.error('Failed to auto-generate title with Gemini, using fallback:', e);
          }
        }
      } else {
        finalTitle = 'Untitled Chat';
      }
    }

    const filePath = path.join(chatsDir, `${id}.json`);
    const sessionData = {
      id,
      title: finalTitle,
      messages,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');

    return NextResponse.json({ success: true, session: sessionData });
  } catch (error: any) {
    console.error('Error saving session:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
