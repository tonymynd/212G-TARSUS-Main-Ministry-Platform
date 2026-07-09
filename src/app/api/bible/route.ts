import { NextResponse } from 'next/server';
import { lookupVerseRange, type BibleVersion, BIBLE_VERSIONS } from '@/lib/bible';

const VALID_VERSIONS = new Set(Object.keys(BIBLE_VERSIONS));

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const book = searchParams.get('book');
    const chapterStr = searchParams.get('chapter');
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const versionParam = searchParams.get('version') ?? 'kjv';
    const version = VALID_VERSIONS.has(versionParam)
      ? (versionParam as BibleVersion)
      : 'kjv';

    if (!book || !chapterStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const chapter = parseInt(chapterStr, 10);
    const start = startStr ? parseInt(startStr, 10) : undefined;
    const end = endStr ? parseInt(endStr, 10) : undefined;

    const verses = lookupVerseRange(book, chapter, start, end, version);
    return NextResponse.json({ verses, version });
  } catch (error) {
    console.error('Error fetching Bible verses:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
