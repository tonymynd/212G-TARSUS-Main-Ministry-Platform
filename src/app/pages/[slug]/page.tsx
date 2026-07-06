import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import { listBooks } from '@/lib/bible';
import MainLayoutPage from '@/components/MainLayoutPage';

interface PageItem {
  id: string;
  title: string;
  group: string;
}

function getPagesList(): PageItem[] {
  const pagesDir = path.join(process.cwd(), 'src', 'data', 'pages');
  if (!fs.existsSync(pagesDir)) return [];

  const files = fs.readdirSync(pagesDir);
  const pages: PageItem[] = [];

  for (const file of files) {
    if (file.endsWith('.md')) {
      const id = file.replace('.md', '');
      let title = id.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      let group = 'Other Studies';
      try {
        const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
        const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (fmMatch) {
          const fmText = fmMatch[1];
          const titleMatch = fmText.match(/^title:\s*["']?([^"'\n]+)["']?/m);
          if (titleMatch) title = titleMatch[1].trim();
          
          const pathMatch = fmText.match(/^original_path:\s*["']?([^"'\n]+)["']?/m);
          if (pathMatch) {
            const origPath = pathMatch[1];
            if (origPath.includes('Social-Media-Captures')) group = 'Social Media Captures';
            else if (origPath.includes('Dan Emails')) group = "Dan's Emails";
            else if (origPath.includes('ABOVE all these things put on charity')) group = 'ABOVE All These Things';
            else if (origPath.includes('Daniel-Miles-Posts-Archive')) group = 'Daniel Miles Posts Archive';
            else if (origPath.includes('GodShew')) group = 'GodShew';
          }
        }
      } catch (e) {}
      pages.push({ id, title, group });
    }
  }
  return pages.sort((a, b) => a.title.localeCompare(b.title));
}

// reFindTitle removed as logic is now inline

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const pages = getPagesList();
  const books = listBooks();

  const pagesDir = path.join(process.cwd(), 'src', 'data', 'pages');
  let filePath = path.join(pagesDir, `${slug}.md`);
  let resolvedSlug = slug;

  if (!fs.existsSync(filePath)) {
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const files = fs.readdirSync(pagesDir);
    let found = false;

    // First pass: match normalized filename
    for (const file of files) {
      if (file.endsWith('.md')) {
        const fileBasename = file.replace('.md', '');
        const normalizedFile = fileBasename.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedFile === normalizedSlug || normalizedSlug.includes(normalizedFile) || normalizedFile.includes(normalizedSlug)) {
          filePath = path.join(pagesDir, file);
          resolvedSlug = fileBasename;
          found = true;
          break;
        }
      }
    }

    // Second pass: match YAML frontmatter title
    if (!found) {
      for (const file of files) {
        if (file.endsWith('.md')) {
          const fileBasename = file.replace('.md', '');
          try {
            const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');
            const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
            if (fmMatch) {
              const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\n]+)["']?/m);
              if (titleMatch) {
                const title = titleMatch[1].trim();
                const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normalizedTitle.includes(normalizedSlug) || normalizedSlug.includes(normalizedTitle)) {
                  filePath = path.join(pagesDir, file);
                  resolvedSlug = fileBasename;
                  found = true;
                  break;
                }
              }
            }
          } catch (e) {}
        }
      }
    }

    if (!found) {
      notFound();
    }
  }

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let title = resolvedSlug.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let body = rawContent;

  const fmMatch = rawContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (fmMatch) {
    const fmText = fmMatch[1];
    const titleMatch = fmText.match(/^title:\s*["']?([^"'\n]+)["']?/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
    body = rawContent.substring(fmMatch[0].length);
  }

  return (
    <MainLayoutPage
      initialPages={pages}
      initialBooks={books}
      pageId={resolvedSlug}
      pageTitle={title}
      pageContent={body}
    />
  );
}
