import { listBooks } from '@/lib/bible';
import MainLayout from '@/components/MainLayout';
import { getPagesList } from '@/lib/pages';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const pages = getPagesList();
  const books = listBooks();
  
  return <MainLayout initialPages={pages} initialBooks={books} />;
}
