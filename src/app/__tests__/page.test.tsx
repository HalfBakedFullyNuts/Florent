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
    expect(getByText(/Infinite Conflict Simulator/i)).toBeInTheDocument();
  });

  it('does not show resource display in header (Ticket 21)', () => {
    const { queryByText } = render(<Home />);
    // Header should NOT contain resource displays like "Metal: 30.000"
    expect(queryByText(/Metal:/i)).not.toBeInTheDocument();
    expect(queryByText(/Mineral:/i)).not.toBeInTheDocument();
    expect(queryByText(/Food:/i)).not.toBeInTheDocument();
    // Note: Energy appears in "Energy" resource label in PlanetSummary, so skip that check
  });

  it('shows clean header with title and turn controls (Ticket 21)', () => {
    const { getByText, getByLabelText, container } = render(<Home />);
    // Header should contain title
    expect(getByText(/Infinite Conflict Simulator/i)).toBeInTheDocument();
    // Turn controls should be present via TurnSlider
    expect(getByLabelText(/Turn slider/i)).toBeInTheDocument();
    // Verify header structure
    const header = container.querySelector('header');
    expect(header).toBeInTheDocument();
  });

  it('shows structures lane', () => {
    const { getAllByText } = render(<Home />);
    const structuresElements = getAllByText(/Structures/i);
    expect(structuresElements.length).toBeGreaterThan(0);
  });

  it('shows ships lane', () => {
    const { getAllByText } = render(<Home />);
    const shipsElements = getAllByText(/Ships/i);
    expect(shipsElements.length).toBeGreaterThan(0);
  });

  it('shows planet dashboard section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/^Resources$/i)).toBeInTheDocument();
  });

  it('shows turn navigation controls', () => {
    const { getByLabelText } = render(<Home />);
    expect(getByLabelText(/Turn slider/i)).toBeInTheDocument();
  });

  it('shows turn slider controls', () => {
    const { getByLabelText } = render(<Home />);
    expect(getByLabelText(/Turn slider/i)).toBeInTheDocument();
  });
});
