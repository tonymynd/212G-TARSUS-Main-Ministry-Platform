import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const chatsDir = path.join(process.cwd(), 'src', 'data', 'chats');

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filePath = path.join(chatsDir, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const session = JSON.parse(raw);

    return NextResponse.json({ session });
  } catch (error: any) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filePath = path.join(chatsDir, `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
