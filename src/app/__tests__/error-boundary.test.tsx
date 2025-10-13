import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import GlobalError from '../error'

describe('GlobalError boundary', () => {
  it('renders recovery UI and logs error message', () => {
    const reset = vi.fn()
    const error = new Error('kaboom')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<GlobalError error={error} reset={reset} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()

    expect(spy).toHaveBeenCalledWith('Unhandled error in app:', error)
    spy.mockRestore()
  })
})
