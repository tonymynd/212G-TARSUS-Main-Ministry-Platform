import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  let filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 });
  }

  // Remove file:/// prefix if present
  if (filePath.startsWith('file:///')) {
    filePath = filePath.substring(8);
  }

  // Decode URI components
  filePath = decodeURIComponent(filePath);

  // Determine platform and execute open command
  const platform = process.platform;
  let command = '';

  if (platform === 'win32') {
    // Windows: use start
    command = `start "" "${filePath}"`;
  } else if (platform === 'darwin') {
    // macOS: use open
    command = `open "${filePath}"`;
  } else {
    // Linux: use xdg-open
    command = `xdg-open "${filePath}"`;
  }

  try {
    exec(command);
    return NextResponse.json({ success: true, message: 'Opening file...' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to open file', details: e.message }, { status: 500 });
  }
}
