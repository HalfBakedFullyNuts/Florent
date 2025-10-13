import React from 'react'
import { render, within } from '@testing-library/react'
import Home from '../page'

describe('Home page', () => {
  it('renders without crashing', () => {
    const { container } = render(<Home />)
    expect(container).toBeTruthy()
  })

  it('shows header title', () => {
    const { getByText } = render(<Home />)
    expect(getByText(/Florent Simulator/i)).toBeInTheDocument()
  })

  it('shows turn indicator in header', () => {
    const { getAllByText } = render(<Home />)
    const turnElements = getAllByText(/Turn 0/i)
    expect(turnElements.length).toBeGreaterThan(0)
  })

  it('shows completed structures section', () => {
    const { getByText } = render(<Home />)
    expect(getByText(/Completed Structures/i)).toBeInTheDocument()
  })

  it('shows available to build section', () => {
    const { getByText } = render(<Home />)
    expect(getByText(/Available to Build/i)).toBeInTheDocument()
  })

  it('shows build queue section', () => {
    const { getByText } = render(<Home />)
    expect(getByText(/Build Queue/i)).toBeInTheDocument()
  })

  it('shows planet summary section', () => {
    const { getByTestId } = render(<Home />)
    expect(getByTestId('home-planet-summary')).toBeInTheDocument()
  })

  it('mirrors resource totals and abundance in planet summary', () => {
    const { getByTestId } = render(<Home />)
    const summary = getByTestId('home-planet-summary').closest('div')
    if (!summary) throw new Error('Home Planet container missing')

    const tbody = summary.querySelector('tbody')
    if (!tbody) throw new Error('Resource table missing')
    const rows = Array.from(tbody.querySelectorAll('tr'))

    const expectations: Array<{ label: string; income?: string; total?: string }> = [
      { label: 'Metal (100%)', income: '+1,200', total: '30,000' },
      { label: 'Mineral (100%)', income: '+800', total: '20,000' },
      { label: 'Food (100%)', income: '+0', total: '10,000' },
      { label: 'Energy (100%)', income: '+30', total: '1,000' },
    ]

    expectations.forEach(({ label, income, total }, index) => {
      const cells = rows[index]?.querySelectorAll('td')
      if (!cells || cells.length < 3) throw new Error(`Row for ${label} missing cells`)
      expect(cells[0].textContent?.trim()).toBe(label)
      if (income) expect(cells[1].textContent?.replace(/\s+/g, ' ').trim()).toBe(income)
      if (total) expect(cells[2].textContent?.replace(/\s+/g, ' ').trim()).toBe(total)
    })
  })

  it('shows worker growth when food income is non-negative', () => {
    const { getByTestId } = render(<Home />)
    const summary = getByTestId('home-planet-summary').closest('div')
    if (!summary) throw new Error('Home Planet container missing')
    const tbody = summary.querySelector('tbody')
    if (!tbody) throw new Error('Resource table missing')
    expect(summary).toHaveTextContent(/Housing\s*150,000/)
    expect(summary).toHaveTextContent(/Workers\s*\+300\s*30,000/)
    expect(summary).toHaveTextContent(/Busy Workers\s*40,000/)
  })

  it('summarizes housing and space remaining', () => {
    const { getByTestId } = render(<Home />)
    const summary = getByTestId('home-planet-summary')
    expect(summary).toHaveTextContent(/Space Remaining\s*\(51\/40\)/)
    expect(summary).toHaveTextContent(/Housing\s*150,000/)
  })

  it('does not duplicate resource totals in the header', () => {
    const { container } = render(<Home />)
    const headerText = container.querySelector('header')?.textContent || ''
    expect(headerText).not.toMatch(/Metal:/i)
    expect(headerText).not.toMatch(/Mineral:/i)
    expect(headerText).not.toMatch(/Food:/i)
    expect(headerText).not.toMatch(/Energy:/i)
  })

  it('shows reset button', () => {
    const { getByText } = render(<Home />)
    expect(getByText(/Reset/i)).toBeInTheDocument()
  })

  it('shows tab buttons', () => {
    const { container } = render(<Home />)
    const content = container.textContent || ''
    expect(content).toMatch(/Structures/i)
    expect(content).toMatch(/Ships/i)
    expect(content).toMatch(/Colonists/i)
  })
})
