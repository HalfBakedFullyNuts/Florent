import React from 'react'
import { render, screen } from '@testing-library/react'
import Header from '../Header'

describe('Header', () => {
  it('shows planet navigation buttons and resource summary', () => {
    render(<Header />)

    expect(screen.getByRole('button', { name: 'HW' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mars' })).toBeInTheDocument()
    expect(screen.getByText('30,000')).toBeInTheDocument()
    expect(screen.getByText('+1,200/t')).toBeInTheDocument()
  })
})
