# Florent UI & Design Documentation

**Purpose**: This document describes the current UI structure, design choices, and styling for layout improvement discussions.

---

## Overview

Florent is a turn-based strategy simulator for Infinite Conflict with a space-themed "Pink Nebula" design system. The application manages planetary resources, structures, ships, colonists, and research across multiple planets.

---

## 1. Page Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  PLANET TABS (🌍 Planet-1 | 🔴 Planet-2 | ➕ Add Planet)    │
├─────────────────────────────────────────────────────────────┤
│  ERROR DISPLAY (red banner, shown when errors occur)        │
├─────────────────────────────────────────────────────────────┤
│  WARNINGS PANEL (yellow/blue alerts for game state)         │
├─────────────────────────────────────────────────────────────┤
│  PLANET DASHBOARD (4-column responsive grid)                │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │  Resources  │ Population  │    Space    │  Buildings  │ │
│  │  (table)    │  (table)    │ (progress)  │  (table)    │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  HORIZONTAL TIMELINE (Turn slider: 1-200)                   │
├─────────────────────────────────────────────────────────────┤
│  MAIN CONTENT (side-by-side panels)                         │
│  ┌────────────────────────┬────────────────────────────┐   │
│  │    ADD TO QUEUE        │      PLANET QUEUE          │   │
│  │    ───────────────     │      ───────────────       │   │
│  │    [Structures|Ships|  │      [Structures|Ships|    │   │
│  │     Colonists|Research]│       Colonists|Research]  │   │
│  │                        │                            │   │
│  │    Item list with      │      Queue entries with    │   │
│  │    costs & buttons     │      status & timing       │   │
│  └────────────────────────┴────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- **Mobile**: Single column, stacked panels
- **Tablet (md)**: 2-column dashboard grid
- **Desktop (lg)**: Side-by-side main panels
- **Large (xl)**: 4-column dashboard, max-width 1800px

---

## 2. Color System

### Primary Theme Colors (Pink Nebula)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#120c18` | Primary dark background |
| `panel` | `#21182c` | Card/panel backgrounds |
| `accent-primary` | `#e91e63` | Primary actions, highlights |
| `accent-secondary` | `#ff4081` | Secondary highlights |
| `text` | `#e1dce6` | Primary text (off-white) |
| `muted` | `#a39cb0` | Secondary/disabled text |
| `border` | `#3c2d4a` | Borders and dividers |
| `success` | `#00b0ff` | Success states |
| `warning` | `#ffab40` | Warning states |

### Interaction Intent Colors

Use these colors to prevent tabs and actions from looking interchangeable.

| Intent | Color Family | Usage |
|--------|--------------|-------|
| Selected lane/tab | Cyan / sky | Active Structures, Ships, Colonists, Research tabs in Add to Queue and Planet Queue |
| Share link | Emerald / teal | Copy Share Link action |
| Saves | Sky / blue | Open Saves action |
| Export current | Amber | Export Current action |
| Export full | Violet | Export Full List action |

Guideline: pink/magenta remains the brand accent and confirmation color, but it should not be the default active-tab color. Active lane tabs use cyan/sky so they read as navigation state, while action buttons use intent-specific colors and icons.

### Resource Colors (Consistent across entire UI)

| Resource | Tailwind Class | Color | Notes |
|----------|---------------|-------|-------|
| Metal | `text-gray-300` | Silver | Primary building material |
| Mineral | `text-red-500` | Red | Secondary resource |
| Food | `text-green-500` | Green | Population sustenance |
| Energy | `text-blue-400` | Blue | Power for structures |
| Research Points | `text-purple-400` | Purple | Technology progress |
| Workers | `text-orange-400` | Orange | Labor force |
| Soldiers | `text-red-300` | Light red | Military units |
| Scientists | `text-yellow-400` | Yellow | Research specialists |
| Ground Space | `text-amber-600` | Brown | Planet surface |
| Orbital Space | `text-blue-600` | Dark blue | Orbital facilities |

### Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| Available | Green border | Can queue immediately |
| Queueable with wait | Blue border | Needs auto-wait turns |
| Locked | Gray border | Missing prerequisites |
| Active | Yellow/amber | Currently in progress |
| Completed | Green/slate | Finished building |
| Error | Red | Problems/warnings |

---

## 3. Typography

### Font Stack
- **Primary**: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif
- **Display**: Source Sans Pro (300, 400, 700), Turret Road (200, 400, 700)
- **Monospace**: System monospace (for numbers)

### Text Hierarchy

| Level | Classes | Usage |
|-------|---------|-------|
| Page Title | `text-2xl font-bold` | Main headings |
| Section Header | `text-lg font-bold` | Card/panel titles |
| Subsection | `text-sm font-semibold` | Table headers, labels |
| Body | `text-sm` | General content |
| Meta | `text-xs text-muted` | Timestamps, hints |
| Numbers | `font-mono` | All numeric values |

### Number Formatting
- Full numbers displayed (no abbreviations): `1.500` not `1.5k`
- German locale formatting with period separators
- Right-aligned in columns for easy scanning

---

## 4. Component Inventory

### Planet Dashboard
**4-card horizontal grid showing planet status**

| Card | Content | Key Features |
|------|---------|--------------|
| Resources | Table: Type, Stock, Abundance %, Output/Turn | Color-coded rows, German number format |
| Population | Table: Workers, Soldiers, Scientists with caps | Idle count, growth hints, housing warnings |
| Space | Progress bars: Ground, Orbital, Planet Limit | Visual fill indicators, remaining space counts |
| Buildings | Scrollable table of structures | Space used, quantities, net resource output |

### Horizontal Timeline
**Turn navigation control**

- Turn number input (1-200)
- Range slider with labeled tick marks (1, 50, 100, 150, 200)
- Current position indicator
- Quick jump buttons: Start, Mid, End
- Hover tooltip showing turn number

### Add to Queue Panel (TabbedItemGrid)
**Item selection interface**

- 4 tabs: Structures, Ships, Colonists, Research
- Single-row items with columns:
  - Item name (fixed width, truncated)
  - Resource costs (color-coded columns)
  - Energy upkeep (blue with ⚡)
  - Duration (e.g., "4T")
  - Add button (+)
- Quantity input for Ships/Colonists
- Sorted: Available first, then by duration, then alphabetically

### Planet Queue Panel (TabbedLaneDisplay)
**Queue schedule viewer**

- 4 tabs matching Add to Queue
- Queue entries showing:
  - Turn range (T1 - T5)
  - Item name
  - Status indicator (⏳ active, ⏸ pending, ✓ completed)
  - Turns remaining
  - Cancel button (×)
- Drag-and-drop reordering for pending items
- Scrollable list with fixed height

### Planet Tabs
**Multi-planet navigation**

- Horizontal scrollable tabs
- Planet emoji + name + current turn
- Active: Pink background, scale effect, shadow
- Inactive: Slate background, hover effect
- Add Planet button (dashed border)

---

## 5. Visual Effects

### Glassmorphism
Used on cards and panels for depth:
```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(40px) saturate(180%) brightness(110%);
border: 2px solid rgba(255, 255, 255, 0.3);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
```

### Glow Effects
Resource-specific glows for emphasis:
- `.glow-tyr` - Magenta double shadow
- `.glow-mineral` - Red double shadow
- `.glow-food` - Green double shadow
- `.glow-energy` - Blue double shadow

### Transitions
- Color changes: 200ms
- Tab switches: 350ms
- Hover effects: Immediate with smooth falloff

---

## 6. Interactive Patterns

### Buttons
| Type | Style | Usage |
|------|-------|-------|
| Primary | Pink bg, white text | Confirm/save flows where there is a single obvious primary action |
| Secondary | Slate bg, muted text | Cancel, dismiss |
| Destructive | Red bg | Delete, remove |
| Disabled | Gray bg, 50% opacity | Unavailable actions |

### Queue Header Actions

Queue header actions must be impossible to confuse:
- **Copy Share Link**: emerald/teal, link icon, copies a URL that opens this build list.
- **Open Saves**: blue, save/disk icon, opens local save/shared/history management.
- **Export Current**: amber, export/upload icon, exports the currently visible build order.
- **Export Full List**: violet, list icon, exports the full future build list.

Labels should describe the outcome directly. Avoid ambiguous pairs like "Share Link" and "Export / Share" next to each other.

### Lane Tabs

- Active lane tabs use cyan/sky selected styling rather than pink/magenta.
- Every lane tab includes its icon plus text label.
- Tabs indicate navigation/filter state only; do not style them like action buttons.

### Form Inputs
- Number inputs: Center-aligned, monospace, 40px height
- Range sliders: Custom styled thumb (pink), track (border color)
- Focus: Pink border highlight

### Hover States
- Cards: Background lightens
- Buttons: Brightness increases
- List items: Subtle background shift
- Disabled: No hover effect, `cursor: not-allowed`

### Drag & Drop
- Draggable items show `cursor: move`
- Dragging: 50% opacity
- Drop indicator: Top border line

---

## 7. Spacing & Layout

### Spacing Scale (Tailwind)
| Size | Value | Usage |
|------|-------|-------|
| xs | 4px (gap-1) | Tight groupings |
| sm | 8px (gap-2) | Related elements |
| md | 16px (gap-4) | Section spacing |
| lg | 24px (gap-6) | Major sections |
| xl | 32px (gap-8) | Page sections |

### Padding Patterns
- Cards: `p-3` to `p-4`
- Buttons: `px-4 py-2`
- Table cells: `py-2`
- Page container: `px-6`

### Fixed Dimensions
- Dashboard cards: 600px max-height with scroll
- Add to Queue panel: 400px width on desktop
- Queue panel: Flexible width
- Timeline: Full width with max-width container

---

## 8. Current Design Issues / Areas for Improvement

### Potential Layout Issues
1. **Fixed heights**: 600px card heights may crop content on smaller screens
2. **Column widths**: Cost columns may overflow with large numbers
3. **Mobile experience**: Side-by-side panels stack but may need redesign
4. **Information density**: Dashboard packs a lot; may overwhelm new users

### Visual Consistency
1. **Mixed icon styles**: Emoji icons + Material Icons
2. **Border inconsistency**: Mix of 1px and 2px borders
3. **Color saturation**: Some colors more vivid than others
4. **Font weight variety**: Multiple weights used somewhat arbitrarily

### Interaction Patterns
1. **Confirmation flows**: Some destructive actions lack confirmation
2. **Loading states**: No visible loading indicators
3. **Empty states**: Minimal styling for "no items" messages
4. **Error feedback**: Basic red text, could be more prominent

### Accessibility
1. **Color contrast**: Some muted text may be hard to read
2. **Focus indicators**: Rely on browser defaults in some places
3. **Touch targets**: Some buttons may be too small on mobile
4. **Screen reader**: Limited ARIA labels on complex components

---

## 9. Star Background

The app uses animated star layers from the original Infinite Conflict template:
- `#stars1`, `#stars2`, `#stars3` - Three parallax star layers
- Gradient overlay: Purple to pink to blue (`from-purple-900 via-pink-900 to-blue-900`)
- Fixed positioning behind all content

---

## 10. External Dependencies

### Fonts (Google Fonts)
- Source Sans Pro (300, 400, 700)
- Turret Road (200, 400, 700)
- Material Icons

### CSS
- Tailwind CSS (utility-first framework)
- Custom CSS for glassmorphism and glow effects
- External Infinite Conflict stylesheet (preloaded)

---

## Summary

The Florent UI combines:
- **Dark space theme** with pink/magenta accents
- **Glassmorphic cards** for modern depth
- **Color-coded resources** for quick scanning
- **Tabbed interfaces** for organizing complex data
- **Monospace numbers** for alignment and clarity
- **Responsive grid layouts** for multi-device support

The design prioritizes **information density** and **visual clarity** for strategy game players who need to track multiple resources and queues simultaneously.
