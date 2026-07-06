import fs from 'fs';
import path from 'path';

const memoryPath = path.join(process.cwd(), 'src', 'data', 'long_term_memory.json');

interface Memory {
  user_name: string;
  core_interests: string[];
  key_mentions: string[];
  last_updated: string;
}

const defaultMemory: Memory = {
  user_name: "Antonio",
  core_interests: [],
  key_mentions: [],
  last_updated: new Date().toISOString(),
};

export function getMemoryString(): string {
  if (!fs.existsSync(memoryPath)) {
    return "";
  }
  try {
    const mem: Memory = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
    let out = "\n--- USER PROFILE & LONG-TERM MEMORY ---\n";
    if (mem.user_name) out += `User Name: ${mem.user_name}\n`;
    if (mem.core_interests && mem.core_interests.length > 0) out += `Core Interests: ${mem.core_interests.join(', ')}\n`;
    if (mem.key_mentions && mem.key_mentions.length > 0) {
      out += `Key Facts Remembered:\n`;
      mem.key_mentions.forEach(m => out += `- ${m}\n`);
    }
    out += "---------------------------------------\n\n";
    return out;
  } catch (e) {
    console.error("Error reading memory", e);
    return "";
  }
}

export async function updateMemory(userQuery: string, botResponse: string) {
  // Read current memory
  let mem: Memory = defaultMemory;
  if (fs.existsSync(memoryPath)) {
    try {
      mem = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
    } catch (e) {}
  }

  const systemPrompt = `You are a background memory-extraction agent for Tarsus.
Your job is to read the latest exchange between the User (Antonio) and Tarsus, and extract any new permanent facts about the user.
Current Memory:
${JSON.stringify(mem, null, 2)}

Instructions:
1. If the user mentions a new interest (e.g., a specific theological topic), add it to core_interests.
2. If the user mentions a new personal fact (e.g., "I have a brother", "I live in X"), add it to key_mentions.
3. Return ONLY a valid JSON object matching the exact keys: "user_name", "core_interests", "key_mentions".
4. Do not delete existing facts unless they are explicitly contradicted.`;

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) return;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `System: ${systemPrompt}\n\nUser: ${userQuery}\n\nTarsus: ${botResponse}` }]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        const newMem = JSON.parse(text);
        newMem.last_updated = new Date().toISOString();
        
        // Ensure data directory exists
        const dir = path.dirname(memoryPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(memoryPath, JSON.stringify(newMem, null, 2));
      }
    }
  } catch (e) {
    console.error("Error updating memory:", e);
  }
}
