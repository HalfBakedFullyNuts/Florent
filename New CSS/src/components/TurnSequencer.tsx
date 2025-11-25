import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ChevronRight, Play, Clock } from "lucide-react";

interface TurnEvent {
  turn: number;
  events: {
    type: "complete" | "start" | "income";
    name: string;
    icon?: string;
  }[];
}

interface TurnSequencerProps {
  currentTurn: number;
  turnSequence: TurnEvent[];
  onExecuteTurn: () => void;
}

export function TurnSequencer({
  currentTurn,
  turnSequence,
  onExecuteTurn,
}: TurnSequencerProps) {
  return (
    <div className="glass-card rounded-lg p-6 border-2 border-primary/30 glow-primary">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-foreground mb-1">Turn Sequencer</h2>
          <p className="text-muted-foreground text-sm">
            Plan and preview upcoming turns
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass-card rounded-lg px-4 py-2 border border-primary/40">
            <div className="text-xs text-muted-foreground mb-1">Current Turn</div>
            <div className="text-3xl text-primary text-center">{currentTurn}</div>
          </div>
          <Button 
            onClick={onExecuteTurn} 
            className="gap-2 bg-primary/20 hover:bg-primary/30 border-2 border-primary text-primary hover:text-primary glow-primary"
            size="lg"
          >
            <Play className="h-5 w-5" />
            Execute Turn
          </Button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute top-0 bottom-0 left-7 w-0.5 bg-gradient-to-b from-primary via-accent to-secondary opacity-40"></div>

        <div className="space-y-4">
          {turnSequence.slice(0, 6).map((turnData) => {
            const isCurrent = turnData.turn === currentTurn;
            const isPast = turnData.turn < currentTurn;

            return (
              <div key={turnData.turn} className="relative flex gap-4 items-start">
                <div
                  className={`relative z-10 flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCurrent
                      ? "bg-primary border-primary text-primary-foreground shadow-lg glow-primary scale-110"
                      : isPast
                      ? "bg-muted/50 border-muted-foreground/30 text-muted-foreground"
                      : "bg-card border-primary/40 text-foreground"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs opacity-70">T</div>
                    <div className={isCurrent ? "" : "text-sm"}>{turnData.turn}</div>
                  </div>
                </div>

                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-foreground">Turn {turnData.turn}</h4>
                    {isCurrent && (
                      <Badge className="bg-primary/20 text-primary border-primary/40 glow-primary">
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    {turnData.events.map((event, eventIdx) => (
                      <div
                        key={eventIdx}
                        className={`glass-card rounded-lg p-3 border transition-all duration-200 hover:scale-[1.02] ${
                          event.type === "complete"
                            ? "border-green-500/40 bg-green-500/10"
                            : event.type === "start"
                            ? "border-primary/40 bg-primary/10"
                            : "border-cyan-500/40 bg-cyan-500/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {event.icon && <span className="text-xl">{event.icon}</span>}
                          <span className={`text-sm flex-1 ${
                            event.type === "complete"
                              ? "text-green-400"
                              : event.type === "start"
                              ? "text-primary"
                              : "text-cyan-400"
                          }`}>
                            {event.name}
                          </span>
                          {event.type === "complete" && (
                            <ChevronRight className="h-4 w-4 text-green-400" />
                          )}
                          {event.type === "start" && (
                            <Clock className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
