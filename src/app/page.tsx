import fs from 'fs';
import path from 'path';
import { listBooks } from '@/lib/bible';
import MainLayout from '@/components/MainLayout';

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
      
      // Try to read frontmatter
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
      } catch (e) {
        // Fallback to file title
      }
      
      pages.push({ id, title, group });
    }
  }

  // Sort by title alphabetically
  return pages.sort((a, b) => a.title.localeCompare(b.title));
}

// reFindTitle removed as logic is now inline

export default async function Home() {
  const pages = getPagesList();
  const books = listBooks();
  
  return <MainLayout initialPages={pages} initialBooks={books} />;
}
