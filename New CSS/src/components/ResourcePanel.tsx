import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { TrendingUp } from "lucide-react";

interface ResourcePanelProps {
  resources: {
    tyr: number;
    mineral: number;
    food: number;
    energy: number;
  };
  income: {
    tyr: number;
    mineral: number;
    food: number;
    energy: number;
  };
  capacities: {
    tyr: number;
    mineral: number;
    food: number;
    energy: number;
  };
  population?: {
    current: number;
    max: number;
    growth: number;
  };
}

export function ResourcePanel({ resources, income, capacities, population }: ResourcePanelProps) {
  const resourceData = [
    {
      name: "Tyr",
      current: resources.tyr,
      income: income.tyr,
      capacity: capacities.tyr,
      color: "text-gray-300",
      bgGradient: "from-gray-400/20 to-gray-500/10",
      borderColor: "border-gray-400/30",
      glowClass: "glow-tyr",
      progressColor: "bg-gray-400",
    },
    {
      name: "Mineral",
      current: resources.mineral,
      income: income.mineral,
      capacity: capacities.mineral,
      color: "text-red-400",
      bgGradient: "from-red-500/20 to-red-600/10",
      borderColor: "border-red-500/30",
      glowClass: "glow-mineral",
      progressColor: "bg-red-500",
    },
    {
      name: "Food",
      current: resources.food,
      income: income.food,
      capacity: capacities.food,
      color: "text-green-400",
      bgGradient: "from-green-500/20 to-green-600/10",
      borderColor: "border-green-500/30",
      glowClass: "glow-food",
      progressColor: "bg-green-500",
    },
    {
      name: "Energy",
      current: resources.energy,
      income: income.energy,
      capacity: capacities.energy,
      color: "text-cyan-400",
      bgGradient: "from-cyan-500/20 to-cyan-600/10",
      borderColor: "border-cyan-500/30",
      glowClass: "glow-energy",
      progressColor: "bg-cyan-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Resources Grid */}
      <div className="grid grid-cols-2 gap-4">
        {resourceData.map((resource) => {
          const percentage = (resource.current / resource.capacity) * 100;
          const isAtCapacity = resource.current >= resource.capacity;

          return (
            <div
              key={resource.name}
              className={`glass-card rounded-lg p-4 border-2 ${resource.borderColor} ${resource.glowClass} transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`${resource.color}`}>{resource.name}</h3>
                {resource.income !== 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className={`h-3 w-3 ${resource.income > 0 ? 'text-green-400' : 'text-red-400'}`} />
                    <span className={resource.income > 0 ? 'text-green-400' : 'text-red-400'}>
                      {resource.income > 0 ? '+' : ''}{resource.income}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className={`text-3xl ${resource.color}`}>
                    {resource.current.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / {resource.capacity.toLocaleString()}
                  </span>
                </div>
                <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full ${resource.progressColor} transition-all duration-500 rounded-full`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                  {isAtCapacity && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Population Panel */}
      {population && (
        <div className="glass-card rounded-lg p-6 border-2 border-orange-600/30" style={{ boxShadow: '0 0 15px rgba(234, 88, 12, 0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-orange-500">Population</h3>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span className="text-green-400">+{population.growth} per turn</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-4xl text-orange-500">
                {population.current.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                / {population.max.toLocaleString()}
              </span>
            </div>
            <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.min((population.current / population.max) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Housing capacity determines maximum population
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
