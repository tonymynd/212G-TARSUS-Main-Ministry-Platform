import { notFound } from 'next/navigation';
import { listBooks } from '@/lib/bible';
import MainLayoutPage from '@/components/MainLayoutPage';
import { getPagesList, getPageData } from '@/lib/pages';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const pages = getPagesList();
  const books = listBooks();

  const pageData = getPageData(slug);
  if (!pageData) {
    notFound();
  }

  return (
    <MainLayoutPage
      initialPages={pages}
      initialBooks={books}
      pageId={pageData.id}
      pageTitle={pageData.title}
      pageContent={pageData.content}
    />
  );
}
