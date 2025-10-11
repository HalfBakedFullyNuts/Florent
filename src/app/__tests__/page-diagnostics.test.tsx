import React from 'react';
import { render } from '@testing-library/react';
import Home from '../page';

describe('Home page diagnostics', () => {
  it('should be a function', () => {
    expect(typeof Home).toBe('function');
  });

  it('should not throw when called', () => {
    expect(() => render(<Home />)).not.toThrow();
  });

  it('should return JSX', () => {
    const { container } = render(<Home />);
    expect(container).toBeTruthy();
    expect(container.nodeType).toBeTruthy();
  });

  it('should render with Testing Library', () => {
    // This will fail if Home is not a valid React component
    expect(() => render(<Home />)).not.toThrow();
  });
});
