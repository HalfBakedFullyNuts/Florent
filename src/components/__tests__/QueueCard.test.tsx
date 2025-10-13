import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import QueueCard from '../QueueCard'

describe('QueueCard', () => {
  it('displays queue information and fires delete handler', () => {
    const onDelete = vi.fn()
    render(<QueueCard name="Metal Mine" turns={4} progress={0.5} onDelete={onDelete} />)

    expect(screen.getByText('Metal Mine')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
