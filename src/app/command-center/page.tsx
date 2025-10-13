'use client';

import GalacticCommandCenter from '@/components/GalacticCommandCenter';

export default function CommandCenterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#120c18] to-[#0f0912] flex items-center justify-center p-8">
      {/* Background stars effect from main app */}
      <div id="stars1" />
      <div id="stars2" />
      <div id="stars3" />

      <div className="w-full max-w-7xl" style={{ position: 'relative', zIndex: 1 }}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-pink-nebula-accent-primary mb-4">
            🚀 Galactic Command Center Demo
          </h1>
          <p className="text-pink-nebula-muted">
            An interactive strategic command interface with real-time galaxy simulation
          </p>
        </div>

        <GalacticCommandCenter />

        <div className="mt-8 text-center text-pink-nebula-muted text-sm">
          <p>💡 Click on planets to view details • Navigate between Galaxy, Fleet, Missions, and Research views</p>
          <p className="mt-2">⚡ Command points regenerate over time • Watch the alert status change dynamically</p>
        </div>
      </div>
    </div>
  );
}