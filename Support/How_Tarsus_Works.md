# How TARSUS Works: Architecture and Pipeline

TARSUS is a serverless dynamic web application built with **Next.js**, **React**, and **TypeScript**, serving as an interactive search, chat, and explorer platform for the Daniel Miles ministry materials.

Here is a visual and step-by-step map explaining how Tarsus runs and processes queries.

---

## 1. System Architecture Map (Mermaid)

```mermaid
flowchart TD
    subgraph Ingestion Pipeline (Offline Sync)
        A["Pantry Folders (Studies, Emails, Posts, Charity)"] -->|1. copy_and_prepare_pages.py| B["src/data/pages/*.md (Unified Web Pages)"]
        B -->|2. index_corpus.py| C["src/data/search_index.json (TF-IDF Index)"]
        D["Pantry (kjv-bible-blb)"] -->|3. parse_bible_pantry.py| E["src/data/bible.json (Structured KJV)"]
    end

    subgraph Chat & Query Pipeline (Runtime RAG)
        User["User Question (English or Spanish)"] -->|4. Chat Input Form| ChatAPI["POST /api/chat"]
        ChatAPI -->|5. searchCorpus()| BM25["BM25 TF-IDF Search"]
        C --> BM25
        BM25 -->|6. Retrieve top 5 matches| ContextBuilder["Extract Document Context & Links"]
        ContextBuilder -->|7. Formulate systemPrompt| LLMRouter["Model API Router (DeepSeek or Gemini)"]
        LLMRouter -->|8. Model Completion| PostProcessor["Sanitizer & Post-Processor"]
        PostProcessor -->|9. Enforce Salutation, Benediction & Arrows| ClientView["Chat History View"]
    end

    subgraph Rendering & Interaction Pipeline (Client UI)
        ClientView -->|10. MarkdownBibleRenderer| MD["Markdown parser (bold, lists, links)"]
        MD -->|11. BibleRefRenderer| RegexScanner["Scans for scripture links (e.g. Rom 4:15)"]
        E -->|12. GET /api/bible| Popover["BiblePopoverLink (Hover Tooltip)"]
        RegexScanner --> Popover
        Popover -->|13. Click Event| ContextNav["BibleNavigationProvider"]
        ContextNav -->|14. Switch Tab & Select Chapter| BibleExplorer["Middle Sidebar Tab (Read Chapter)"]
    end
```

---

## 2. Step-by-Step Pipeline Explanation

### A. The Syncing Process (Ingestion)
1. **Source Compilation**: Standalone studies, email archives, posts, and the massive *ABOVE all these things put on charity* folders inside the Pantry are processed by `copy_and_prepare_pages.py`. Filenames are cleaned into lowercased web slugs, classification frontmatter (`type: study/post/email`) is prepended, and the files are copied into `src/data/pages/`.
2. **Search Indexing**: `index_corpus.py` parses these markdown pages, filters out stopwords, calculates term frequencies, compiles Inverse Document Frequencies (IDF), and writes out `src/data/search_index.json` containing **8,123 indexed documents**.
3. **Bible Ingestion**: `parse_bible_pantry.py` parses the structured KJV book files from the pantry into a unified `bible.json` database.

### B. Chat & Retrieval-Augmented Generation (RAG)
4. **Query Input**: The user writes a message (e.g. in Spanish or English) and sends it.
5. **Context Lookup**: The server retrieves the top 5 most relevant documents from the local `search_index.json` using BM25 relevance scoring.
6. **Link Injection**: The router creates clean relative links (like `/pages/godgrace`) and attaches them to the header of each document in the prompt, telling the AI exactly what links to copy.
7. **Model Selection**: If `DEEPSEEK_API_KEY` is present in `.env.local`, the server issues an OpenAI-compatible request to DeepSeek Chat. Otherwise, it defaults to the Gemini 2.5 Flash API.
8. **Fidelity Post-Processing**: The generated text is trimmed and verified:
   - Sanitizes arrows (`←`, `→`).
   - Validates that it starts with the correct salutation and ends with the bold benediction (detecting and serving Spanish translations if the query was in Spanish).

### C. Client Rendering & Navigation
9. **Markdown Processing**: The chat bubble renders text using `<MarkdownBibleRenderer>` which handles bold tags `**...**`, bullet points, and markdown links (Next.js `<Link>` transitions).
10. **Bible Tooltips**: Non-link sections are scanned by `<BibleRefRenderer>` using a regex pattern. Any matched bible citation is wrapped in `<BiblePopoverLink>`. Hovering over a link fetches the exact KJV verse from `/api/bible` and shows it in a hover card.
11. **Sidebar Navigation**: Clicking on the scripture reference calls `navigateToBible()` via the React `BibleNavigationProvider` context. This switches the active left sidebar tab to the **Bible tab** (middle) and updates the book/chapter selectors to let the user read the full context instantly.
