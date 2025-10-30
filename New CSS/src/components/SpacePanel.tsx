import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { Building2, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/badge";

interface SpacePanelProps {
  spaceUsed: number;
  spaceTotal: number;
  completedStructures?: {
    name: string;
    type: string;
    count: number;
  }[];
}

export function SpacePanel({ spaceUsed, spaceTotal, completedStructures }: SpacePanelProps) {
  const spacePercentage = (spaceUsed / spaceTotal) * 100;
  const spaceRemaining = spaceTotal - spaceUsed;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Space Remaining */}
      <div className="glass-card rounded-lg p-6 border-2 border-amber-500/30 glow-energy">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-amber-400" />
          <h3 className="text-amber-400">Space Remaining</h3>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-4xl text-amber-400">
                {spaceRemaining.toLocaleString()}
              </span>
              <span className="text-muted-foreground ml-2">/ {spaceTotal.toLocaleString()}</span>
            </div>
            <Badge 
              variant="outline" 
              className={`${
                spacePercentage > 90 
                  ? "bg-red-500/20 text-red-400 border-red-500/40" 
                  : spacePercentage > 70
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                  : "bg-green-500/20 text-green-400 border-green-500/40"
              }`}
            >
              {spacePercentage.toFixed(0)}% used
            </Badge>
          </div>

          <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
                spacePercentage > 90
                  ? "bg-red-500"
                  : spacePercentage > 70
                  ? "bg-amber-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${Math.min(spacePercentage, 100)}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Each structure requires space. Expand your territory to build more.
          </p>
        </div>
      </div>

      {/* Completed Structures */}
      <div className="glass-card rounded-lg p-6 border-2 border-green-500/30">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <h3 className="text-green-400">Completed Structures</h3>
        </div>

        {completedStructures && completedStructures.length > 0 ? (
          <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2">
            {completedStructures.map((structure, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-muted/20 rounded-lg border border-border"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏗️</span>
                  <span className="text-sm text-foreground">{structure.name}</span>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                  x{structure.count}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No structures completed yet
          </div>
        )}
      </div>
    </div>
  );
}
