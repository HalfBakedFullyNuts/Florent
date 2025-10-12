import React from 'react';
import { render } from '@testing-library/react';
import Home from '../page';

describe('Home page', () => {
  it('renders without crashing', () => {
    const { container } = render(<Home />);
    expect(container).toBeTruthy();
  });

  it('shows header title', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Florent Simulator/i)).toBeInTheDocument();
  });

  it('shows turn indicator in header', () => {
    const { getAllByText } = render(<Home />);
    const turnElements = getAllByText(/Turn 0/i);
    expect(turnElements.length).toBeGreaterThan(0);
  });

  it('shows completed structures section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Completed Structures/i)).toBeInTheDocument();
  });

  it('shows available to build section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Available to Build/i)).toBeInTheDocument();
  });

  it('shows build queue section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Build Queue/i)).toBeInTheDocument();
  });

  it('shows planet summary section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Planet Summary/i)).toBeInTheDocument();
  });

  it('shows resource display', () => {
    const { container } = render(<Home />);
    const metalText = container.textContent || '';
    expect(metalText).toMatch(/Metal:/i);
    expect(metalText).toMatch(/Mineral:/i);
    expect(metalText).toMatch(/Food:/i);
    expect(metalText).toMatch(/Energy:/i);
  });

  it('shows reset button', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Reset/i)).toBeInTheDocument();
  });

  it('shows tab buttons', () => {
    const { container } = render(<Home />);
    const content = container.textContent || '';
    expect(content).toMatch(/Structures/i);
    expect(content).toMatch(/Ships/i);
    expect(content).toMatch(/Colonists/i);
  });
});