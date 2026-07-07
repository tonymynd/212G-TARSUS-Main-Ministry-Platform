# Migration and Routing Fixes Journey

This document serves as a synthesis of the recent move of the TARSUS app into the Manifold-Grace (MG) directory structure and the comprehensive process of fixing the Markdown routing system.

## 1. Relocating into Manifold-Grace (MG)
The application was successfully migrated into the main `Manifold-Grace/1-PROJECTS(Stove)` folder to consolidate the ministry platform. 
During this move, the development environment encountered a severe Next.js Turbopack crash (`FATAL: An unexpected Turbopack error occurred. Next.js package not found`). 
*   **The Cause:** Turbopack has a known bug in Next.js 16 on Windows where it misidentifies the project root if the `.next` cache is stale after moving directories, or if it encounters unexpected lockfiles. Because the directory path changed during the move to MG, Turbopack panicked.
*   **The Fix:** We completely cleared the `.next` build cache directory and forcefully restarted the Next.js dev server. This successfully reset the Turbopack cache and bound the app cleanly to port 3000.

## 2. Fixing the Markdown Routing Engine
The TARSUS platform relies heavily on parsing AI-generated Markdown (both inline links and footnotes). The transition uncovered several critical edge cases in `MarkdownBibleRenderer.tsx` that broke page navigation:

### A. Absolute vs. Internal URLs
*   **The Issue:** The AI frequently generated absolute URLs pointing to `http://godshew.org/` or `https://www.godshew.org/`. 
*   **The Fix:** We updated the Markdown parser to intercept any URLs matching `godshew.org`, strip the absolute domain, and treat them as internal links so they load locally within the app rather than redirecting the user to the live web.

### B. Standardizing Slugs
*   **The Issue:** Markdown links and Wikilinks often included raw filenames (e.g., `[Title](file_name.md)`), which Next.js couldn't resolve without the `/pages/` prefix.
*   **The Fix:** We implemented a `sanitizedSlug` generator that lowercases filenames, removes special characters, and replaces spaces/slashes with underscores. We then automatically prepended `/pages/` to ensure Next.js App Router could catch and render them.

### C. Resolving the "Double Slug" (Infinite Back Loop) Bug
*   **The Issue:** When clicking links under the "Learn More" section, the browser would hit "back" uncontrollably or crash. This occurred because the AI learned to pre-pend `/pages/` to its generated links. When the Markdown parser received a link like `[Title](/pages/article_name)`, the sanitizer replaced the forward slash with an underscore, mutating the URL into `/pages/_pages_article_name`. This caused Next.js to hit a 404 state.
*   **The Fix:** We updated both the `CitationBadge` component and the standard Markdown link parser to explicitly check `if (targetSlug.startsWith('/pages/'))`. If the prefix already exists, the parser bypasses the sanitization step and routes the user exactly to the intended destination.

### D. Local File Opening
*   **The Issue:** Links pointing to local files on the user's hard drive (e.g., `file:///C:/...`) would not open in the browser due to security sandboxing.
*   **The Fix:** We built a local file bypass using an `onClick` handler that intercepts `file://` links and sends them to the `/api/open-local` endpoint, allowing users to seamlessly open external documents without leaving the app context.

---

**Outcome:** The application is now stably housed within the MG ecosystem, and the custom markdown routing engine can flawlessly handle Wikilinks, footnotes, relative paths, and AI-generated "Learn More" external/internal hybrid links.
