# Handoff: 212G TARSUS — Responsive 3-Pane Layout (Resizable Desktop + Mobile Carousel)

## Overview
The current Next.js/React app (212G TARSUS Main Ministry Platform) renders its 3-pane layout (Sources/Studies · Tarsus Chat · History) with rigid fixed-width panes. On narrow/mobile viewports it just stacks all three vertically, producing tiny unreadable text and a barely-usable page (see original screenshots referenced by the design team).

This package documents a redesign that:
1. Makes the three desktop panes **user-resizable** via drag dividers, with proportional shrinking so nothing clips off-screen at laptop widths.
2. Replaces the mobile stacked layout with a **single full-width panel at a time** (Sources / Chat / History) navigated by a tab strip and left/right swipe, with Chat as the default/center panel.
3. Keeps a working **light/dark theme toggle** (sun/moon icon).
4. Preserves the existing content, copy, and Times New Roman typography — this is a layout/UX fix, not a visual rebrand.

## About the Design Files
The bundled `Tarsus Responsive.dc.html` is a **design reference / interactive prototype** built in HTML — it demonstrates the intended layout, breakpoints, resize behavior, and mobile carousel interaction. It is **not production code to copy in** — the task is to recreate this behavior inside the existing Next.js + TypeScript + Vanilla-CSS codebase, using its existing `BibleContext`, API routes (`/api/chat`, `/api/sessions`, `/api/bible`), and component structure. Open the `.dc.html` file directly in a browser to interact with it (drag dividers, click "View: Auto/Mobile/Desktop" to preview the mobile carousel, toggle theme).

## Fidelity
**High-fidelity for layout/interaction, reference-only for exact colors.** Treat pane structure, breakpoint logic, resize/clamp math, and the mobile carousel mechanics as exact specs. Treat the specific hex values below as a faithful match to the existing light/dark themes already in the app's `globals.css` — reuse the app's existing CSS variables/tokens where they already cover these colors instead of introducing new ones.

## Screens / Views

### 1. Desktop (≥ 761px) — 3-pane resizable row
- Root: full-height flex row, `overflow-x: auto` as a safety net.
- **Left pane (Sources/Studies)**: default width 300px, drag-resizable between 160px–480px.
  - Header row: "212G TARSUS" brand (bold, underlined, link color) + theme toggle icon, padding 18px 20px, bottom border.
  - Sub-tabs "Studies" / "Bible": 2-column flex, active tab shows accent underline + subtle bg tint.
  - Filter input: full-width text input, 20px side margins, 16px top/bottom margin, 1px border, 4px radius.
  - Category list: each row is a clickable flex row (caret + "Name (count)"), caret rotates 90° on expand. Categories: Social Media Captures (991), ABOVE All These Things (40), Dan's Emails (134), Other Studies (12), GodShew (297), Daniel Miles Posts Archive (3759).
- **Divider 1**: 8px wide, `cursor: col-resize`, drag adjusts left pane width live.
- **Center pane (Tarsus Chat)**: `flex: 1 0 360px`, `min-width: 360px` (never shrinks below this — side panes give way first).
  - Header row: "Tarsus Chat" title (26px bold, link color) + nav links (Home/About/Testimony) + "Hide History" toggle button + "View: Auto/Mobile/Desktop" debug toggle (dev-only affordance — the real app doesn't need this, it was added to preview breakpoints on demand; omit in production or gate behind a dev flag).
  - Context Memory row: label + progress bar (green fill, width = count/15 × 100%) + "N / 15" count.
  - Messages area: scrollable, flex-grow. Assistant bubbles left-aligned, muted background; user bubbles right-aligned (`margin-left: auto`), accent background, white text. Max bubble width 720px, 18px font, 1.6 line-height, `white-space: pre-wrap` to preserve paragraph breaks.
  - Input row: text input (`flex: 1 1 auto; min-width: 0` — critical so it can actually shrink) + Send button (`flex-shrink: 0` — critical so it's never clipped). Placeholder: "Ask Tarsus about law vs grace, the 2Sons, cOLD vs LukeWarm...".
- **Divider 2**: same as divider 1, only rendered when History pane is visible.
- **Right pane (History)**: default width 320px, drag-resizable 160px–480px. Hidden entirely when "Hide History" is toggled (divider 2 also disappears, center pane reclaims the space).
  - Header row: "History" title (22px bold) + "+ New Chat" pill button (accent bg, white text).
  - List: each row = title (ellipsis-truncated, single line) + red "✕" delete icon, row bottom border.

**Resize/clamp algorithm (important — prevents the off-screen clipping bug seen in the original)**:
```
centerMin = 360  // px, center pane's floor
dividerTotal = historyVisible ? 16 : 8   // 2× 8px dividers, or 1×
available = max(0, windowWidth - centerMin - dividerTotal)
if (leftWidth + rightWidth > available) {
  scale = available / (leftWidth + rightWidth)
  leftWidth  = max(160, floor(leftWidth * scale))
  rightWidth = historyVisible ? max(160, floor(rightWidth * scale)) : 0
}
```
Recompute on every render (window resize, divider drag, history toggle) — never let the raw drag values render unclamped, or side panes can push the center pane's input/button off-screen at laptop widths (~924–1050px), which is exactly the regression this fixes.

### 2. Mobile (≤ 760px) — single-panel carousel
- Top tab strip (fixed height, ~48px): "Sources" | "Chat" | "History" tabs, active tab shows accent color + underline. Tapping a tab jumps directly to that panel.
- Below the strip: a track div `width: 300%` containing the 3 panels each at `width: 33.3333%`, transformed by `translateX(calc(-currentPanelIndex × 33.3333% + livDragOffsetPx))`.
  - **Use `-index * 33.3333%`, not `-index * 100%`** — percentage transforms resolve against the *track's own width* (which is 3× the viewport here), so `-100%` overshoots by a full 3 panels and pushes content off-screen. This was a real bug caught during build; do not regress it.
- Default panel on load = **Chat (index 1)**, so the primary task is immediately visible.
- Swipe gesture: on `touchstart` record start X; on `touchmove` compute live delta and apply it as the drag offset (no transition, tracks the finger 1:1); on `touchend`, if `|delta| > 18% of viewport width`, move one panel in that direction (clamped 0–2), else snap back. Transition re-enables (`transform 0.28s ease`) once the finger lifts.
- Each panel is simply the corresponding desktop pane's content at full width — same markup, same styles, just one visible at a time instead of 3 side-by-side.
- No resize dividers on mobile (nothing to resize — each panel is full width).

### Both screens
- Theme toggle (sun/moon emoji button) lives in the Sources pane's brand row on both breakpoints and flips `theme` between `light`/`dark` app-wide.
- Typography: Times New Roman throughout (all UI chrome and chat content) — this was an explicit requirement, not incidental.

## Interactions & Behavior
- **Divider drag**: `mousedown` on a divider records the starting mouse X and the pane's starting width; a window-level `mousemove` listener computes the delta and updates width live (clamped 160–480px); `mouseup` ends the drag. Implement equivalent `pointerdown/pointermove/pointerup` for touch/pen support if the real app should support resizing on tablets.
- **Category expand/collapse**: click toggles a per-category boolean; caret rotates via CSS transform, no animation library needed.
- **Filter input**: simple case-insensitive substring match against category names (live, no debounce needed at this list size).
- **Hide/Show History**: toggles pane + its divider's visibility; center pane's `flex:1` reclaims the freed width automatically.
- **New Chat**: prepends a new "New Chat" entry to the History list (front-end demo only here — wire to the real session-creation API in production).
- **Delete history item**: removes that row from the list (wire to the real delete-session API in production).
- **Send message**: appends a user bubble + (in this prototype) a canned assistant reply; wire to the real `/api/chat` streaming endpoint in production, and drive the Context Memory count from the real session's message count instead of the local counter used here.

## State Management
Minimum state needed to reproduce this:
- `theme`: `'light' | 'dark'`
- `isMobile`: boolean, derived from `window.innerWidth <= 760`, updated on resize
- `activeSubTab`: `'studies' | 'bible'`
- `filterText`: string
- `expandedCategories`: `{ [categoryName]: boolean }`
- `leftWidth`, `rightWidth`: numbers (px), persisted per-user if desired (e.g. localStorage) so resize preferences survive reload
- `showHistory`: boolean
- `mobilePanelIndex`: `0 | 1 | 2` (Sources / Chat / History), plus a transient live drag-offset value while swiping
- `chatInput`, `messages`, `historyItems`: existing app state, unchanged in shape

## Design Tokens
**Light theme**
- Background / panel: `#ffffff`
- Border: `#dcdcdc`
- Text: `#1a1a1a`
- Muted text: `#666666`
- Link / accent text: `#1a4fba`
- Primary accent (user bubble, New Chat button): `#182a52`
- Send button: `#2a6fdb`
- Danger (delete ✕): `#c0392b`
- Chat bubble (assistant): `#f7f7f5`

**Dark theme**
- Background: `#111318`
- Panel: `#15171d`
- Border: `#2b2e38`
- Text: `#e9eaed`
- Muted text: `#9099a8`
- Link / accent: `#4fa3ff`
- Primary accent: `#3f6fd6`
- Send button: `#2a6fdb`
- Danger: `#e0776a`
- Chat bubble (assistant): `#1b1e26`

**Shared**
- Font: `"Times New Roman", Times, serif` — everywhere, no secondary sans-serif.
- Context memory fill: `#3fae5c` (green), regardless of theme.
- Border radius: 4px (inputs, buttons), 6px (chat bubbles).
- Divider width: 8px. Pane floor width: 160px. Pane ceiling: 480px. Center pane floor: 360px.
- Breakpoint: 760px (≤760 → mobile carousel, >760 → desktop 3-pane).

## Assets
No new image/icon assets — theme toggle uses the sun (☀️) / moon (🌙) emoji already used in the existing app; no new iconography introduced.

## Files
- `Tarsus Responsive.dc.html` — the interactive prototype covering both breakpoints, theme toggle, resizable dividers, and the mobile swipe carousel. Open directly in a browser; use the "View: Auto/Mobile/Desktop" control (desktop header / mobile tab strip) to force a breakpoint without resizing the window.
