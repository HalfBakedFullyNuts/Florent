# Code Quality Rules

Adapted from NASA/JPL's "Power of 10" for safety-critical systems, modified for TypeScript/JavaScript idioms.

### 1. Simple Control Flow
- **No recursion**: Avoid direct or indirect recursive calls. Use iterative solutions with explicit loop bounds.
- **No complex control flow**: Prefer early returns over deeply nested conditionals. Maximum nesting depth: 3 levels.

### 2. Bounded Iterations
- **Array iterations are bounded**: `.forEach()`, `.map()`, `.filter()`, `.reduce()` on arrays are inherently bounded by array length—these are acceptable.
- **While loops require guards**: Any `while` loop must have a `MAX_ITERATIONS` constant and break condition to prevent infinite loops.
```typescript
const MAX_ITERATIONS = 1000;
let iterations = 0;
while (condition && iterations < MAX_ITERATIONS) {
  iterations++;
  // ... logic
}
if (iterations >= MAX_ITERATIONS) {
  throw new Error('Loop exceeded maximum iterations');
}
```

### 3. Controlled Collection Growth
- **Pre-size when possible**: If array size is known, pre-allocate with `new Array(size)`.
- **Cap dynamic collections**: Collections that grow dynamically should have maximum size limits enforced.
- **Document unbounded growth**: If a collection must grow unboundedly, add a comment explaining why and what bounds exist in practice.

### 4. Function Length Limit
- **Maximum 60 lines per function** (excluding comments and blank lines).
- **Split large functions**: Extract logical chunks into well-named helper functions.
- **Single responsibility**: Each function should do one thing well.

### 5. Assertion Density
- **Minimum 2 assertions per non-trivial function**: Use guard clauses to validate assumptions.
- **Assertions must have recovery**: Return error results or throw with descriptive messages.
- **Use TypeScript's type system**: Let the compiler catch what it can; use runtime checks for what it cannot.
```typescript
function processItem(item: Item | null): Result {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }
  if (item.quantity < 0) {
    return { success: false, error: 'Quantity must be non-negative' };
  }
  // ... main logic
}
```

### 6. Minimal Scope
- **Declare variables at point of use**: Use `const` by default, `let` only when reassignment is needed.
- **No `var`**: Always use block-scoped `const`/`let`.
- **Avoid module-level mutable state**: Prefer pure functions that take state as parameters.

### 7. Return Value Handling
- **Check all fallible operations**: Handle `null`, `undefined`, and error results explicitly.
- **Use Result types for operations that can fail**: Prefer `{ success: boolean, data?, error? }` over throwing.
- **Validate function parameters**: Check required parameters at function entry.

### 8. Type Safety
- **No `any` type**: Use `unknown` and narrow with type guards if type is truly unknown.
- **No type assertions without validation**: `as` casts should be preceded by runtime checks.
- **Strict null checks enabled**: Handle `null`/`undefined` explicitly.

### 9. Static Analysis
- **Zero ESLint warnings**: All code must pass linting with the project's ESLint config.
- **Zero TypeScript errors**: Strict mode enabled, no `@ts-ignore` without justification comment.
- **Run before commit**: `npm run lint && npm run build` must pass.

### 10. Callbacks and Higher-Order Functions
- **Named functions over anonymous**: Prefer named function declarations for debugging and stack traces.
- **No deeply nested callbacks**: Maximum callback depth of 2. Use async/await or extract to named functions.
```typescript
// Preferred: named functions
const isActive = (item: Item) => item.status === 'active';
const items = allItems.filter(isActive);

// Avoid: nested anonymous callbacks
const result = data.map(x => x.items.filter(y => y.children.some(z => z.active)));
```
