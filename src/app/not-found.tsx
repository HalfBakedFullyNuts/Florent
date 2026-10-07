export default function NotFound() {
  return (
    <div className="px-4 py-16">
      <div className="panel mx-auto max-w-2xl p-6 text-center">
        <div className="eyebrow">404</div>
        <h1 className="mt-1 text-2xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-ink-2">The page you requested could not be found.</p>
        <a href="./" className="btn btn-primary mt-4">Open the planner</a>
      </div>
    </div>
  )
}
