import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Search } from "lucide-react";
import { useState } from "react";
import { BuildCard } from "./BuildCard";
import { ScrollArea } from "./ui/scroll-area";

interface BuildTemplate {
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
  description: string;
  stats?: { label: string; value: string | number }[];
  spaceRequired?: number;
}

interface BuildLibraryProps {
  templates: BuildTemplate[];
  onAddToBuild: (template: BuildTemplate) => void;
}

export function BuildLibrary({ templates, onAddToBuild }: BuildLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || template.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Group templates by type
  const groupedTemplates = {
    ship: filteredTemplates.filter((t) => t.type === "ship"),
    structure: filteredTemplates.filter((t) => t.type === "structure"),
    tech: filteredTemplates.filter((t) => t.type === "tech"),
    weapon: filteredTemplates.filter((t) => t.type === "weapon"),
  };

  return (
    <div className="glass-card rounded-lg p-6 border-2 border-primary/20">
      <h2 className="text-foreground mb-4">Build Library</h2>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search builds..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-muted/30 border-border focus:border-primary/50"
        />
      </div>

      <Tabs value={selectedType} onValueChange={setSelectedType} className="mb-4">
        <TabsList className="grid w-full grid-cols-5 bg-muted/30">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="ship">Ships</TabsTrigger>
          <TabsTrigger value="structure">Structures</TabsTrigger>
          <TabsTrigger value="tech">Tech</TabsTrigger>
          <TabsTrigger value="weapon">Weapons</TabsTrigger>
        </TabsList>
      </Tabs>

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-4">
          {selectedType === "all" ? (
            <>
              {groupedTemplates.ship.length > 0 && (
                <div>
                  <h3 className="text-sm text-blue-400 mb-2">🚀 Ships</h3>
                  <div className="space-y-3">
                    {groupedTemplates.ship.map((template) => (
                      <BuildCard
                        key={template.id}
                        {...template}
                        status="available"
                        onAdd={() => onAddToBuild(template)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {groupedTemplates.structure.length > 0 && (
                <div>
                  <h3 className="text-sm text-amber-400 mb-2">🏗️ Structures</h3>
                  <div className="space-y-3">
                    {groupedTemplates.structure.map((template) => (
                      <BuildCard
                        key={template.id}
                        {...template}
                        status="available"
                        onAdd={() => onAddToBuild(template)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {groupedTemplates.tech.length > 0 && (
                <div>
                  <h3 className="text-sm text-violet-400 mb-2">🔬 Technology</h3>
                  <div className="space-y-3">
                    {groupedTemplates.tech.map((template) => (
                      <BuildCard
                        key={template.id}
                        {...template}
                        status="available"
                        onAdd={() => onAddToBuild(template)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {groupedTemplates.weapon.length > 0 && (
                <div>
                  <h3 className="text-sm text-rose-400 mb-2">⚔️ Weapons</h3>
                  <div className="space-y-3">
                    {groupedTemplates.weapon.map((template) => (
                      <BuildCard
                        key={template.id}
                        {...template}
                        status="available"
                        onAdd={() => onAddToBuild(template)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <BuildCard
                  key={template.id}
                  {...template}
                  status="available"
                  onAdd={() => onAddToBuild(template)}
                />
              ))}
            </div>
          )}

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No builds found matching your criteria
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
