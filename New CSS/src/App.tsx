import { useState } from "react";
import { ResourcePanel } from "./components/ResourcePanel";
import { BuildCard } from "./components/BuildCard";
import { TurnSequencer } from "./components/TurnSequencer";
import { BuildLibrary } from "./components/BuildLibrary";
import { SpacePanel } from "./components/SpacePanel";
import { Button } from "./components/ui/button";
import { Sparkles, Save, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Toaster } from "./components/ui/sonner";
import { ScrollArea } from "./components/ui/scroll-area";

interface BuildItem {
  id: string;
  name: string;
  type: "ship" | "structure" | "tech" | "weapon";
  cost: {
    tyr: number;
    mineral: number;
    food: number;
    energy: number;
  };
  turnsToComplete: number;
  turnsRemaining: number;
  status: "queued" | "building" | "locked";
  stats?: { label: string; value: string | number }[];
  spaceRequired?: number;
}

const buildTemplates = [
  {
    id: "corvette",
    name: "Stardust Corvette",
    type: "ship" as const,
    cost: { tyr: 500, mineral: 300, food: 0, energy: 150 },
    turnsToComplete: 3,
    description: "Fast attack vessel with moderate firepower",
    spaceRequired: 0,
    stats: [
      { label: "Attack", value: 45 },
      { label: "Defense", value: 30 },
      { label: "Speed", value: 85 },
    ],
  },
  {
    id: "cruiser",
    name: "Nebula Cruiser",
    type: "ship" as const,
    cost: { tyr: 1200, mineral: 800, food: 0, energy: 400 },
    turnsToComplete: 5,
    description: "Heavy combat ship with advanced shielding",
    spaceRequired: 0,
    stats: [
      { label: "Attack", value: 75 },
      { label: "Defense", value: 65 },
      { label: "Speed", value: 50 },
    ],
  },
  {
    id: "dreadnought",
    name: "Cosmic Dreadnought",
    type: "ship" as const,
    cost: { tyr: 3000, mineral: 2000, food: 0, energy: 1000 },
    turnsToComplete: 8,
    description: "Massive capital ship, dominates the battlefield",
    spaceRequired: 0,
    stats: [
      { label: "Attack", value: 120 },
      { label: "Defense", value: 100 },
      { label: "Speed", value: 25 },
    ],
  },
  {
    id: "mining-station",
    name: "Asteroid Mining Station",
    type: "structure" as const,
    cost: { tyr: 800, mineral: 400, food: 200, energy: 200 },
    turnsToComplete: 4,
    description: "Increases mineral production by 50/turn",
    spaceRequired: 2,
    stats: [{ label: "Production", value: "+50 Minerals/turn" }],
  },
  {
    id: "power-plant",
    name: "Fusion Power Plant",
    type: "structure" as const,
    cost: { tyr: 600, mineral: 300, food: 100, energy: 100 },
    turnsToComplete: 3,
    description: "Generates additional energy for the empire",
    spaceRequired: 3,
    stats: [{ label: "Production", value: "+75 Energy/turn" }],
  },
  {
    id: "housing-complex",
    name: "Residential Complex",
    type: "structure" as const,
    cost: { tyr: 500, mineral: 400, food: 300, energy: 150 },
    turnsToComplete: 3,
    description: "Increases population capacity",
    spaceRequired: 4,
    stats: [{ label: "Housing", value: "+100 Population" }],
  },
  {
    id: "research-lab",
    name: "Quantum Research Lab",
    type: "structure" as const,
    cost: { tyr: 1000, mineral: 500, food: 300, energy: 300 },
    turnsToComplete: 5,
    description: "Reduces tech research time by 1 turn",
    spaceRequired: 3,
  },
  {
    id: "shield-tech",
    name: "Plasma Shield Matrix",
    type: "tech" as const,
    cost: { tyr: 1500, mineral: 800, food: 0, energy: 600 },
    turnsToComplete: 6,
    description: "Increases all ship defense by 15%",
    spaceRequired: 0,
  },
  {
    id: "weapon-tech",
    name: "Ion Cannon Arrays",
    type: "tech" as const,
    cost: { tyr: 1800, mineral: 1000, food: 0, energy: 700 },
    turnsToComplete: 7,
    description: "Unlocks advanced weapon systems",
    spaceRequired: 0,
  },
  {
    id: "laser-cannon",
    name: "Photon Laser Cannon",
    type: "weapon" as const,
    cost: { tyr: 400, mineral: 200, food: 0, energy: 250 },
    turnsToComplete: 2,
    description: "Standard energy weapon for ships",
    spaceRequired: 0,
    stats: [{ label: "Damage", value: 35 }],
  },
  {
    id: "missile-pod",
    name: "Starburst Missile Pod",
    type: "weapon" as const,
    cost: { tyr: 600, mineral: 350, food: 0, energy: 150 },
    turnsToComplete: 3,
    description: "Long-range missile system",
    spaceRequired: 0,
    stats: [{ label: "Damage", value: 55 }],
  },
];

export default function App() {
  const [currentTurn, setCurrentTurn] = useState(1);
  const [resources, setResources] = useState({
    tyr: 5000,
    mineral: 3000,
    food: 2500,
    energy: 2000,
  });
  const [income] = useState({
    tyr: 500,
    mineral: 300,
    food: 200,
    energy: 250,
  });
  const [capacities] = useState({
    tyr: 10000,
    mineral: 8000,
    food: 6000,
    energy: 5000,
  });
  const [population] = useState({
    current: 450,
    max: 1000,
    growth: 25,
  });
  const [spaceUsed, setSpaceUsed] = useState(15);
  const [spaceTotal] = useState(50);
  const [completedStructures, setCompletedStructures] = useState<
    { name: string; type: string; count: number }[]
  >([
    { name: "Mining Station", type: "structure", count: 2 },
    { name: "Power Plant", type: "structure", count: 3 },
  ]);
  const [buildQueue, setBuildQueue] = useState<BuildItem[]>([]);

  const calculateTurnSequence = () => {
    const sequence = [];
    for (let i = 0; i < 10; i++) {
      const turn = currentTurn + i;
      const events = [];

      if (i === 0) {
        events.push({ type: "income" as const, name: "Resource Income" });
      }

      buildQueue.forEach((build) => {
        const completionTurn = currentTurn + build.turnsRemaining;
        if (completionTurn === turn && build.status === "building") {
          events.push({
            type: "complete" as const,
            name: `${build.name} Complete`,
            icon: build.type === "ship" ? "🚀" : build.type === "structure" ? "🏗️" : build.type === "tech" ? "🔬" : "⚔️",
          });
        }
        if (turn === currentTurn && build.status === "queued") {
          events.push({
            type: "start" as const,
            name: `Start ${build.name}`,
            icon: build.type === "ship" ? "🚀" : build.type === "structure" ? "🏗️" : build.type === "tech" ? "🔬" : "⚔️",
          });
        }
      });

      if (i > 0 && i % 3 === 0) {
        events.push({ type: "income" as const, name: "Resource Income" });
      }

      if (events.length > 0) {
        sequence.push({ turn, events });
      }
    }
    return sequence;
  };

  const handleAddToBuild = (template: typeof buildTemplates[0]) => {
    // Check space for structures
    if (template.type === "structure" && template.spaceRequired) {
      const queuedSpace = buildQueue
        .filter((b) => b.type === "structure")
        .reduce((acc, b) => acc + (b.spaceRequired || 0), 0);
      
      if (spaceUsed + queuedSpace + template.spaceRequired > spaceTotal) {
        toast.error("Insufficient space for this structure!");
        return;
      }
    }

    // Check resources
    const totalCost = buildQueue.reduce(
      (acc, item) => ({
        tyr: acc.tyr + item.cost.tyr,
        mineral: acc.mineral + item.cost.mineral,
        food: acc.food + item.cost.food,
        energy: acc.energy + item.cost.energy,
      }),
      { tyr: template.cost.tyr, mineral: template.cost.mineral, food: template.cost.food, energy: template.cost.energy }
    );

    if (totalCost.tyr > resources.tyr || 
        totalCost.mineral > resources.mineral || 
        totalCost.food > resources.food || 
        totalCost.energy > resources.energy) {
      toast.error("Insufficient resources for this build!");
      return;
    }

    const newBuild: BuildItem = {
      id: `${template.id}-${Date.now()}`,
      name: template.name,
      type: template.type,
      cost: template.cost,
      turnsToComplete: template.turnsToComplete,
      turnsRemaining: template.turnsToComplete,
      status: buildQueue.length === 0 ? "building" : "queued",
      stats: template.stats,
      spaceRequired: template.spaceRequired,
    };

    setBuildQueue([...buildQueue, newBuild]);
    toast.success(`${template.name} added to build queue!`);
  };

  const handleRemoveBuild = (id: string) => {
    const updatedQueue = buildQueue.filter((build) => build.id !== id);
    if (updatedQueue.length > 0 && updatedQueue[0].status === "queued") {
      updatedQueue[0].status = "building";
    }
    setBuildQueue(updatedQueue);
    toast.info("Build removed from queue");
  };

  const handleLockBuild = (id: string) => {
    setBuildQueue(
      buildQueue.map((build) =>
        build.id === id
          ? { ...build, status: build.status === "locked" ? "queued" : "locked" as const }
          : build
      )
    );
  };

  const handleExecuteTurn = () => {
    let updatedQueue = [...buildQueue];
    const buildingItem = updatedQueue.find((b) => b.status === "building");

    if (buildingItem) {
      buildingItem.turnsRemaining -= 1;

      if (buildingItem.turnsRemaining <= 0) {
        toast.success(`${buildingItem.name} completed!`, {
          description: "Your build is ready for deployment",
        });

        // Add to completed structures if it's a structure
        if (buildingItem.type === "structure") {
          const existingStructure = completedStructures.find(
            (s) => s.name === buildingItem.name
          );
          if (existingStructure) {
            setCompletedStructures(
              completedStructures.map((s) =>
                s.name === buildingItem.name ? { ...s, count: s.count + 1 } : s
              )
            );
          } else {
            setCompletedStructures([
              ...completedStructures,
              { name: buildingItem.name, type: buildingItem.type, count: 1 },
            ]);
          }
          setSpaceUsed((prev) => prev + (buildingItem.spaceRequired || 0));
        }
        
        updatedQueue = updatedQueue.filter((b) => b.id !== buildingItem.id);
        
        if (updatedQueue.length > 0) {
          const nextQueued = updatedQueue.find((b) => b.status === "queued");
          if (nextQueued) {
            nextQueued.status = "building";
          }
        }
      }
    }

    setResources((prev) => ({
      tyr: Math.min(prev.tyr + income.tyr, capacities.tyr),
      mineral: Math.min(prev.mineral + income.mineral, capacities.mineral),
      food: Math.min(prev.food + income.food, capacities.food),
      energy: Math.min(prev.energy + income.energy, capacities.energy),
    }));

    setBuildQueue(updatedQueue);
    setCurrentTurn((prev) => prev + 1);
    toast.info(`Turn ${currentTurn + 1} complete`);
  };

  const handleSaveStrategy = () => {
    const strategy = {
      turn: currentTurn,
      resources,
      buildQueue,
      spaceUsed,
      completedStructures,
    };
    localStorage.setItem("spaceStrategyPlan", JSON.stringify(strategy));
    toast.success("Strategy saved successfully!");
  };

  const handleResetStrategy = () => {
    setCurrentTurn(1);
    setResources({ tyr: 5000, mineral: 3000, food: 2500, energy: 2000 });
    setBuildQueue([]);
    setSpaceUsed(15);
    setCompletedStructures([
      { name: "Mining Station", type: "structure", count: 2 },
      { name: "Power Plant", type: "structure", count: 3 },
    ]);
    toast.info("Strategy reset to initial state");
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1602981256888-244edc1f444f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaW5rJTIwbmVidWxhJTIwc3BhY2V8ZW58MXx8fHwxNzYxNTU1NTQyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background/95" />
      
      {/* Content */}
      <div className="relative z-10">
        <Toaster />
        <div className="container mx-auto px-6 py-8 max-w-[1800px]">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="glass-card rounded-full p-3 border-2 border-primary glow-primary">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-foreground mb-1">Nebula Command</h1>
                  <p className="text-muted-foreground text-sm">
                    Strategic Build Planner for Turn-Based Space Conquest
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={handleSaveStrategy} 
                  variant="outline" 
                  className="gap-2 glass-card border-primary/40 hover:border-primary hover:bg-primary/20"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button 
                  onClick={handleResetStrategy} 
                  variant="outline" 
                  className="gap-2 glass-card border-border hover:border-accent hover:bg-accent/20"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </div>

          {/* Resources & Population */}
          <div className="mb-8">
            <ResourcePanel
              resources={resources}
              income={income}
              capacities={capacities}
              population={population}
            />
          </div>

          {/* Space & Completed Structures */}
          <div className="mb-8">
            <SpacePanel
              spaceUsed={spaceUsed}
              spaceTotal={spaceTotal}
              completedStructures={completedStructures}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Queue & Sequencer */}
            <div className="xl:col-span-2 space-y-6">
              {/* Build Queue */}
              <div className="glass-card rounded-lg p-6 border-2 border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-5 w-5 text-primary" />
                  <h2 className="text-foreground">Build Queue</h2>
                </div>
                {buildQueue.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-primary/20 rounded-lg bg-muted/10">
                    <Sparkles className="h-16 w-16 text-primary/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No builds in queue. Add items from the Build Library to get started.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px] pr-4">
                    <div className="space-y-4">
                      {buildQueue.map((build) => (
                        <BuildCard
                          key={build.id}
                          {...build}
                          onRemove={handleRemoveBuild}
                          onLock={handleLockBuild}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Turn Sequencer */}
              <TurnSequencer
                currentTurn={currentTurn}
                turnSequence={calculateTurnSequence()}
                onExecuteTurn={handleExecuteTurn}
              />
            </div>

            {/* Right Column - Build Library */}
            <div>
              <BuildLibrary
                templates={buildTemplates}
                onAddToBuild={handleAddToBuild}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
