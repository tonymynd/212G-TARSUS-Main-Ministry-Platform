# PLAN — Improve Tarsus Output Quality

> **Executor:** Google Antigravity AI Agent (Gemini-based).
> **Repo root:** `C:\STORAGE\M\Manifold-Grace\1-PROJECTS(Stove)\212G-TARSUS-Main-Ministry-Platform`
> **Created:** 2026-07-13 by Claude Code (orchestrator) after direct codebase analysis.
> **Execution model:** Run phases **consecutively, each in a fresh context**. Every phase is self-contained: it names the files to read first, what to change, how to verify, and what NOT to do. Do not skip the "Read first" list — never edit a file you have not read in the current session.

---

## Phase 0 — System Map & Ground Truth (READ-ONLY; consolidated findings)

This phase is already done (findings below). The executing agent must still **re-read the cited files** at the start of every implementation phase to confirm line numbers, since they may drift.

### 0.1 What Tarsus is

Tarsus ("The Apostle") is a RAG chatbot in a Next.js 16 App Router app (`package.json`: next 16.2.10, react 19.2.4, TypeScript, no test framework installed). It answers questions grounded in the Daniel Miles authorship corpus, emulating his terse, aphoristic writing voice, with strict output contracts (fixed salutation/benediction, inline `[^N]` footnotes, "Learn More" links).

### 0.2 Pipeline (all in `src/app/api/chat/route.ts`, ~515 lines)

1. **Language detection** — regex word-count heuristic, lines 21–25 (`isSpanish`).
2. **Spanish→English query expansion** — hardcoded ~60-entry glossary object inline, lines 32–107.
3. **Retrieval** — primary: spawns `python src/lib/search_palace.py <query> 10` (MemPalace hybrid search, returns JSON `{results: [{room, source_file, text, similarity}]}`). Fallback on any error: local BM25 via `searchCorpus()` in `src/lib/search.ts` (index at `src/data/search_index.json`, 5,219 docs). Lines 109–155.
4. **Context assembly** — marked documents (user-pinned pages) + search results concatenated as `--- DOCUMENT: <title> (Link: /pages/<basename>) (Source: <type>) ---\n<content>`. Lines 163–196.
5. **System prompt** — one giant inline string array, lines 208–356. Contains voice sample, style constraints, theology constraints, grounding rules, footnote-format contract.
6. **LLM call** — DeepSeek `deepseek-chat` (temperature 0.2, max_tokens 4096) if `DEEPSEEK_API_KEY` set, else Gemini `gemini-2.5-flash` (temperature 0.2, maxOutputTokens 12288) if `GEMINI_API_KEY` set, else a mock response. Lines 369–438.
7. **Post-processing** — enforce salutation prefix / benediction suffix, preserve "Thinking Process" blockquote, replace ASCII arrows with `←`/`→`, extract footnote definitions matching `^\[\^(\d+)\]:\s*\[([^\]]+)\]\(([^)]+)\)\s*"([^"]*)"` into a `citations` object, strip them from body. Lines 443–510.
8. **Response contract** — `{ text: string, citations: Record<string, {title, link, snippet}> }`, consumed by `src/components/MainLayout.tsx:352` and rendered by `src/components/MarkdownBibleRenderer.tsx` (inline `[^N]` → popover via `citations` map). **This JSON shape must never change.**

Supporting libs: `src/lib/pages.ts` (page resolution — corpus root is `data/pages/`, 5,220 `.md` files), `src/lib/memory.ts` (long-term user memory, Gemini-only extraction), `src/lib/search.ts` (BM25).

### 0.3 Confirmed defects and quality gaps (evidence-based)

| # | Defect | Evidence |
|---|--------|----------|
| D1 | **Wrong corpus path for MemPalace results.** `route.ts:134` and `:138` build `path.join(cwd,'src','data','pages', r.source_file)` — that directory **does not exist** (0 files). Real corpus: `data/pages/` (5,220 files). Currently only the basename survives into links, masking the bug, but any future code reading `res.path` breaks, and `godshew_original` room links get basenames that may not resolve to a page. | `ls src/data` shows no `pages/`; `pages.ts:12` uses `data/pages` |
| D2 | **No validation that mandatory style rules were followed.** Latest stored session (`src/data/chats/session_1783839432737.json`, last bot message, 8,735 chars) contains **0 arrow characters** despite "ARROWS ARE MANDATORY" (route.ts:282), reads as smooth essay commentary (violating the staccato register and the 4-consecutive-sentence guardrail, route.ts:301–305), and its "Learn More" list links two different titles to the same page (`/pages/post_1315`). | direct inspection |
| D3 | **No citation fidelity check.** Footnote snippets are supposed to be verbatim extracts (route.ts:333) and links must be copied from document headers (route.ts:317), but nothing verifies the snippet exists in the source document or that the link resolves. Hallucinated quotes/links pass through silently. | route.ts:494–509 only parses format |
| D4 | **System prompt is monolithic, typo-ridden, and self-contradictory.** Examples: "workd belive" / "beliveing" (route.ts:265, :323), "differnt", "imposible" (:309), duplicate believe→knowing rule stated at :265 and :323, stray vault-relative path in a prompt rule (:322), an instruction addressed to the prompt author not the model (:271 "Offer to draft a filter list…"). Typos degrade instruction-following and waste tokens. | route.ts:208–356 |
| D5 | **Fragile language detection.** Word-regex count (route.ts:21–25) misfires on short/mixed queries ("no" and "es" are Spanish matches; "que" appears in French/Portuguese; a 2-word English query with "no" can flip to Spanish). | route.ts:21–25 |
| D6 | **Context budget is uncontrolled.** BM25 fallback returns **entire file bodies** for 10 docs (`search.ts:101–121`) — can exceed model context. MemPalace path returns only small chunk text — may be too thin for verbatim 2–3 sentence footnote snippets. No per-document dedup: 10 chunks can come from 1–2 documents, defeating the "diversity of sources" rule (route.ts:334–336). | search.ts, route.ts |
| D7 | **No evaluation harness.** There is no way to measure whether any change improves output. "Improve output" is unverifiable without one — build it first-class. | no test/eval scripts in `package.json` |
| D8 | **Inconsistent model params.** DeepSeek max_tokens 4096 vs Gemini 12288; long responses on DeepSeek risk truncation *before* the mandatory benediction, which post-processing then fabricates by appending — silently corrupting output. | route.ts:391, :418 |

### 0.4 Allowed APIs (do not deviate)

- **DeepSeek**: `POST https://api.deepseek.com/v1/chat/completions`, body keys exactly as at route.ts:381–392 (`model`, `messages`, `temperature`, `max_tokens`). Add nothing else.
- **Gemini**: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`, body keys as at route.ts:411–420 (`systemInstruction.parts[].text`, `contents`, `generationConfig.temperature`, `generationConfig.maxOutputTokens`).
- **MemPalace**: only via `execFile('python', [scriptPath, query, '10'], {env: {...process.env, PYTHONUTF8:'1'}})` as at route.ts:116. The script's CLI is `search_palace.py <query> [n_results]`; output JSON has `results[].{room, source_file, text, similarity}`. **Do not add CLI flags that don't exist in `src/lib/search_palace.py`.**
- **Node/Next**: `NextResponse.json(...)` only; the route is a plain POST handler.
- **Filesystem truth**: corpus pages = `data/pages/*.md` (YAML frontmatter with `title:`); resolution helpers already exist in `src/lib/pages.ts` (`getPageData`, `getMarkedPageContent`) — reuse them, do not write new resolvers.

### 0.5 Global anti-pattern guards (apply to every phase)

- **Never change the response JSON shape** `{text, citations}` or the footnote definition line format `[^N]: [Title](link) "snippet"` — the frontend parses both.
- **Never change the exact salutation/benediction strings** (route.ts:199–205) — post-processing and stored sessions depend on them.
- **No new npm dependencies** unless a phase explicitly says so (there are none planned). No LangChain, no SDK clients — raw `fetch` is the established pattern.
- **Windows environment**: paths via `path.join`, Python invoked as `python`, shell verification commands must be PowerShell-compatible.
- **Do not touch** `src/data/chats/*` (user history), `data/pages/*` (corpus), `src/data/search_index.json` (generated), `GodShew_Original/` (source archive).
- **Mock mode is the test harness**: with no `DEEPSEEK_API_KEY`/`GEMINI_API_KEY` env vars, the route returns a mock response (route.ts:432–438) — retrieval, context assembly, and reference building still run for real. Use it to test the pipeline without burning API credits, but note mock mode returns early and skips post-processing.

---

## Phase 1 — Evaluation Harness First (measure before changing)

**Goal:** A repeatable script that scores Tarsus responses against the output contract, so every later phase can prove improvement. Without this, "improved output" is opinion.

**Read first:** `src/app/api/chat/route.ts` (full), `package.json`, one stored session, e.g. `src/data/chats/session_1783839432737.json` (to see real response shape).

**Implement:**

1. Create `Support/eval/golden_questions.json` — 15 English + 8 Spanish questions drawn from corpus themes (law vs grace, 2Sons, 2Voices, LukeWarm, kingdom, resurrection, prayer, covenants, grace vs unmerited favor, Phil 4:7 CJ ordering). Each entry: `{ "id": "en-01", "lang": "en", "question": "..." }`.
2. Create `Support/eval/eval_tarsus.mjs` (plain Node, ESM, no deps) that:
   - POSTs each question to `http://localhost:3000/api/chat` with body `{ messages: [{role:'user', content: q}] }`;
   - scores each response on **mechanical rubric checks** (each pass/fail, then aggregate 0–100 per response):
     - R1 starts with exact expected salutation (Spanish or English per question `lang`);
     - R2 ends with exact expected benediction;
     - R3 contains ≥1 `→` or `←` character (arrow rule);
     - R4 contains ≥2 signature wordplay terms from the list: `f-laws`, `ear what`, `LukeWarm`, `2Sons`, `2Voices`, `2Covenants`, `cOLD`, `innerstand`, `innerstood`, `lawful-awful`;
     - R5 zero banned phrases (`I think`, `I believe`, `In my opinion`, …, full list at route.ts:249–260) and — English only — zero occurrences of standalone `understand`/`understanding`;
     - R6 ≥5 distinct citation numbers in `citations` object AND ≥3 distinct `link` values among them;
     - R7 every `citations[*].link` and every "Learn More" link resolves: strip `/pages/` prefix and check `getPageData(slug)`-style resolution (reimplement minimally in the script: exact file `data/pages/<slug>.md` OR normalized-name match, copying the normalization at `src/lib/pages.ts:61`);
     - R8 no paragraph with >4 consecutive sentences without a bullet/arrow/standalone-scripture line (approximate: flag paragraphs of ≥6 sentences);
     - R9 Spanish questions answered in Spanish (heuristic: response contains ≥3 of `el|la|los|de|que|gracia|vosotros`), English in English;
     - R10 zero doctrinal "under" violations: response body does not contain `under grace` / `bajo la gracia` (route.ts:277).
   - writes `Support/eval/results/<timestamp>.json` with per-question scores and a summary table to stdout.
3. Add npm script: `"eval": "node Support/eval/eval_tarsus.mjs"` to `package.json`.
4. Run the baseline against the dev server (`npm run dev`, then `npm run eval`) **with real API keys if present in `.env.local`; otherwise record mock-mode limitations in the results file header**. Commit the baseline results file.

**Verify:**
- [ ] `npm run eval` completes, prints a summary table, writes a results JSON.
- [ ] Baseline scores recorded (expect failures on R3/R4/R8 given defect D2 — that is the point).
- [ ] `git diff package.json` shows only the added script.

**Anti-pattern guards:** No test framework install (no jest/vitest). No LLM-as-judge in this phase — mechanical checks only, deterministic. Do not modify `route.ts` in this phase.

---

## Phase 2 — Retrieval Correctness & Source Diversity

**Goal:** Fix D1 (wrong path), D6 (context budget & diversity) so the model receives correct, diverse, budget-bounded context with valid links.

**Read first:** `src/app/api/chat/route.ts:109–196`, `src/lib/search.ts` (full), `src/lib/pages.ts` (full), `src/lib/search_palace.py` (full).

**Implement (all in `route.ts` unless noted):**

1. **Fix path mapping (D1).** In the MemPalace result mapping (route.ts:131–150), map `room === 'data'` (and default) to `path.join(process.cwd(), 'data', 'pages', r.source_file)` — copy the directory convention from `src/lib/pages.ts:12`. Leave the `godshew_original` mapping as-is.
2. **Per-document dedup + diversity.** After mapping (and after the JSON filter at :158–161), group results by `source_file`; keep at most 2 chunks per document, concatenating their `text` when from the same document; then take the top 8 distinct documents by best `score`. This directly serves the prompt's "DIVERSITY OF SOURCES" requirement (route.ts:334–336).
3. **Context budget.** Cap each document's contributed content at 4,000 characters (truncate at a sentence boundary, append `[...truncated]`), and cap total `contextStr` at 60,000 characters, dropping lowest-scored documents first. Apply the same 4,000-char per-doc cap to the BM25 fallback results (which currently return whole files) — cap in `route.ts` after `searchCorpus()` returns, not inside `search.ts`.
4. **Enrich thin chunks.** If a MemPalace chunk's `text` is < 700 chars and the mapped file exists, read the full file (reuse the frontmatter-stripping pattern from `search.ts:104–109`) and use up to the 4,000-char cap centered on... **do not implement fuzzy centering** — simply use the first 4,000 chars of the body plus the chunk text if the chunk isn't contained in that window. Keep it simple and deterministic.
5. **Link validity at the source.** When building `references` (route.ts:190–196), verify the basename resolves to a real page: `fs.existsSync(path.join(cwd,'data','pages', basename + '.md'))`. If not, attempt the normalized match reusing `getPageData(basename)` from `src/lib/pages.ts` (already imported module) and use its resolved `id` for the link. If still unresolved, keep the document in context but mark its header `(Link: NONE — do not cite this document in Learn More or footnotes)` and exclude it from `references`.

**Verify:**
- [ ] `npm run build` passes (or `npx tsc --noEmit`).
- [ ] Temporarily log `contextStr.length` and distinct-document count for the query `two sons law grace` via dev server + PowerShell: `Invoke-RestMethod -Uri http://localhost:3000/api/chat -Method Post -ContentType 'application/json' -Body '{"messages":[{"role":"user","content":"two sons law grace"}]}'` — confirm ≥5 distinct documents, total context ≤60k chars, then remove the logs.
- [ ] `grep -n "src', 'data', 'pages'" src/app/api/chat/route.ts` returns nothing (PowerShell: `Select-String "'src', 'data', 'pages'" src/app/api/chat/route.ts`).
- [ ] Run `npm run eval`; R6/R7 should improve or hold vs baseline. Save results.

**Anti-pattern guards:** Do not modify `search_palace.py` CLI or `search.ts` scoring. Do not add embeddings/vector libraries. Do not change the `--- DOCUMENT: ... ---` header format except the specified `(Link: NONE ...)` variant.

---

## Phase 3 — System Prompt Refactor (fidelity, not rewrite)

**Goal:** Fix D4 and D5. Same rules, cleanly organized, typo-free, deduplicated, in a maintainable module — measurably better instruction-following, zero contract changes.

**Read first:** `src/app/api/chat/route.ts:198–356` (the whole prompt), `src/data/pages/post_1660.md` if it exists (referenced by the grace rule at :322).

**Implement:**

1. Create `src/lib/prompt.ts` exporting `buildTarsusSystemPrompt(opts: { isSpanish: boolean; contextStr: string; memoryStr: string; expectedSalutation: string; expectedBenediction: string }): string`.
2. Move the prompt content there, restructured into clearly delimited sections with headers the model parses well: `## IDENTITY`, `## VOICE SAMPLE`, `## LANGUAGE`, `## OUTPUT STRUCTURE` (thinking block → salutation → body → Learn More → footnote definitions → benediction, in order), `## STYLE RULES`, `## THEOLOGY RULES`, `## GROUNDING RULES`, `## CITATION FORMAT`, `## CONTEXT DOCUMENTS`, `## USER MEMORY`.
3. While moving, apply ONLY these transformations:
   - Fix typos verbatim-preserving meaning: "workd belive" → "word believe"; "beliveing" → "believing"; "differnt" → "different"; "imposible" → "impossible"; "unsertanding" → "understanding" (route.ts:265, :309, :321, :323); fix "MAt 24:23; Mat 24;16" → "Mt 24:23; Mt 24:26".
   - Deduplicate the believe→knowing rule (:265 and :323 → one rule under THEOLOGY RULES).
   - Delete the agent-directed line ":271 Offer to draft a filter list…" (it instructs the prompt author, not Tarsus).
   - Replace the vault path at :322 with the in-app link form: `see /pages/post_1660` (verify that page exists via `data/pages/post_1660.md`; if absent, drop the pointer and keep the rule text).
   - Keep every other rule **verbatim**, including the voice sample, arrow/wordplay mandates, banned words, footnote example block.
4. In `route.ts`, replace lines 208–356 with a call to `buildTarsusSystemPrompt(...)`. The salutation/benediction constants stay in `route.ts` (post-processing uses them).
5. **Language detection (D5), minimal hardening:** keep the regex approach but (a) strip Bible-reference tokens (`\b\d?\s?[A-Z][a-z]+\s\d+[:.]\d+` patterns) before counting; (b) add tie-break: if counts are equal or both < 2, look for Spanish-only characters `[¿¡ñáéíóúü]` → Spanish if present, else default English; (c) count **unique** pattern matches, not total. Keep it a pure function `detectSpanish(query: string): boolean` in `src/lib/prompt.ts`, unit-verifiable.

**Verify:**
- [ ] `npx tsc --noEmit` passes.
- [ ] Diff review: every rule in the old prompt maps to a rule in the new one (make a checklist while editing; the only deletions are the two listed above).
- [ ] Quick node check of `detectSpanish`: `node -e` snippets for: `"¿Qué es la gracia?"`→true, `"What is grace?"`→false, `"Explain Rom 6:14 no longer under law"`→false, `"gracia y ley"`→true.
- [ ] `npm run eval` — R1–R5, R8, R9 must not regress; expect R4/R8 improvement. Save results.

**Anti-pattern guards:** Do not "improve" the theology, reword Daniel Miles' voice sample, soften rules, or add new rules. Do not translate anything. This is a refactor + typo fix, not editorial work. Do not change temperature/model in this phase.

---

## Phase 4 — Output Validation & Auto-Repair Loop

**Goal:** Fix D2, D3, D8 — enforce the contract *after* generation, with one corrective retry, and verify citation fidelity server-side.

**Read first:** `src/app/api/chat/route.ts` post-processing block (:443–510), `src/lib/prompt.ts` (from Phase 3), `Support/eval/eval_tarsus.mjs` (rubric logic to mirror).

**Implement (in a new `src/lib/validate.ts` + wiring in `route.ts`):**

1. `validateResponse(text: string, isSpanish: boolean, references: {title,link}[]): { ok: boolean; violations: string[] }` implementing checks R3, R4, R5, R10 from the Phase 1 rubric (arrows present, ≥2 wordplay terms, banned phrases absent, no "under grace"), plus:
   - every footnote definition's link is in the provided `references` list (or marked-document links) — catches invented URLs;
   - footnote count ≥ 3 (relaxed from the prompt's 5–8 to avoid over-retrying).
2. **Snippet fidelity (D3):** for each parsed citation, load the source page body (`getPageData(slug)` from `src/lib/pages.ts`) and check the snippet appears in it — normalize whitespace and quotes before comparing, and for Spanish-mode translated snippets (which won't match) skip the check when the snippet ends with the `(Traducido al español...)` marker mandated at route.ts:332. Snippets that fail get their citation entry kept but flagged: append `violations.push('citation N snippet not found in source')`.
3. **One corrective retry:** in `route.ts`, after first generation + existing sanitization, run `validateResponse`. If `!ok`, re-call the same model once, appending to the conversation a user-role message: `Your previous response violated these mandatory rules: <violations list>. Regenerate the FULL response, correcting every violation. All other rules still apply.` Then re-run sanitization + validation; serve the second response regardless (never loop more than once). Log violations of the served response with `console.warn('[tarsus-validate]', violations)`.
4. **Fix D8:** raise DeepSeek `max_tokens` from 4096 to 8192 (route.ts:391). Also: if the raw model text did **not** contain the benediction anywhere (the `lastIndexOf` at :481 fails), treat it as a truncation signal — count it as a violation that triggers the retry, rather than silently appending the benediction.

**Verify:**
- [ ] `npx tsc --noEmit` passes.
- [ ] With API keys: ask a question, confirm via server logs that validation runs; artificially test the retry by temporarily adding a fake violation, then remove it.
- [ ] `npm run eval` full run — target: R3, R4 ≥ 90% pass; R7 100%; no regression elsewhere. Save results; compare against Phase 1 baseline in a short table appended to this plan file under "Results Log".
- [ ] Confirm `{text, citations}` shape unchanged: `Invoke-RestMethod` a query and check both keys present.

**Anti-pattern guards:** Max ONE retry — never loop. Never mutate the model's theological content programmatically (only the existing salutation/benediction/arrow sanitizers). Do not block the response on `updateMemory` (keep it fire-and-forget as at route.ts:441). Do not move validation client-side.

---

## Phase 5 — Final Verification & Handoff

**Read first:** this whole plan; all Phase results files in `Support/eval/results/`.

**Checklist:**

1. `npm run build` — clean production build.
2. `npm run lint` — no new errors versus main.
3. `npm run eval` — final run; produce a before/after table (baseline vs final) per rubric check; append to "Results Log" below.
4. Grep guards (PowerShell `Select-String`):
   - `'src', 'data', 'pages'` in `src/app/api/chat/route.ts` → 0 matches;
   - `workd|belive|differnt|imposible` in `src/lib/prompt.ts` and `route.ts` → 0 matches;
   - `max_tokens: 4096` in `route.ts` → 0 matches.
5. Manual smoke test in browser (`npm run dev`): one English question, one Spanish question, one with a pinned/marked document. Confirm: thinking blockquote renders, salutation/benediction exact, arrows present, footnote popovers open with real snippets, Learn More links navigate to existing pages.
6. Summarize all changes in a commit series (one commit per phase, message prefix `tarsus-output:`). Do not push without the user's go-ahead.

**Definition of done:** eval pass-rate improvement over baseline on R3, R4, R6, R7, R8 with zero regressions on R1, R2, R5, R9, R10, and the D1 path bug eliminated.

---

## Results Log

| Rubric | Baseline (Phase 1) | After Phase 2 | After Phase 3 | After Phase 4 (final) |
|--------|--------------------|---------------|---------------|------------------------|
| R1 salutation | | | | |
| R2 benediction | | | | |
| R3 arrows | | | | |
| R4 wordplay | | | | |
| R5 banned words | | | | |
| R6 citation count/diversity | | | | |
| R7 link validity | | | | |
| R8 staccato guardrail | | | | |
| R9 language match | | | | |
| R10 "under" doctrine | | | | |

*(Executor fills this in as phases complete.)*
