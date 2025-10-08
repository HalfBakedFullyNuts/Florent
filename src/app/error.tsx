"use client"

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to the console so developers see it in dev
    console.error('Unhandled error in app:', error)
  }, [error])

  return (
    <html>
      <body className="p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-700">An unexpected error occurred. You can try to recover:</p>
          <div className="mt-4">
            <button className="px-3 py-1 rounded border" onClick={() => reset()}>
              Try again
            </button>
          </div>
          <pre className="mt-4 text-xs bg-gray-100 p-3 rounded overflow-auto">{String(error?.message)}</pre>
        </div>
      </body>
    </html>
  )
}
