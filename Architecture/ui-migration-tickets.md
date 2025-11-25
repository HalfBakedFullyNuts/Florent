# UI Migration Tickets - Option B: Gradual shadcn/ui Integration

**Goal**: Modernize Florent's UI with Nebula Command design system while preserving all existing architecture, game logic, and component structure.

**Strategy**: Incremental migration with proof-of-concept validation gates.

---

## Phase 0: Foundation Setup (No Visual Changes)

### Ticket UI-M-0.1: Install shadcn/ui Infrastructure
**Priority**: Critical
**Effort**: 30 minutes
**Dependencies**: None

**Tasks**:
1. Install shadcn/ui CLI and core dependencies
   ```bash
   npm install -D @shadcn/ui
   npm install class-variance-authority clsx tailwind-merge
   npm install lucide-react
   ```
2. Create `components/ui/` directory structure
3. Add `lib/utils.ts` with cn() helper function
4. Update `tsconfig.json` paths for `@/components` alias
5. Verify build still works: `npm run build`

**Acceptance Criteria**:
- [ ] shadcn CLI installed and functional
- [ ] `@/components` path alias works
- [ ] No breaking changes to existing components
- [ ] Build completes successfully
- [ ] All existing tests still pass

**Validation**: Run `npm run test && npm run build`

---

### Ticket UI-M-0.2: Add Nebula CSS Utilities
**Priority**: Critical
**Effort**: 1 hour
**Dependencies**: None

**Tasks**:
1. Copy glass-morphism utilities to `src/app/globals.css`:
   ```css
   .glass-card { background: rgba(26, 15, 46, 0.6); backdrop-filter: blur(12px); ... }
   .glass-panel { ... }
   .glass-subtle { ... }
   ```
2. Add glow effect utilities:
   ```css
   .glow-primary { box-shadow: 0 0 20px rgba(232, 121, 249, 0.3); ... }
   .glow-tyr { box-shadow: 0 0 15px rgba(156, 163, 175, 0.3); }
   .glow-mineral { ... }
   .glow-food { ... }
   .glow-energy { ... }
   ```
3. Add Nebula CSS variables to `:root`:
   ```css
   --nebula-primary: #e879f9;
   --nebula-secondary: #c084fc;
   --nebula-accent: #7c3aed;
   ```
4. Document all new classes in comments

**Acceptance Criteria**:
- [ ] All glass-morphism classes available
- [ ] All glow classes available
- [ ] CSS compiles without errors
- [ ] No visual changes to existing components
- [ ] Build completes successfully

**Validation**: Apply `.glass-card` to a test div in dev mode, verify it renders

---

### Ticket UI-M-0.3: Create Nebula Style TypeScript Module
**Priority**: Nice-to-have
**Effort**: 30 minutes
**Dependencies**: None

**Tasks**:
1. Create `src/lib/styles/nebula-styles.ts`
2. Export inline style objects:
   ```ts
   export const glassCard: React.CSSProperties = { ... }
   export const glowPrimary: React.CSSProperties = { ... }
   ```
3. Export resource color mappings:
   ```ts
   export const resourceColors = {
     metal: { text: 'text-gray-300', glow: 'glow-tyr', ... },
     mineral: { text: 'text-red-400', glow: 'glow-mineral', ... },
     ...
   }
   ```

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Export types match React.CSSProperties
- [ ] Module can be imported in components

**Validation**: Import in a component, verify IntelliSense works

---

## Phase 1: Proof-of-Concept (Single Component)

### Ticket UI-M-1.1: Install shadcn Button Component
**Priority**: High
**Effort**: 15 minutes
**Dependencies**: UI-M-0.1

**Tasks**:
1. Run: `npx shadcn@latest add button`
2. Verify `components/ui/button.tsx` created
3. Add custom "nebula" variant to button:
   ```tsx
   nebula: "glass-card glow-primary-subtle border-primary/40 hover:border-primary hover:bg-primary/20"
   ```
4. Test button renders in Storybook/dev

**Acceptance Criteria**:
- [ ] Button component exists at `components/ui/button.tsx`
- [ ] Button supports "nebula" variant
- [ ] No breaking changes to existing code
- [ ] TypeScript types correct

**Validation**: Render `<Button variant="nebula">Test</Button>` in dev

---

### Ticket UI-M-1.2: Install shadcn Card Component
**Priority**: High
**Effort**: 15 minutes
**Dependencies**: UI-M-0.1

**Tasks**:
1. Run: `npx shadcn@latest add card`
2. Verify `components/ui/card.tsx` created
3. Extend Card with glass-morphism default:
   ```tsx
   <div className={cn("glass-card", className)} {...props} />
   ```

**Acceptance Criteria**:
- [ ] Card component exists
- [ ] Card applies glass effect by default
- [ ] Can override with custom className

**Validation**: Render `<Card>Content</Card>`, verify glass effect visible

---

### Ticket UI-M-1.3: Migrate ResourcePanel - Visual Only
**Priority**: High
**Effort**: 2 hours
**Dependencies**: UI-M-0.2, UI-M-1.1, UI-M-1.2

**Tasks**:
1. **Do NOT change**: Props interface, state logic, event handlers
2. Replace outer container with shadcn `<Card>`
3. Apply glass-morphism classes:
   ```tsx
   <Card className="glass-card glow-tyr border-gray-400/30">
   ```
4. Keep all existing children components unchanged
5. Verify all functionality still works
6. Take before/after screenshots for comparison

**Acceptance Criteria**:
- [ ] Props interface unchanged
- [ ] All existing tests pass without modification
- [ ] Component logic unchanged (same state, same handlers)
- [ ] Visual appearance uses glass-morphism
- [ ] No console errors or warnings
- [ ] Screenshots show visual improvement

**Validation Gate**:
- Run tests: `npm run test src/components/ResourcePanel.test.tsx`
- Manual QA: Verify resource display, income indicators work
- **Decision Point**: Proceed only if satisfied with results

---

### Ticket UI-M-1.4: Write Migration Documentation
**Priority**: Medium
**Effort**: 1 hour
**Dependencies**: UI-M-1.3

**Tasks**:
1. Document migration pattern in `Architecture/ui-migration-guide.md`
2. Include before/after code examples
3. List gotchas and lessons learned
4. Create rollback procedure
5. Add decision log: proceed vs. revert vs. adjust approach

**Acceptance Criteria**:
- [ ] Guide includes clear migration pattern
- [ ] Rollback procedure documented
- [ ] Screenshots included

**Validation**: Another developer can follow guide to migrate a component

---

## Phase 2: Core Components Migration (If Phase 1 Approved)

### Ticket UI-M-2.1: Install Additional shadcn Components
**Priority**: Medium
**Effort**: 30 minutes
**Dependencies**: Phase 1 approval

**Tasks**:
1. Install based on needs:
   ```bash
   npx shadcn@latest add dialog
   npx shadcn@latest add scroll-area
   npx shadcn@latest add badge
   npx shadcn@latest add progress
   ```
2. Add Nebula variants to each
3. Test each component in isolation

**Acceptance Criteria**:
- [ ] Components installed and typed correctly
- [ ] Each has Nebula variant option
- [ ] No build errors

---

### Ticket UI-M-2.2: Migrate LaneBoard - Visual Only
**Priority**: High
**Effort**: 2-3 hours
**Dependencies**: UI-M-2.1

**Tasks**:
1. **PRESERVE**: All game logic, state management, selectors
2. Replace containers with `<Card className="glass-card">`
3. Apply lane-specific glows:
   - Building lane: `glow-primary`
   - Ship lane: `glow-accent`
   - Colonist lane: `glow-secondary`
4. Use shadcn `<ScrollArea>` for queue list
5. Keep all existing handlers unchanged
6. Run full test suite

**Acceptance Criteria**:
- [ ] Component interface unchanged
- [ ] All tests pass without modification
- [ ] Visual uses glass-morphism
- [ ] Queue functionality identical
- [ ] Performance not degraded

**Tests to Verify**:
- Queue item addition
- Item cancellation
- Lane status display
- ETA calculations

---

### Ticket UI-M-2.3: Migrate ItemGrid - Visual Only
**Priority**: Medium
**Effort**: 2 hours
**Dependencies**: UI-M-2.1

**Tasks**:
1. **PRESERVE**: Item filtering, sorting, queueing logic
2. Apply glass effects to item cards
3. Add hover glows:
   ```tsx
   className={cn(
     "glass-card-hover",
     queueable ? "glow-primary-subtle hover:glow-primary" : "opacity-60"
   )}
   ```
4. Keep grid layout unchanged
5. Test multi-item selection

**Acceptance Criteria**:
- [ ] Grid layout identical
- [ ] Queueing logic unchanged
- [ ] Visual feedback improved with glows
- [ ] Accessibility maintained
- [ ] Tests pass

---

### Ticket UI-M-2.4: Migrate QueueItemRow - Visual Only
**Priority**: Medium
**Effort**: 1 hour
**Dependencies**: UI-M-2.1

**Tasks**:
1. Apply glass card styling to row
2. Add status-based glows:
   - Active: `glow-primary`
   - Pending: `glow-primary-subtle`
   - Completed: no glow
3. Keep progress bars unchanged (or enhance with shadcn Progress)
4. Preserve all event handlers

**Acceptance Criteria**:
- [ ] Row functionality unchanged
- [ ] Visual status clear with glows
- [ ] Cancel button works
- [ ] Tests pass

---

## Phase 3: Polish & Optimization (If Phase 2 Approved)

### Ticket UI-M-3.1: Add Nebula Background Treatment
**Priority**: Low
**Effort**: 1 hour
**Dependencies**: Phase 2 approval

**Tasks**:
1. Add nebula background to `layout.tsx`:
   ```tsx
   <body className="bg-cover bg-center bg-fixed"
         style={{ backgroundImage: url(...) }}>
     <div className="absolute inset-0 bg-gradient-to-b from-background/95" />
     {children}
   </body>
   ```
2. Ensure readability with gradient overlay
3. Test on different screen sizes

**Acceptance Criteria**:
- [ ] Background visible but not distracting
- [ ] Text remains readable
- [ ] Performance not impacted

---

### Ticket UI-M-3.2: Enhance Button Interactions
**Priority**: Low
**Effort**: 1 hour
**Dependencies**: UI-M-2.4

**Tasks**:
1. Add subtle animations to buttons:
   ```css
   .btn-nebula:hover { transform: scale(1.05); }
   .btn-nebula:active { transform: scale(0.95); }
   ```
2. Add glow pulse on important actions
3. Test across all button usages

**Acceptance Criteria**:
- [ ] Animations smooth and subtle
- [ ] No jarring transitions
- [ ] Accessibility not impacted

---

### Ticket UI-M-3.3: Accessibility Audit
**Priority**: High
**Effort**: 2 hours
**Dependencies**: Phase 2 complete

**Tasks**:
1. Test with screen reader (NVDA/VoiceOver)
2. Verify keyboard navigation works
3. Check color contrast ratios (glass effects can reduce contrast)
4. Test focus indicators visible on glass backgrounds
5. Add ARIA labels where needed

**Acceptance Criteria**:
- [ ] WCAG AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus indicators visible

---

### Ticket UI-M-3.4: Performance Testing
**Priority**: High
**Effort**: 1 hour
**Dependencies**: Phase 2 complete

**Tasks**:
1. Run Lighthouse audit
2. Measure bundle size impact:
   ```bash
   npm run build
   # Compare dist/ size before/after
   ```
3. Test backdrop-filter performance on low-end devices
4. Verify no layout shift from glass effects

**Acceptance Criteria**:
- [ ] Bundle size increase < 100KB
- [ ] Performance score > 90
- [ ] No layout shift
- [ ] Smooth on mobile devices

---

## Phase 4: Cleanup & Documentation

### Ticket UI-M-4.1: Remove Old CSS
**Priority**: Medium
**Effort**: 1 hour
**Dependencies**: Phase 3 complete

**Tasks**:
1. Search for unused pink-nebula classes:
   ```bash
   grep -r "pink-nebula-panel" src/
   ```
2. Remove deprecated classes from globals.css
3. Update component documentation
4. Archive old CSS in `legacy/` folder

**Acceptance Criteria**:
- [ ] No unused CSS classes
- [ ] All components use new system
- [ ] Documentation updated

---

### Ticket UI-M-4.2: Create Component Style Guide
**Priority**: Low
**Effort**: 2 hours
**Dependencies**: Phase 3 complete

**Tasks**:
1. Create `docs/nebula-style-guide.md`
2. Document all glass-morphism classes
3. Show examples of each component variant
4. Include do's and don'ts
5. Add screenshots

**Acceptance Criteria**:
- [ ] Guide covers all new utilities
- [ ] Examples clear and copy-pasteable
- [ ] Screenshots included

---

### Ticket UI-M-4.3: Update ADR
**Priority**: Medium
**Effort**: 30 minutes
**Dependencies**: Phase 3 complete

**Tasks**:
1. Add ADR entry to `ARCHITECTURAL_DECISIONS.md`:
   ```
   ## 2025-10-29: Adopted Nebula Command Design System

   Migrated UI to glass-morphism aesthetic using shadcn/ui
   components while preserving all game logic and architecture.
   Chose gradual migration to minimize risk.

   Trade-offs: +100KB bundle size for improved visual polish
   and component reusability.
   ```

**Acceptance Criteria**:
- [ ] ADR entry added
- [ ] Trade-offs documented
- [ ] Rationale clear

---

## Rollback Plan

If at any phase we decide the migration isn't working:

### Emergency Rollback Procedure
1. Create rollback branch: `git checkout -b rollback-nebula-migration`
2. Revert all migration commits:
   ```bash
   git revert <ui-migration-start-sha>..HEAD
   ```
3. Test existing functionality still works
4. Document lessons learned
5. Archive attempt in `Architecture/experiments/nebula-migration-attempt.md`

---

## Success Metrics

### Visual Quality
- [ ] Glass-morphism effects consistent across all components
- [ ] Resource glows provide clear visual feedback
- [ ] No visual regressions from current design

### Technical Health
- [ ] All existing tests pass without modification
- [ ] No new console warnings or errors
- [ ] Bundle size increase < 100KB
- [ ] Performance score maintained

### Developer Experience
- [ ] Migration pattern documented and repeatable
- [ ] Component APIs unchanged
- [ ] TypeScript types accurate
- [ ] Easy to add new components following pattern

### User Experience
- [ ] Accessibility maintained (WCAG AA)
- [ ] No functionality regressions
- [ ] Visual improvements noticeable
- [ ] Performance not degraded

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bundle size bloat | Medium | Medium | Only install needed components, tree-shake aggressively |
| Glass effects reduce readability | Low | High | Extensive contrast testing, adjust opacity if needed |
| Breaking existing tests | Low | Critical | Preserve all component interfaces, run tests after each ticket |
| Performance degradation | Low | Medium | Benchmark before/after, use CSS containment for backdrop-filter |
| Scope creep to full rewrite | Medium | Critical | Strict rule: NO logic changes, only visual presentation |

---

## Decision Gates

### After Phase 1 (Proof-of-Concept):
**Question**: Does the visual improvement justify the effort?
- ✅ Proceed if: Team likes aesthetic, no major issues, performance acceptable
- ⏸️ Adjust if: Minor issues found, need different approach
- ❌ Revert if: Performance problems, accessibility issues, team doesn't like look

### After Phase 2 (Core Components):
**Question**: Is the pattern sustainable for all components?
- ✅ Proceed if: Consistent results, no new blockers, team confident
- ⏸️ Adjust if: Some components problematic, need refinement
- ❌ Revert if: Too many edge cases, maintenance burden too high

### After Phase 3 (Polish):
**Question**: Are we production-ready?
- ✅ Ship if: All metrics green, tests pass, accessibility good
- ⏸️ Hold if: Need more polish, small bugs to fix
- ❌ Revert if: Critical issues found late

---

## Estimated Timeline

- **Phase 0**: 2 hours (foundation)
- **Phase 1**: 4-5 hours (proof-of-concept + validation)
- **Decision Gate 1**: 1 day (review and decide)
- **Phase 2**: 6-8 hours (core migration, if approved)
- **Decision Gate 2**: 1 day (review)
- **Phase 3**: 4-5 hours (polish, if approved)
- **Phase 4**: 3-4 hours (cleanup)

**Total effort**: ~20-25 hours over 1-2 weeks with validation gates

---

## Notes

- **Non-negotiable**: Preserve all game logic, tests must pass unchanged
- **Reversible**: Each phase can be reverted via git
- **Incremental**: Each ticket is shippable independently
- **Validated**: Decision gates prevent sunk cost fallacy
- **Documented**: Migration pattern captured for future reference
