# 🌌 Galactic Command Center Component

A stunning, interactive strategic command interface component for space-themed games and applications. This standalone component features real-time galaxy simulation, fleet management, mission tracking, and beautiful visual effects.

## ✨ Features

### Core Functionality
- **Interactive Galaxy Map**: Click on planets to view details and perform actions
- **Fleet Management**: View and manage your space fleet composition
- **Mission System**: Track active missions with progress bars and rewards
- **Research Lab**: Placeholder for future technology tree implementation
- **Real-time Simulation**: Auto-updating galactic time and alert levels
- **Command Points**: Resource system that regenerates over time

### Visual Effects
- **Animated Starfield**: Canvas-based parallax star background
- **Glowing Effects**: Pulsating planets and UI elements
- **Alert Animations**: Dynamic status indicators with color transitions
- **Smooth Transitions**: Professional hover states and view changes
- **Gradient Overlays**: Beautiful color gradients throughout the UI

## 🚀 Installation

This component is completely standalone and can be integrated into any Next.js/React project.

### 1. Copy Component Files

Copy the entire `GalacticCommandCenter` folder to your components directory:

```bash
src/components/GalacticCommandCenter/
├── index.tsx       # Main component logic
├── styles.css      # All component styles
└── README.md       # This file
```

### 2. Import and Use

```tsx
import GalacticCommandCenter from '@/components/GalacticCommandCenter';

function YourPage() {
  return (
    <div>
      <GalacticCommandCenter />
    </div>
  );
}
```

## 🎮 Game Mechanics

### Planet System
- **6 Procedurally Generated Planets**: Each with unique resources and properties
- **Resource Types**: Metal, Energy, Crystal
- **Planet Actions**: Colonize, Attack, Trade (context-aware based on control status)
- **Visual Indicators**: Controlled planets show green borders and flag icons

### Fleet Composition
- **Scout Ships**: Fast reconnaissance units
- **Fighters**: Balanced combat vessels
- **Cruisers**: Heavy assault ships
- **Carriers**: Capital ships with high power

### Mission Types
- 🔍 **Explore**: Discover new sectors
- 🏴 **Colonize**: Establish new colonies
- ⚔️ **Attack**: Assault enemy positions
- 🛡️ **Defend**: Protect your territories
- 💰 **Trade**: Establish commerce routes

## 🎨 Customization

### Color Scheme

The component uses CSS variables that can be overridden:

```css
/* In your global CSS */
.galactic-command-center {
  --primary-color: #e91e63;     /* Pink accent */
  --secondary-color: #00b0ff;   /* Blue accent */
  --success-color: #69f0ae;     /* Green */
  --warning-color: #ffab40;     /* Orange */
  --danger-color: #ff3d71;      /* Red */
}
```

### Modifying Game Data

Edit the component's internal state to customize:

```tsx
// In index.tsx, modify the planets generation
const planetNames = ['Your', 'Custom', 'Planet', 'Names'];

// Adjust fleet composition
const [fleet] = useState<FleetUnit[]>([
  { id: 'custom', type: 'scout', count: 50, power: 15, speed: 120 },
  // Add your units...
]);
```

## 📱 Responsive Design

The component is fully responsive with breakpoints at:
- **Desktop**: 1200px+ (full layout)
- **Tablet**: 768px-1199px (stacked layout)
- **Mobile**: <768px (vertical layout)

## 🔧 Props & API

Currently, the component doesn't accept props but can be easily modified:

```tsx
interface GalacticCommandCenterProps {
  initialPlanets?: PlanetData[];
  initialFleet?: FleetUnit[];
  onPlanetClick?: (planet: PlanetData) => void;
  onMissionComplete?: (mission: Mission) => void;
}
```

## 🌟 Visual Features

### Animations
- **Rotating galaxy icon**: 20s rotation cycle
- **Pulsating alerts**: Status-based animation speeds
- **Planet hover effects**: Glow intensification
- **Progress bars**: Smooth fill transitions
- **View transitions**: Fade-in effects

### Interactive Elements
- **Clickable planets** with hover states
- **Navigation tabs** with active indicators
- **Action buttons** with disabled states
- **Progress tracking** for missions
- **Real-time counters** for resources

## 🎯 Use Cases

Perfect for:
- **Space Strategy Games**: Command center interface
- **Sci-Fi Dashboards**: Futuristic control panels
- **Educational Apps**: Space exploration simulators
- **Portfolio Projects**: Showcase interactive UI skills
- **Game Prototypes**: Quick strategic game interfaces

## 🚧 Future Enhancements

Potential additions:
- **Multiplayer Support**: Real-time fleet battles
- **Research Tree**: Technology progression system
- **Trade Routes**: Economic gameplay layer
- **Battle Animations**: Visual combat sequences
- **Save/Load System**: Persistent game state
- **Sound Effects**: Audio feedback for actions

## 📄 License

This component is created as a standalone module for the Florent project.
Feel free to adapt and modify for your needs.

---

**Created with 💜 for the Florent Simulator Project**