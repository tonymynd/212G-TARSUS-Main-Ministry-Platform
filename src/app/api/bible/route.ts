import { NextResponse } from 'next/server';
import { lookupVerseRange } from '@/lib/bible';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const book = searchParams.get('book');
    const chapterStr = searchParams.get('chapter');
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');

    if (!book || !chapterStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const chapter = parseInt(chapterStr, 10);
    const start = startStr ? parseInt(startStr, 10) : undefined;
    const end = endStr ? parseInt(endStr, 10) : undefined;

    const verses = lookupVerseRange(book, chapter, start, end);
    return NextResponse.json({ verses });
  } catch (error) {
    console.error('Error fetching Bible verses:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
