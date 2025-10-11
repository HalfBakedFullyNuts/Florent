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
    expect(getByText(/Infinite Conflict/i)).toBeInTheDocument();
  });

  it('shows resource summary', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Resources:/i)).toBeInTheDocument();
  });

  it('shows buildings section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Buildings/i)).toBeInTheDocument();
  });

  it('shows build queue section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Build Queue/i)).toBeInTheDocument();
  });

  it('shows planet summary section', () => {
    const { getByText } = render(<Home />);
    expect(getByText(/Planet Summary/i)).toBeInTheDocument();
  });
});
