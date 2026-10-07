"use client"

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to the console so developers see it in dev
    console.error('Unhandled error in app:', error)
  }, [error])

  return (
    <div className="px-4 py-16">
      <div className="panel mx-auto max-w-2xl p-6">
        <div className="eyebrow text-danger">Error</div>
        <h1 className="mt-1 text-2xl font-bold text-ink">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-2">The planner hit an unexpected error. Try again; your plan is kept in the URL and local saves.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => reset()}>
          Try again
        </button>
        <pre className="well mt-4 overflow-auto p-3 text-xs text-ink-2">{String(error?.message)}</pre>
      </div>
    </div>
  )
}
