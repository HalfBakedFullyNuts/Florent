UI Florent quickstart

What I added

- Tailwind tokens in `tailwind.config.js` (colors under `pink-nebula` and `Inter` font)
- CSS variables and utility classes in `src/app/globals.css` (theme tokens + small helper classes)
- Components:
  - `src/components/Header.tsx` — minimal header showing planet tabs and resource summary
  - `src/components/BuildList.tsx` — left-column build list example
  - `src/components/QueueCard.tsx` — queued-item card example

How to use

- Ensure you have Tailwind configured (project already had Tailwind). The `tailwind.config.js` was extended with the `pink-nebula` colors and `Inter` font.
- Import components into `src/app/page.tsx` or other pages. Example:

```tsx
import Header from '../components/Header'
import BuildList from '../components/BuildList'
import QueueCard from '../components/QueueCard'

export default function Page(){
  return (
    <div className="min-h-screen bg-florent-shell">
      <div id="stars1" />
      <div id="stars2" />
      <div id="stars3" />
      <Header />
      <main className="p-6 grid grid-cols-[280px_1fr_320px] gap-6">
        <BuildList items={[{id:'m1', name:'Metal Mine'}]} />
        <div>
          <QueueCard />
        </div>
        <aside className="bg-florent-panel p-4 rounded">Planet Summary</aside>
      </main>
    </div>
  )
}
```

Notes & next steps

- The code uses CSS variables for the main theme. If you use Tailwind classes for color, map them to the tokens in `tailwind.config.js` or use the helper classes in `globals.css`.
- The components are intentionally minimal — they're scaffolding to be extended with actual data and behaviors.

If you want I can:
- Replace helper classes with full Tailwind utility classes mapped to tokens (preferred if you use Tailwind heavily).
- Create a small Storybook or Vitest-driven visual test for the components.
- Flesh out the components with real data from the game agent.
