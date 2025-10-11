# UI Specification — Florent

One-line goal

- Deliver a complete, engineering-friendly UI specification for the Dark Galaxy Simulator, "Florent" theme (Pink Nebulae). This file is intended for developers and designers to implement a faithful layout to the attached screenshot with a modern pink-nebula aesthetic.

---

## 1. Overview & Vision

Objective

- Create a modern, immersive user interface that structurally replicates the provided screenshot but with a fresh "Pink Nebulae" aesthetic: dark, deep purples/charcoals with energetic pink/magenta accents. The UI should read like a futuristic command console and retain high legibility and usable information density.

Tone & Mood

- Sleek, futuristic, slightly cinematic, high-contrast for readability. Subtle glow and soft vignette effects can be used sparingly to sell the nebula feel.

Audience

- Strategy gamers and simulation players who need quick glanceable information plus deeper drill-down controls.

---

## 2. Color Palette — "Pink Nebulae"

Design tokens (CSS variable names / Tailwind tokens suggested)

- --bg-primary: #120c18; /* Primary Background */
- --bg-secondary: #21182c; /* Panels, cards */
- --accent-primary: #e91e63; /* Primary interactive */
- --accent-secondary: #ff4081; /* Hover/highlight */
- --text-primary: #e1dce6; /* Main text */
- --text-secondary: #a39cb0; /* Muted text */
- --border: #3c2d4a; /* Dividers / borders */
- --success: #00b0ff; /* Positive incomes/alerts */
- --warning: #ffab40; /* Negative/warnings */

Usage guidance

- Backgrounds: Use `--bg-primary` for app shell, `--bg-secondary` for card/panel backgrounds.
- Accents: Use `--accent-primary` for CTA buttons, active tab backgrounds, progress fills. `--accent-secondary` for hover states and emphasis.
- Text: `--text-primary` for all primary labels and values; `--text-secondary` for descriptions, legends, disabled text.
- Borders: `--border` at 1px for separation lines, subtle card outlines.

Contrast note

- Ensure `--text-primary` on `--bg-secondary` meets WCAG AAA where possible; run a contrast check and adjust slightly if necessary.

---

## 3. Typography

Font family

- Inter (preferred). Fallback: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial.

Sizes & weights (base: 14px)

- Body (base): 14px, line-height 1.4, color `--text-primary`, weight 400.
- H1 (Panel titles): 20px, weight 700, color `--text-primary`.
- H2 (Section/group headers): 16px, weight 600, color `--text-secondary`.
- Label / meta: 12px, weight 400, color `--text-secondary`.

Example CSS (tokenized)

```css
:root{
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  --text-size-base: 14px;
}
body{ font-family:var(--font-sans); font-size:var(--text-size-base); color:var(--text-primary); }
```

---

## 4. Layout & Structure

Overall frame

- Persistent header (top bar) and optional footer.
- Main content: three columns (left, center, right) inside a fixed horizontal container. The container should be responsive but maintain the three-column layout on desktop. On smaller screens collapse into stacked sections.

Grid suggestion

- Layout: CSS grid with three columns: 280px (left) | 1fr (center) | 320px (right)
- Gap: 16px or 24px depending on container width
- Padding: 20px outer padding

Header content

- Left: app title / planet tabs.
- Right: resource overview (icons + values + per-turn numbers).

---

## 5. Component Specification

Component styles give specific rules and interaction states. Use the token names above when implementing.

### 5.1 Header (Top Bar)

Structure

- Background: `--bg-secondary`.
- Height: 64px.
- Padding: 0 20px; display: flex; align-items:center; justify-content:space-between.

Planet Tabs

- Tab container background: transparent, tabs inline.
- Inactive tab: color `--text-secondary`, background transparent.
- Active tab: background `--accent-primary`, color `--text-primary`; small glow (box-shadow: 0 6px 20px rgba(233,30,99,0.08)) optional.
- "+" tab: styled as an outline chip — border 1px `--border`, color `--text-secondary`.

Resource Display

- Each resource: icon (monochrome) left, values stacked: stored value (text-primary), per-turn (color-success or color-warning depending on sign).
- Per-turn styling: prefix with `+` or `-` and color accordingly.

### 5.2 Left Column — "Build List"

Panel shell

- Background: `--bg-primary`.
- Inner panel/cards: `--bg-secondary`, border 1px `--border`, border-radius 6px.
- Header: "Build List" (H1 style) and planet selector.

Category tabs (Structures/Ships/etc.)

- Container: `--bg-secondary`.
- Active tab: bottom border 3px solid `--accent-primary`, text color `--text-primary`.
- Inactive tabs: `--text-secondary`.

Build items

- Tier headings: H2 style using `--text-secondary`.
- Item row: display flex; icon | name + metadata | right-side action
- Hover: item background slightly lighter (e.g., rgba(255,255,255,0.02) over `--bg-secondary`).
- Icon color: `--text-primary` (monochrome / single color).

Queue Button

- Default: background `--accent-primary`, color `--text-primary`, border-radius 4px, padding 6px 10px.
- Hover: background `--accent-secondary`.

### 5.3 Middle Column — "Queue"

Panel

- Panel background: `--bg-secondary`, border 1px `--border`, border-radius 6px; padding: 12–16px.

Queued item card

- Card background: `--bg-primary`, border 1px `--border`, padding 8–12px, display:flex, align-items:center.
- Name: `--text-primary`, metadata (turns remaining) `--text-secondary`.

Progress bar

- Track background: use a subtle darker tone of `--bg-primary`.
- Fill: `--accent-primary`.
- Height: 8px; border-radius: 999px for pill shape.

Delete action

- Icon color: `--text-secondary`; hover color: `--accent-secondary`.

### 5.4 Right Column — "Planet Summary"

Panel behavior

- Same shell conventions as other panels: `--bg-secondary`, border: 1px `--border`, rounded corners.

Content

- Section headers: H2.
- Labels: `--text-secondary` (e.g., "Abundance", "Ground").
- Values: `--text-primary`.
- Space usage bar: track (light/transparent) with fill `--accent-primary`; show numeric fraction (e.g., "15/20") next to it.

---

## 6. Iconography

- Use a clean, geometric line icon set such as Material Icons (outlined) or Feather.
- Single-color icons only. Default color: `--text-secondary`. Active/important: `--accent-primary`.
- Sizes: 20px for list icons, 24–32px for planet art or large badges.

---

## 7. General Notes & Animations

Spacing

- Base spacing unit: 8px.
- Recommended spacing scale: 4, 8, 12, 16, 20, 24, 32.

Transitions

- All interactive color/background changes: transition: color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease.

Micro-interactions

- On hover for an actionable item, add a subtle upward translation (transform: translateY(-2px)) and a faint shadow to imply lift.
- Tab switches and queue item reorder animations can use ease-in-out 160–240ms.

Accessibility

- Provide focus styles for keyboard navigation (outline or box-shadow using `--accent-secondary` at 2px). Do not rely on color alone to indicate focus.
- Ensure large text meets AA/AAA contrast ratio with its background. If a token fails, slightly adjust luminance while keeping the palette tone.

---

## 8. Implementation Guidance (developer-ready)

Design tokens (SCSS/CSS variables)

```css
:root{
  --bg-primary: #120c18;
  --bg-secondary: #21182c;
  --accent-primary: #e91e63;
  --accent-secondary: #ff4081;
  --text-primary: #e1dce6;
  --text-secondary: #a39cb0;
  --border: #3c2d4a;
  --success: #00b0ff;
  --warning: #ffab40;
}
```

Tailwind notes (if using Tailwind)

- Add custom colors under `theme.extend.colors`:
  - `pink-nebula`: {primary: '#e91e63', secondary: '#ff4081', bg: '#120c18', panel: '#21182c', text: '#e1dce6', muted: '#a39cb0'}
- Use `ring-offset` for focus styles and `transition-colors` utilities for interactive elements.

Sample component classes (Tailwind-like)

- Header: `bg-panel p-4 flex items-center justify-between` (where `bg-panel` maps to `--bg-secondary`).
- Active tab: `bg-accent-primary text-text-primary rounded px-3 py-1`.
- Queue card: `bg-bg-primary border border-border rounded p-3 flex items-center gap-3`.

Assets

- Planet artwork: supply circular 256px PNG/JPEG with subtle rim lighting.
- Icons: SVG line icons; keep them as single-color SVGs so color can be changed with `fill` or `stroke`.

Responsive behavior

- At widths < 1100px: collapse left column to a drawer; right column becomes collapsible detail panel.
- On mobile: stack panels vertically: Header -> Planet Summary -> Queue -> Build List.

---

## 9. Accessibility Checklist

- [ ] All interactive controls keyboard-focusable and visible focus states provided.
- [ ] Text contrast meets WCAG AA for normal text; adjust tokens if any fail.
- [ ] Icon-only buttons include accessible `aria-label` attributes.
- [ ] Semantic HTML for lists, headings and forms.

---

## 10. Motion & Performance

- Keep animations short and optional (allow a user preference to reduce motion).
- Avoid expensive shadows on many simultaneous elements. Prefer subtle composited transforms and opacity.

---

## 11. Example HTML snippets (structure)

Header & resource area (simplified)

```html
<header class="header bg-panel p-4 flex justify-between items-center">
  <div class="tabs flex items-center gap-2">
    <button class="tab active">HW</button>
    <button class="tab">Mars</button>
    <button class="tab">+</button>
  </div>
  <div class="resources flex items-center gap-4">
    <div class="resource flex items-center gap-2">
      <svg class="icon" aria-hidden></svg>
      <div class="values">
        <div class="amount">30,000</div>
        <div class="per-turn text-success">+1,200/t</div>
      </div>
    </div>
  </div>
</header>
```

Queue card (simplified)

```html
<div class="queue-card bg-bg-primary border border-border rounded p-3 flex items-center justify-between">
  <div class="left flex items-center gap-3">
    <img src="/icons/mine.svg" class="w-8 h-8" alt=""/>
    <div>
      <div class="name text-text-primary">Metal Mine</div>
      <div class="meta text-text-secondary">3x • Tier 1</div>
    </div>
  </div>
  <div class="right flex items-center gap-3">
    <div class="turns text-text-secondary">4</div>
    <button class="delete text-text-secondary hover:text-accent-secondary">✕</button>
  </div>
</div>
```

---

## 12. Handoff & Deliverables

What I can provide next (pick one or more):

- A tokenized CSS file or SCSS partial using the color and typography tokens above.
- Tailwind `theme.extend` snippet + utility classes.
- A small React component library (Header, BuildListItem, QueueCard, PlanetSummary) pre-styled using the tokens.
- Figma/PNG mockups (one-screen lightweight mockup) to match the screenshot with the new theme.

---

## 13. Notes about the screenshot

- The implementation should match the screenshot's structural layout and information density. Use the screenshot as the layout reference for spacing and alignment, but replace colors, icons and micro-UI with the new tokens.

---

End of spec — `UI_SPEC_Florent.md`
