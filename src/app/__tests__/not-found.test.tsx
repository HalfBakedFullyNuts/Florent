import React from 'react'
import { render, screen } from '@testing-library/react'
import NotFound from '../not-found'

describe('NotFound page', () => {
  it('displays not found messaging', () => {
    render(<NotFound />)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(screen.getByText(/could not be found/i)).toBeInTheDocument()
  })
})
