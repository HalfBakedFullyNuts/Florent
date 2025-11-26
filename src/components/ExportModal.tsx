"use client";

import React, { useState } from 'react';
import type { LaneView } from '../lib/game/selectors';
import { formatAsText, formatAsDiscord, copyToClipboard, extractQueueItems } from '../lib/export/formatters';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingLane: LaneView;
  shipLane: LaneView;
  colonistLane: LaneView;
  currentTurn: number;
  exportMode: 'full' | 'current'; // full = all items, current = up to current turn
}

/**
 * ExportModal - Export build queue in various formats
 *
 * TICKET-5: Queue Export Functionality
 * Supports three export types:
 * - Plain Text: Simple list format
 * - Discord: Formatted table with character limit check
 * - Image: PNG rendered via canvas with watermark
 */
export function ExportModal({
  isOpen,
  onClose,
  buildingLane,
  shipLane,
  colonistLane,
  currentTurn,
  exportMode,
}: ExportModalProps) {
  const [notification, setNotification] = useState<string | null>(null);

  const laneViews = [buildingLane, shipLane, colonistLane];

  // Determine maxTurn based on export mode
  const maxTurn = exportMode === 'current' ? currentTurn : undefined;

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExportText = async () => {
    const text = formatAsText(laneViews, maxTurn);

    if (!text) {
      showNotification('Queue is empty - nothing to export');
      return;
    }

    const success = await copyToClipboard(text);
    if (success) {
      showNotification('✓ Copied to clipboard!');
    } else {
      showNotification('✗ Failed to copy to clipboard');
    }
  };

  const handleExportDiscord = async () => {
    const discord = formatAsDiscord(laneViews, maxTurn);

    const success = await copyToClipboard(discord);
    if (success) {
      if (discord.includes('exceeds character limit')) {
        showNotification('⚠️ Copied with warning - may exceed Discord limit');
      } else {
        showNotification('✓ Copied to clipboard!');
      }
    } else {
      showNotification('✗ Failed to copy to clipboard');
    }
  };

  const handleExportImage = async () => {
    try {
      const items = extractQueueItems(laneViews, maxTurn);

      if (items.length === 0) {
        showNotification('Queue is empty - nothing to export');
        return;
      }

      // Group items by turn
      const turnGroups = new Map<number, typeof items>();
      items.forEach(item => {
        if (!turnGroups.has(item.turn)) {
          turnGroups.set(item.turn, []);
        }
        turnGroups.get(item.turn)!.push(item);
      });

      const sortedTurns = Array.from(turnGroups.keys()).sort((a, b) => a - b);

      // Canvas setup
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Sizing
      const padding = 40;
      const lineHeight = 28;
      const headerHeight = 60;
      const watermarkHeight = 40;
      const canvasWidth = 500;
      const canvasHeight = headerHeight + (sortedTurns.length * lineHeight) + watermarkHeight + padding * 2;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Background
      ctx.fillStyle = '#1a1625';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Header
      ctx.fillStyle = '#e0d4f7';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('Build Order', padding, padding + 24);

      ctx.fillStyle = '#9d8ec2';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Turn ${currentTurn}`, padding, padding + 48);

      // Build list
      let y = padding + headerHeight;
      ctx.font = '16px monospace';

      sortedTurns.forEach(turn => {
        const turnItems = turnGroups.get(turn)!;

        // Format: [Turn] - Building, Ship, Colonist
        const parts: string[] = [];

        const building = turnItems.find(i => i.lane === 'building');
        const ship = turnItems.find(i => i.lane === 'ship');
        const colonist = turnItems.find(i => i.lane === 'colonist');

        if (building) parts.push(building.name);
        if (ship) parts.push(`${ship.quantity}x ${ship.name}`);
        if (colonist) parts.push(`${colonist.quantity}x ${colonist.name}`);

        const text = `[${String(turn).padStart(3)}] ${parts.join(', ')}`;

        ctx.fillStyle = '#c4b5e0';
        ctx.fillText(text, padding, y);
        y += lineHeight;
      });

      // Watermark
      ctx.fillStyle = '#6b5a8e';
      ctx.font = 'italic 12px sans-serif';
      ctx.fillText('Infinite Conflict Build Planner', padding, canvasHeight - 20);

      // Download
      canvas.toBlob((blob) => {
        if (!blob) {
          showNotification('✗ Failed to generate image');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `build-order-turn-${currentTurn}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        showNotification('✓ Image downloaded!');
      }, 'image/png');
    } catch (error) {
      console.error('Image export error:', error);
      showNotification('✗ Failed to export image');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-slate-800 border-2 border-pink-nebula-border rounded-lg p-6 max-w-md w-full pointer-events-auto shadow-2xl">
          <h2 className="text-xl font-bold text-pink-nebula-text mb-4">
            Export Build Queue
          </h2>

          <div className="text-sm text-pink-nebula-muted mb-4">
            Current Turn: {currentTurn}
          </div>

          <div className="space-y-3">
            {/* Plain Text Export */}
            <button
              onClick={handleExportText}
              className="w-full p-3 bg-slate-700 hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded text-left transition-colors"
            >
              <div className="font-semibold text-pink-nebula-text">Export as Plain Text</div>
              <div className="text-xs text-pink-nebula-muted mt-1">
                Simple list format - copied to clipboard
              </div>
            </button>

            {/* Discord Export */}
            <button
              onClick={handleExportDiscord}
              className="w-full p-3 bg-slate-700 hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded text-left transition-colors"
            >
              <div className="font-semibold text-pink-nebula-text">Export for Discord</div>
              <div className="text-xs text-pink-nebula-muted mt-1">
                Formatted table (8,192 char limit) - copied to clipboard
              </div>
            </button>

            {/* Image Export */}
            <button
              onClick={handleExportImage}
              className="w-full p-3 bg-slate-700 hover:bg-pink-nebula-accent-primary/20 border border-pink-nebula-border rounded text-left transition-colors"
            >
              <div className="font-semibold text-pink-nebula-text">Export as Image</div>
              <div className="text-xs text-pink-nebula-muted mt-1">
                PNG file - captures Planet Queue display
              </div>
            </button>
          </div>

          {/* Notification */}
          {notification && (
            <div className="mt-4 p-3 bg-pink-nebula-accent-primary/20 border border-pink-nebula-accent-primary rounded text-sm text-pink-nebula-text text-center animate-fade-in">
              {notification}
            </div>
          )}

          {/* Cancel Button */}
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-pink-nebula-muted hover:text-pink-nebula-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
