'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './styles.css';

// Types for our game concept
interface PlanetData {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  resources: {
    metal: number;
    energy: number;
    crystal: number;
  };
  controlled: boolean;
  population: number;
  defense: number;
}

interface FleetUnit {
  id: string;
  type: 'scout' | 'fighter' | 'cruiser' | 'carrier';
  count: number;
  power: number;
  speed: number;
}

interface Mission {
  id: string;
  name: string;
  type: 'explore' | 'colonize' | 'attack' | 'defend' | 'trade';
  status: 'planning' | 'active' | 'completed';
  progress: number;
  reward: string;
}

const GalacticCommandCenter: React.FC = () => {
  // Game state
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [commandPoints, setCommandPoints] = useState(100);
  const [galacticTime, setGalacticTime] = useState(0);
  const [alertLevel, setAlertLevel] = useState<'peaceful' | 'caution' | 'danger'>('peaceful');
  const [activeView, setActiveView] = useState<'galaxy' | 'fleet' | 'missions' | 'research'>('galaxy');

  // Animation refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Generate random planets for our galaxy
  const planets = useMemo<PlanetData[]>(() => {
    const planetNames = ['Nova Prime', 'Crystallia', 'Nexus VII', 'Omega Station', 'Aurora Belt', 'Void Harbor'];
    return planetNames.map((name, i) => ({
      id: `planet-${i}`,
      name,
      x: 150 + (i % 3) * 200 + Math.random() * 50,
      y: 150 + Math.floor(i / 3) * 180 + Math.random() * 50,
      size: 20 + Math.random() * 30,
      color: ['#e91e63', '#00b0ff', '#ffab40', '#b388ff', '#69f0ae'][Math.floor(Math.random() * 5)],
      resources: {
        metal: Math.floor(Math.random() * 1000),
        energy: Math.floor(Math.random() * 800),
        crystal: Math.floor(Math.random() * 500)
      },
      controlled: i < 2,
      population: i < 2 ? Math.floor(Math.random() * 50000) + 10000 : 0,
      defense: Math.floor(Math.random() * 100)
    }));
  }, []);

  // Fleet composition
  const [fleet] = useState<FleetUnit[]>([
    { id: 'scouts', type: 'scout', count: 25, power: 10, speed: 100 },
    { id: 'fighters', type: 'fighter', count: 15, power: 30, speed: 80 },
    { id: 'cruisers', type: 'cruiser', count: 5, power: 100, speed: 50 },
    { id: 'carriers', type: 'carrier', count: 2, power: 200, speed: 30 }
  ]);

  // Active missions
  const [missions] = useState<Mission[]>([
    { id: 'm1', name: 'Explore Nebula X-7', type: 'explore', status: 'active', progress: 65, reward: '+500 Crystal' },
    { id: 'm2', name: 'Establish Trade Route', type: 'trade', status: 'active', progress: 30, reward: '+100 Energy/turn' },
    { id: 'm3', name: 'Defend Mining Colony', type: 'defend', status: 'planning', progress: 0, reward: '+1000 Metal' }
  ]);

  // Animated starfield background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars: Array<{ x: number; y: number; size: number; speed: number }> = [];
    const numStars = 100;

    // Initialize stars
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1
      });
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(18, 12, 24, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.size / 2})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Move star
        star.x -= star.speed;
        if (star.x < 0) {
          star.x = canvas.width;
          star.y = Math.random() * canvas.height;
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Game timer
  useEffect(() => {
    const timer = setInterval(() => {
      setGalacticTime(prev => prev + 1);

      // Random events
      if (Math.random() > 0.95) {
        const alerts: Array<'peaceful' | 'caution' | 'danger'> = ['peaceful', 'caution', 'danger'];
        setAlertLevel(alerts[Math.floor(Math.random() * alerts.length)]);
      }

      // Regenerate command points
      setCommandPoints(prev => Math.min(100, prev + 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handlePlanetClick = (planet: PlanetData) => {
    setSelectedPlanet(planet);
    setCommandPoints(prev => Math.max(0, prev - 5));
  };

  const renderGalaxyView = () => (
    <div className="galaxy-view">
      <svg className="galaxy-map" viewBox="0 0 800 500">
        {/* Draw connections between controlled planets */}
        {planets.filter(p => p.controlled).map((planet, i, controlled) =>
          controlled.slice(i + 1).map(other => (
            <line
              key={`${planet.id}-${other.id}`}
              x1={planet.x}
              y1={planet.y}
              x2={other.x}
              y2={other.y}
              stroke="#e91e63"
              strokeWidth="1"
              opacity="0.3"
              strokeDasharray="5,5"
            />
          ))
        )}

        {/* Draw planets */}
        {planets.map(planet => (
          <g key={planet.id} onClick={() => handlePlanetClick(planet)} className="planet-node">
            {/* Planet glow effect */}
            <circle
              cx={planet.x}
              cy={planet.y}
              r={planet.size + 10}
              fill={planet.color}
              opacity="0.2"
              className="planet-glow"
            />

            {/* Planet body */}
            <circle
              cx={planet.x}
              cy={planet.y}
              r={planet.size}
              fill={planet.color}
              stroke={planet.controlled ? '#00ff00' : '#ffffff'}
              strokeWidth={planet.controlled ? '3' : '1'}
              className="planet-body"
            />

            {/* Planet name */}
            <text
              x={planet.x}
              y={planet.y + planet.size + 20}
              fill="#ffffff"
              fontSize="12"
              textAnchor="middle"
              className="planet-name"
            >
              {planet.name}
            </text>

            {/* Control indicator */}
            {planet.controlled && (
              <text
                x={planet.x}
                y={planet.y}
                fill="#ffffff"
                fontSize="20"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                ⚑
              </text>
            )}
          </g>
        ))}
      </svg>

      {selectedPlanet && (
        <div className="planet-info-panel">
          <h3>{selectedPlanet.name}</h3>
          <div className="planet-stats">
            <div className="stat-row">
              <span className="stat-label">Status:</span>
              <span className={`stat-value ${selectedPlanet.controlled ? 'controlled' : 'neutral'}`}>
                {selectedPlanet.controlled ? '🟢 Controlled' : '⚪ Neutral'}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Population:</span>
              <span className="stat-value">{selectedPlanet.population.toLocaleString()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Defense:</span>
              <div className="defense-bar">
                <div className="defense-fill" style={{ width: `${selectedPlanet.defense}%` }} />
              </div>
            </div>
            <div className="resources-grid">
              <div className="resource">
                <span className="resource-icon">🔩</span>
                <span>{selectedPlanet.resources.metal}</span>
              </div>
              <div className="resource">
                <span className="resource-icon">⚡</span>
                <span>{selectedPlanet.resources.energy}</span>
              </div>
              <div className="resource">
                <span className="resource-icon">💎</span>
                <span>{selectedPlanet.resources.crystal}</span>
              </div>
            </div>
            <div className="planet-actions">
              <button className="action-btn colonize" disabled={selectedPlanet.controlled}>
                🏴 Colonize
              </button>
              <button className="action-btn attack" disabled={selectedPlanet.controlled}>
                ⚔️ Attack
              </button>
              <button className="action-btn trade" disabled={!selectedPlanet.controlled}>
                💰 Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFleetView = () => (
    <div className="fleet-view">
      <h3 className="view-title">Fleet Composition</h3>
      <div className="fleet-grid">
        {fleet.map(unit => (
          <div key={unit.id} className="fleet-card">
            <div className="fleet-icon">
              {unit.type === 'scout' && '🛸'}
              {unit.type === 'fighter' && '✈️'}
              {unit.type === 'cruiser' && '🚀'}
              {unit.type === 'carrier' && '🛳️'}
            </div>
            <div className="fleet-type">{unit.type.toUpperCase()}</div>
            <div className="fleet-count">{unit.count} units</div>
            <div className="fleet-stats">
              <span>⚔️ {unit.power}</span>
              <span>💨 {unit.speed}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="fleet-total">
        Total Fleet Power: <span className="power-value">
          {fleet.reduce((sum, unit) => sum + unit.power * unit.count, 0)}
        </span>
      </div>
    </div>
  );

  const renderMissionsView = () => (
    <div className="missions-view">
      <h3 className="view-title">Active Missions</h3>
      <div className="missions-list">
        {missions.map(mission => (
          <div key={mission.id} className={`mission-card ${mission.status}`}>
            <div className="mission-header">
              <span className="mission-type-icon">
                {mission.type === 'explore' && '🔍'}
                {mission.type === 'colonize' && '🏴'}
                {mission.type === 'attack' && '⚔️'}
                {mission.type === 'defend' && '🛡️'}
                {mission.type === 'trade' && '💰'}
              </span>
              <span className="mission-name">{mission.name}</span>
            </div>
            <div className="mission-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${mission.progress}%` }}
                />
              </div>
              <span className="progress-text">{mission.progress}%</span>
            </div>
            <div className="mission-reward">
              Reward: {mission.reward}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="galactic-command-center">
      <canvas ref={canvasRef} className="starfield-canvas" width={800} height={600} />

      <div className="command-header">
        <div className="header-left">
          <h1 className="command-title">
            <span className="title-icon">🌌</span>
            Galactic Command Center
          </h1>
          <div className="time-display">
            Stardate: <span className="time-value">{galacticTime.toString().padStart(6, '0')}</span>
          </div>
        </div>

        <div className="header-center">
          <div className={`alert-status ${alertLevel}`}>
            <span className="alert-icon">
              {alertLevel === 'peaceful' && '🟢'}
              {alertLevel === 'caution' && '🟡'}
              {alertLevel === 'danger' && '🔴'}
            </span>
            <span className="alert-text">{alertLevel.toUpperCase()}</span>
          </div>
        </div>

        <div className="header-right">
          <div className="command-points">
            <span className="points-label">Command Points</span>
            <div className="points-display">
              <div className="points-bar">
                <div className="points-fill" style={{ width: `${commandPoints}%` }} />
              </div>
              <span className="points-value">{commandPoints}/100</span>
            </div>
          </div>
        </div>
      </div>

      <div className="command-nav">
        {(['galaxy', 'fleet', 'missions', 'research'] as const).map(view => (
          <button
            key={view}
            className={`nav-btn ${activeView === view ? 'active' : ''}`}
            onClick={() => setActiveView(view)}
          >
            {view === 'galaxy' && '🌍 Galaxy Map'}
            {view === 'fleet' && '🚀 Fleet Command'}
            {view === 'missions' && '📋 Missions'}
            {view === 'research' && '🔬 Research'}
          </button>
        ))}
      </div>

      <div className="command-content">
        {activeView === 'galaxy' && renderGalaxyView()}
        {activeView === 'fleet' && renderFleetView()}
        {activeView === 'missions' && renderMissionsView()}
        {activeView === 'research' && (
          <div className="research-view">
            <h3 className="view-title">Research Laboratory</h3>
            <div className="research-coming-soon">
              🔬 Advanced Technologies Coming Soon...
            </div>
          </div>
        )}
      </div>

      <div className="command-footer">
        <div className="quick-stats">
          <div className="stat">
            <span className="stat-icon">🌍</span>
            <span className="stat-label">Controlled Planets:</span>
            <span className="stat-value">{planets.filter(p => p.controlled).length}</span>
          </div>
          <div className="stat">
            <span className="stat-icon">👥</span>
            <span className="stat-label">Total Population:</span>
            <span className="stat-value">
              {planets.filter(p => p.controlled)
                .reduce((sum, p) => sum + p.population, 0)
                .toLocaleString()}
            </span>
          </div>
          <div className="stat">
            <span className="stat-icon">⚡</span>
            <span className="stat-label">Energy Production:</span>
            <span className="stat-value">
              +{planets.filter(p => p.controlled)
                .reduce((sum, p) => sum + p.resources.energy, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GalacticCommandCenter;