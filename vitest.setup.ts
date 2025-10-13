import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/font/google for node test environment
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'font-inter' }),
}))
