/**
 * Script to add research items to game_data.json
 * Converts research_data.json format to game_data format
 */

const fs = require('fs');
const path = require('path');

// Load the research data
const researchData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/lib/game/research_data.json'), 'utf-8')
);

// Load the game data
const gameData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/lib/game/game_data.json'), 'utf-8')
);

// Convert research items to game_data format
const researchUnits = researchData.map(research => {
  const unit = {
    id: research.id,
    name: research.name,
    category: 'research',
    tier: research.tier,
    build_time_turns: research.turnsToComplete,
    cost: [
      {
        type: 'resource',
        id: 'research_points',
        amount: research.rpCost
      }
    ],
    build_requirements: {
      // Research doesn't require workers
      workers_occupied: 0
    },
    consumption: [],
    requirements: research.prerequisites || [],
    operations: [],
    score_value: Math.floor(research.rpCost / 100) // Score based on RP cost
  };

  // Add operations based on effects
  if (research.effects) {
    if (research.effects.planetLimit) {
      unit.operations.push({
        type: 'on_complete',
        effect: 'set_planet_limit',
        value: research.effects.planetLimit
      });
    }

    if (research.effects.unlocksResearch) {
      unit.operations.push({
        type: 'on_complete',
        effect: 'unlock_research',
        items: research.effects.unlocksResearch
      });
    }

    if (research.effects.unlocksStructure) {
      unit.operations.push({
        type: 'on_complete',
        effect: 'unlock_structure',
        item: research.effects.unlocksStructure
      });
    }

    if (research.effects.unlocksUnit) {
      unit.operations.push({
        type: 'on_complete',
        effect: 'unlock_unit',
        item: research.effects.unlocksUnit
      });
    }
  }

  return unit;
});

// Add research units to game data
if (!gameData.research) {
  gameData.research = [];
}
gameData.research = researchUnits;

// Update meta information
gameData.meta.version = '3.1.0';
gameData.meta.description += ' Research system added with 36 research items.';
gameData.meta.updated_at = new Date().toISOString();

// Write back to game_data.json
fs.writeFileSync(
  path.join(__dirname, '../src/lib/game/game_data.json'),
  JSON.stringify(gameData, null, 2),
  'utf-8'
);

console.log(`Successfully added ${researchUnits.length} research items to game_data.json`);
console.log('\nResearch categories:');
console.log('- Basic research: 3 items');
console.log('- Planet Limit increases: 11 items (PL 6-24)');
console.log('- Unit/structure unlocks: 12 items');
console.log('- Technology improvements: 10 items');