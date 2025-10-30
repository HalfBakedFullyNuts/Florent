import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Trash2, Lock, Unlock, Clock } from "lucide-react";

interface BuildCardProps {
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
  turnsRemaining?: number;
  status: "queued" | "building" | "locked" | "available";
  onRemove?: (id: string) => void;
  onLock?: (id: string) => void;
  onAdd?: (id: string) => void;
  stats?: { label: string; value: string | number }[];
  spaceRequired?: number;
}

const typeColors = {
  ship: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  structure: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  tech: "bg-violet-500/20 text-violet-400 border-violet-500/40",
  weapon: "bg-rose-500/20 text-rose-400 border-rose-500/40",
};

const typeIcons = {
  ship: "🚀",
  structure: "🏗️",
  tech: "🔬",
  weapon: "⚔️",
};

export function BuildCard({
  id,
  name,
  type,
  cost,
  turnsToComplete,
  turnsRemaining,
  status,
  onRemove,
  onLock,
  onAdd,
  stats,
  spaceRequired,
}: BuildCardProps) {
  const isBuilding = status === "building";
  const isQueued = status === "queued";
  const isLocked = status === "locked";
  const isAvailable = status === "available";

  return (
    <div
      className={`glass-card glass-card-hover rounded-lg p-4 border-2 transition-all duration-300 ${
        isBuilding
          ? "border-primary glow-primary"
          : isLocked
          ? "border-accent/30 opacity-60"
          : isQueued
          ? "border-primary/40"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">{typeIcons[type]}</span>
          <div className="flex-1">
            <h4 className="text-foreground mb-1">{name}</h4>
            <div className="flex gap-2 flex-wrap">
              <Badge className={typeColors[type]} variant="outline">
                {type}
              </Badge>
              {isBuilding && turnsRemaining !== undefined && (
                <Badge className="bg-primary/20 text-primary border-primary/40">
                  Building: {turnsRemaining}t left
                </Badge>
              )}
              {isQueued && (
                <Badge className="bg-muted/50 text-muted-foreground border-muted-foreground/30">
                  Queued
                </Badge>
              )}
            </div>
          </div>
        </div>

        {!isAvailable && (
          <div className="flex gap-1">
            {onLock && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary/20 hover:text-primary"
                onClick={() => onLock(id)}
              >
                {isLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/20 hover:text-destructive"
                onClick={() => onRemove(id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Cost Grid */}
        <div className="grid grid-cols-4 gap-2">
          {cost.tyr > 0 && (
            <div className="bg-gray-400/10 rounded-lg p-2 border border-gray-400/30">
              <div className="text-xs text-gray-300/70 mb-1">Tyr</div>
              <div className="text-gray-300">{cost.tyr}</div>
            </div>
          )}
          {cost.mineral > 0 && (
            <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/30">
              <div className="text-xs text-red-300/70 mb-1">Mineral</div>
              <div className="text-red-400">{cost.mineral}</div>
            </div>
          )}
          {cost.food > 0 && (
            <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/30">
              <div className="text-xs text-green-300/70 mb-1">Food</div>
              <div className="text-green-400">{cost.food}</div>
            </div>
          )}
          {cost.energy > 0 && (
            <div className="bg-cyan-500/10 rounded-lg p-2 border border-cyan-500/30">
              <div className="text-xs text-cyan-300/70 mb-1">Energy</div>
              <div className="text-cyan-400">{cost.energy}</div>
            </div>
          )}
        </div>

        {/* Build Time & Space */}
        <div className="flex gap-2">
          <div className="flex-1 bg-muted/30 rounded-lg p-2 border border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Build:</span>
            <span className="text-foreground ml-auto">{turnsToComplete}t</span>
          </div>
          {spaceRequired !== undefined && (
            <div className="flex-1 bg-muted/30 rounded-lg p-2 border border-border flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Space:</span>
              <span className="text-foreground ml-auto">{spaceRequired}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && stats.length > 0 && (
          <div className="pt-2 space-y-1 border-t border-border/50">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{stat.label}:</span>
                <span className="text-foreground">{stat.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Add Button for Available Items */}
        {isAvailable && onAdd && (
          <Button
            onClick={() => onAdd(id)}
            className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary hover:text-primary"
            variant="outline"
          >
            Add to Queue
          </Button>
        )}

        {/* Progress Bar for Building */}
        {isBuilding && turnsRemaining !== undefined && (
          <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
              style={{
                width: `${((turnsToComplete - turnsRemaining) / turnsToComplete) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
