# Share Metadata Future Work

Florent now has the client-side pieces needed to summarize a shared build list, but it does not yet provide true external link unfurls for each individual build list.

## What Exists Now

- `buildSharedBuildListSummary` in `src/components/SharedBuildListView.tsx`
  - Computes the build-list summary from decoded game state.
  - Includes the build-list name, first Outpost Ship completion, first Invasion Ship completion, first Soldier completion, Outpost Ships started before T200, home T200 output, and home T200 population when those values exist.

- `SharedBuildListView`
  - Displays the summary in the shared build-list preview.
  - Updates client-side page metadata after React loads:
    - `document.title`
    - `meta[name="description"]`
    - `meta[property="og:title"]`
    - `meta[property="og:description"]`
    - `meta[name="twitter:title"]`
    - `meta[name="twitter:description"]`

- URL loading support in `src/lib/game/urlState.ts`
  - Existing `#q=` compact share links remain supported.
  - `?q=` compact share payloads are also accepted, which makes local metadata testing easier and gives a future server route a cleaner input shape.

- Local test route
  - `src/app/share-summary-test/page.tsx`
  - Open `http://localhost:3000/share-summary-test/`, paste a share URL or payload, and inspect the generated visible summary plus client-side metadata.

## Current Limitation

The production app currently uses `output: 'export'` in `next.config.js`, so it is statically exported.

Most normal share links use a hash fragment:

```text
https://example.com/#q=...
```

Browsers do not send the hash fragment to the server. A crawler such as Discord, Slack, Twitter/X, or Facebook usually fetches only:

```text
https://example.com/
```

That crawler sees the generic static HTML metadata from `src/app/layout.tsx`. It does not run the React app, decode the `#q=` payload, simulate the build, and wait for client-side meta tags to change. Because of that, per-build-list external unfurls are not solved by the current client-side implementation.

## Future Implementation Path

To support true external unfurls later:

1. Use share URLs that expose the payload before client hydration, such as:

   ```text
   /share?q=...
   /s/[payload]
   ```

2. Add a server-rendered metadata path that can decode the payload and call the same summary logic before returning HTML metadata.

3. Decide whether to keep static export.
   - If the app remains fully static, true dynamic per-share unfurls are not available without an external service or pre-generated pages.
   - If a server/runtime deployment is allowed, Next metadata generation can render per-share OpenGraph/Twitter tags.

4. Reuse the existing summary contract.
   - Keep `buildSharedBuildListSummary` as the source of truth for summary text.
   - Avoid duplicating the summary rules in a separate crawler-only path.

## Testing Later

For now, test the available client-side behavior locally:

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Create a build list and copy a share link.
4. Open `http://localhost:3000/share-summary-test/`.
5. Paste the share link and click `Load Summary`.
6. Verify the visible summary and generated metadata fields on the test page.
