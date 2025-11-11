import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VerticalTurnSlider } from '../VerticalTurnSlider';

describe('VerticalTurnSlider (TICKET-9)', () => {
  const defaultProps = {
    currentTurn: 50,
    totalTurns: 200,
    onTurnChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render current turn and total turns', () => {
    render(<VerticalTurnSlider {...defaultProps} />);

    // Check the number input specifically
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(50);
    expect(screen.getByText('/ 200')).toBeInTheDocument();
  });

  it('should display turn numbers at intervals of 20', () => {
    render(<VerticalTurnSlider {...defaultProps} />);

    // Check for turn labels
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('should highlight current turn label', () => {
    const { rerender } = render(<VerticalTurnSlider {...defaultProps} currentTurn={60} />);

    const turn60Label = screen.getByText('60');
    expect(turn60Label).toHaveClass('text-pink-nebula-accent-primary', 'font-bold');

    // Change turn and verify highlight moves
    rerender(<VerticalTurnSlider {...defaultProps} currentTurn={80} />);
    const turn80Label = screen.getByText('80');
    expect(turn80Label).toHaveClass('text-pink-nebula-accent-primary', 'font-bold');
  });

  it('should jump to turn when label clicked', () => {
    const onTurnChange = vi.fn();
    render(<VerticalTurnSlider {...defaultProps} onTurnChange={onTurnChange} />);

    const turn100Label = screen.getByText('100');
    fireEvent.click(turn100Label);

    expect(onTurnChange).toHaveBeenCalledWith(100);
  });

  it('should update turn when input value changes', () => {
    const onTurnChange = vi.fn();
    render(<VerticalTurnSlider {...defaultProps} onTurnChange={onTurnChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '75' } });

    expect(onTurnChange).toHaveBeenCalledWith(75);
  });

  it('should not allow invalid turn values in input', () => {
    const onTurnChange = vi.fn();
    render(<VerticalTurnSlider {...defaultProps} onTurnChange={onTurnChange} />);

    const input = screen.getByRole('spinbutton');

    // Try to set turn to 0 (below minimum)
    fireEvent.change(input, { target: { value: '0' } });
    expect(onTurnChange).not.toHaveBeenCalled();

    // Try to set turn to 201 (above maximum)
    fireEvent.change(input, { target: { value: '201' } });
    expect(onTurnChange).not.toHaveBeenCalled();

    // Try to set invalid value
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onTurnChange).not.toHaveBeenCalled();
  });

  it('should handle quick jump buttons', () => {
    const onTurnChange = vi.fn();
    render(<VerticalTurnSlider {...defaultProps} onTurnChange={onTurnChange} />);

    // Click Start button
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);
    expect(onTurnChange).toHaveBeenCalledWith(1);

    // Click Mid button
    const midButton = screen.getByText('Mid');
    fireEvent.click(midButton);
    expect(onTurnChange).toHaveBeenCalledWith(100); // 200/2

    // Click End button
    const endButton = screen.getByText('End');
    fireEvent.click(endButton);
    expect(onTurnChange).toHaveBeenCalledWith(200);
  });

  it('should update when slider value changes', () => {
    const onTurnChange = vi.fn();
    render(<VerticalTurnSlider {...defaultProps} onTurnChange={onTurnChange} />);

    const slider = screen.getByLabelText('Turn slider');
    fireEvent.change(slider, { target: { value: '150' } });

    expect(onTurnChange).toHaveBeenCalledWith(150);
  });

  it('should maintain value when switching turns', () => {
    const { rerender } = render(<VerticalTurnSlider {...defaultProps} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(50);

    // Update to new turn
    rerender(<VerticalTurnSlider {...defaultProps} currentTurn={125} />);
    expect(input).toHaveValue(125);
  });
});