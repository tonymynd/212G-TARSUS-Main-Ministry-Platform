import path from 'path';

const fs = require('fs');

export interface PageItem {
  id: string;
  title: string;
  group: string;
}

export function getPagesList(): PageItem[] {
  const pagesDir = path.join(process.cwd(), 'data', 'pages');
  if (!fs['existsSync'](pagesDir)) return [];

  const files = fs['readdirSync'](pagesDir) as string[];
  const pages: PageItem[] = [];

  for (const file of files) {
    if (file.endsWith('.md')) {
      const id = file.replace('.md', '');
      let title = id.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      
      let group = 'Other Studies';
      try {
        const content = fs['readFileSync'](pagesDir + '/' + file, 'utf-8');
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

export interface ResolvedPageData {
  id: string;
  title: string;
  content: string;
}

export function getPageData(slug: string): ResolvedPageData | null {
  const pagesDir = path.join(process.cwd(), 'data', 'pages');
  let filePath = pagesDir + '/' + slug + '.md';
  let resolvedSlug = slug;

  if (!fs['existsSync'](filePath)) {
    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!fs['existsSync'](pagesDir)) return null;
    const files = fs['readdirSync'](pagesDir) as string[];
    let found = false;

    // First pass: match normalized filename
    for (const file of files) {
      if (file.endsWith('.md')) {
        const fileBasename = file.replace('.md', '');
        const normalizedFile = fileBasename.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedFile === normalizedSlug || normalizedSlug.includes(normalizedFile) || normalizedFile.includes(normalizedSlug)) {
          filePath = pagesDir + '/' + file;
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
            const content = fs['readFileSync'](pagesDir + '/' + file, 'utf-8');
            const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
            if (fmMatch) {
              const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\n]+)["']?/m);
              if (titleMatch) {
                const title = titleMatch[1].trim();
                const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normalizedTitle.includes(normalizedSlug) || normalizedSlug.includes(normalizedTitle)) {
                  filePath = pagesDir + '/' + file;
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
      return null;
    }
  }

  try {
    const rawContent = fs['readFileSync'](filePath, 'utf-8');
    let title = resolvedSlug.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
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
    return { id: resolvedSlug, title, content: body };
  } catch (e) {
    return null;
  }
}

export function getMarkedPageContent(id: string): string | null {
  const pagesDir = path.join(process.cwd(), 'data', 'pages');
  const filePath = pagesDir + '/' + id + '.md';
  if (fs['existsSync'](filePath)) {
    try {
      return fs['readFileSync'](filePath, 'utf-8');
    } catch (e) {}
  }
  return null;
}
