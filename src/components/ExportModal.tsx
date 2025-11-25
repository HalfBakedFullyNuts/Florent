"use client";

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import type { LaneView } from '../lib/game/selectors';
import { formatAsText, formatAsDiscord, copyToClipboard } from '../lib/export/formatters';

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
 * - Image: PNG screenshot (requires html2canvas)
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
      // Find the Planet Queue section to capture
      const queueSection = document.querySelector('[data-export-target="planet-queue"]');

      if (!queueSection) {
        showNotification('✗ Could not find queue display');
        return;
      }

      // Capture the element as canvas
      const canvas = await html2canvas(queueSection as HTMLElement, {
        backgroundColor: '#1a1625', // Match pink-nebula-bg
        scale: 2, // Higher quality
      });

      // Convert to blob and download
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
      });
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
