import React from 'react'
import { render, screen } from '@testing-library/react'
import BuildList from '../BuildList'

describe('BuildList', () => {
  it('renders provided items with fallback tier label', () => {
    render(<BuildList items={[{ id: 'm1', name: 'Metal Mine' }, { id: 'p1', name: 'Power Plant', tier: 'Tier 2' }]} />)

    expect(screen.getByText('Metal Mine')).toBeInTheDocument()
    expect(screen.getByText('Power Plant')).toBeInTheDocument()
    expect(screen.getAllByText('Tier 1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Tier 2')).toBeInTheDocument()
  })
})
