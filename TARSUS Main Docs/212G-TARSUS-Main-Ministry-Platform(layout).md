---
tags:
  - Project
Pillar: "[[GMP]]"
identifier: TARSUS
goal: Main ministry platform — curate Daniel Miles authorship corpus and power Tarsus (The Apostle), an AI-trained website grounded in his writings
date_limit:
created: 2026-06-28
modified: 2026-06-28
related:
  - "[[Daniel Miles]]"
  - "[[GMP Bible Study]]"
status: active
vault_root: "C:\\STORAGE\\G\\GodShew"
---

# 212G-TARSUS — Main Ministry Platform

## Source Corpus (read-only references — not moved)

| Source | Path | Scale |
|--------|------|-------|
| Posts archive | `3-RESOURCES(Pantry)/Daniel Miles/Daniel-Miles-Posts-Archive/` | 3,759 `.md` files, 2014–2025 |
| Emails | `3-RESOURCES(Pantry)/Daniel Miles/Dan Emails/` | 129 files (+ `Keepers but not for AI/`, `Accepted/`) |
| Misc studies | `3-RESOURCES(Pantry)/Daniel Miles/*.md` | ~10 standalone studies |
| Person card | `3-RESOURCES(Pantry)/Daniel Miles/Daniel Miles.md` | Founder GodShew.org |
| GodShew reference pages | `3-RESOURCES(Pantry)/GodShew/` | Style and doctrine reference for Tarsus |

---

## 1. Purpose and Principles

**Purpose:** Build the **212G TARSUS Main Ministry Platform** — curate the full Daniel Miles body of work (posts, emails, authorship docs) for GMP grace ministry, with the intention of producing AI embeddings for an app that personifies the author. The bot is called **The Apostle** (**Tarsus**); it answers with strict accuracy to the curated embeddings and source corpus.

**Principles:**
- **Integridad:** Unify the corpus without contradictions before scaling scope or features.
- **EES:** Eficaz toward the outcome (Tarsus + website), eficiente in curation workflow, suficiente without excess.
- **Source fidelity:** Tarsus is restricted to curated sources — no hallucination beyond embeddings.
- **Accessibility:** Readable worldwide; no one left behind.
- **Restraint:** Sober, essentialist design — clarity and depth in balance.

---

## 2. Outcome Vision

**Success looks like:** A complete, AI-organized authorship repository that lives in a TypeScript website (chat mode) with pages on the left pane.

**Website design:**
- Graceful: sober, essentialist, sufficient — power in all truth.
- Simple style yet profoundly informative and restrained.
- White background, Times New Roman font.
- Readable by all worldwide.
- Site map and sufficiently interconnected pages via wikilinks, similar to `3-RESOURCES(Pantry)/GodShew` pages.

**Tarsus (The Apostle):**
- Answers in the same style as Daniel Miles' original writings.
- Each response: 3–4 paragraphs with a **Learn More** button.
- Embedded URL pointers in responses so users can read further in the corpus.

**Additional site features:**
- Complete **AKJV** dynamic Bible in the left pane; Tarsus and pages can reference it.
- **The Mind of Christ** — Obsidian-style knowledge graph for page connections and navigation.
- Contact page: [YOUR PHONE], [YOUR CITY] (placeholders — fill in Phase 4).
- Dedicated testimony page.
- Donations link.
- Forum to talk and connect with people.
- Home logo/button so the user can return from anywhere on the site.

---

## 3. Brainstorming

### Ai Collaboration

**Corpus stats (seed):**
- 3,759 Facebook posts (2014–2025), scraped with frontmatter (circa_date, source, comments/shares).
- 129 email `.md` files; subfolders `Keepers but not for AI/` and `Accepted/` for triage.
- Standalone studies: Kingdoms, Bible CONTRASTS, JUDE's CONCLUSION, etc.

**Tarsus Chat Page:**
- NotebookLM-style chatbot trained and restricted to curated sources only.
- Example: User asks *"Why isn't Jesus Christ law, but grace and truth?"* → Tarsus answers in the style of documents in `3-RESOURCES(Pantry)/GodShew`.

**Curation workflow (proposed):**
1. Inventory and classify each source file (post, email, study).
2. AI-assisted manicure: normalize frontmatter, extract themes, tag law vs grace contrasts.
3. Exclude `Keepers but not for AI/` from embedding pipeline.
4. Generate embeddings per curated chunk; link chunks to canonical page URLs.
5. Human review gate before embedding commit.

**Tech stack (brainstorm):**
- TypeScript website (Next.js or similar).
- Vector store for embeddings; RAG pipeline for Tarsus.
- Wikilink parser for page interconnection.
- Graph view component for The Mind of Christ.

### Human Collaboration

- Confirm contact placeholders → actual phone and city.
- Approve curation criteria (what enters embeddings vs archive-only).
- Review Tarsus sample responses for voice fidelity.
- Decide forum platform and donations provider.
- Unlock Phase 4 (Organizing) before implementation begins.

---

## 4. Organizing

*Awaiting human collaboration — do not implement until Phases 1–3 are aligned.*

- [ ] Finalize information architecture (pages, nav, graph nodes).
- [ ] Define embedding schema and chunking rules.
- [ ] Map source paths → website URLs.
- [ ] Select tech stack and hosting.
- [ ] Organize curation batches (by year, theme, or source type).

---

## 5. Next Actions

*Human intelligence determines next action; AI assists.*

- [ ] Review and approve Phases 1–3 in this layout.
- [ ] Provide contact info (phone, city) to replace placeholders.
- [ ] Confirm first curation batch (e.g. `Accepted/` emails + top GodShew pages).
- [ ] Decide whether to create Todoist project for TARSUS.

---

## 6. Support

- **Support folder:** `1-PROJECTS(Stove)/212G-TARSUS-Main-Ministry-Platform/Support/`
- **Source corpus:** Remains in `3-RESOURCES(Pantry)/Daniel Miles/` — read-only; no moves until Organizing phase.
- **Reference:** [[Daniel Miles]], GodShew pantry pages, SCRAN archive (`.stversions` if needed).
- This programmer [mayooear](https://github.com/mayooear) made this similar project with different intention: [[4-ARCHIVES(Freezer)/M/Mayooear/ai-pdf-chatbot-langchain/README |AI PDF chatbot built with LangChain & LangGraph]]. The methodology seems quite old now, but a good reference to look at. 

---

*Project created: 2026-06-28*
*Pillar: G (GMP — grace ministry)*
*Identifier: TARSUS*
