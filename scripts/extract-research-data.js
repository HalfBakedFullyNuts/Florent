const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = path.join(__dirname, '..', 'Infinite Conflict Beta _Costs (1).csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Parse CSV rows - simple semicolon split since there are no complex quoted values
const rows = csvContent.split('\n').map(row => row.split(';'));

// Extract research items (rows 51-86, 0-indexed so 50-85)
const researchData = [];

for (let i = 50; i < Math.min(87, rows.length); i++) {
  const row = rows[i];
  if (!row || row.length < 20) continue;

  const type = row[0];
  if (type !== 'Research') continue;

  const tier = row[1];
  const name = row[2];
  const rpCost = row[11]; // Column 11 - RP Cost
  const turnsToComplete = row[16]; // Column 16 - Turns to Complete
  const requirements = row[20]; // Column 20 - Requirements

  if (!name || !rpCost || !turnsToComplete) continue;

  // Convert name to ID (e.g., "Planet Management" -> "planet_management")
  const id = name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');

  // Parse tier
  const tierNum = parseFloat(tier.replace(',', '.'));

  // Parse requirements
  const prerequisites = [];
  if (requirements && requirements.trim() && requirements !== 'none') {
    // Split by semicolon or comma
    const reqList = requirements.split(/[;,]/).map(r => r.trim()).filter(Boolean);
    for (const req of reqList) {
      // Convert requirement to ID format
      const reqId = req.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w_]/g, '');
      if (reqId) {
        prerequisites.push(reqId);
      }
    }
  }

  // Determine effects based on name
  const effects = {};

  // Planet Limit increases
  if (name.startsWith('PL ')) {
    const limitMatch = name.match(/PL (\d+)/);
    if (limitMatch) {
      effects.planetLimit = parseInt(limitMatch[1]);
    }
  }

  // Research that unlocks other research
  if (name === 'Planet Management') {
    effects.unlocksResearch = ['pl_6'];
  } else if (name === 'Fleet Technology') {
    effects.unlocksResearch = ['merchant_research', 'trader_research', 'war_ship_design', 'warp_theory'];
  } else if (name === 'Resource Collection') {
    effects.unlocksResearch = ['core_metal_mine_research', 'core_mineral_extractor_research',
                               'hydroponics_lab_research', 'solar_array_research',
                               'mass_production', 'land_enhancement'];
  } else if (name === 'War Ship Design') {
    effects.unlocksResearch = ['destroyer_research', 'cruiser_research', 'battleship_research'];
  } else if (name === 'Warp Theory') {
    effects.unlocksResearch = ['hyperspace_beacon_research', 'jump_gate_research'];
  } else if (name === 'Land Enhancement') {
    effects.unlocksResearch = ['metal_refinery_research', 'mineral_processor_research',
                               'food_purifier_research', 'energy_booster_research'];
  } else if (name === 'Mass Production') {
    effects.unlocksResearch = ['strip_metal_mine_research', 'strip_mineral_extractor_research',
                               'hydroponics_dome_research', 'solar_station_research'];
  }

  // Research that unlocks units/structures
  const unlockMappings = {
    'Destroyer Research': 'destroyer',
    'Cruiser Research': 'cruiser',
    'Battleship Research': 'battleship',
    'Merchant Research': 'merchant',
    'Trader Research': 'trader',
    'Hyperspace Beacon Research': 'hyperspace_beacon',
    'Jump Gate Research': 'jump_gate',
    'Core Metal Mine Research': 'core_metal_mine',
    'Core Mineral Extractor Research': 'core_mineral_extractor',
    'Hydroponics Lab Research': 'hydroponics_lab',
    'Solar Array Research': 'solar_array',
    'Metal Refinery Research': 'metal_refinery',
    'Mineral Processor Research': 'mineral_processor',
    'Food Purifier Research': 'food_purifier',
    'Energy Booster Research': 'energy_booster',
    'Strip Metal Mine Research': 'strip_metal_mine',
    'Strip Mineral Extractor Research': 'strip_mineral_extractor',
    'Hydroponics Dome Research': 'hydroponics_dome',
    'Solar Station Research': 'solar_station',
  };

  if (unlockMappings[name]) {
    effects.unlocksStructure = unlockMappings[name];
  }

  const researchItem = {
    id,
    name,
    tier: tierNum,
    rpCost: parseInt(rpCost),
    turnsToComplete: parseInt(turnsToComplete),
    prerequisites,
    effects
  };

  researchData.push(researchItem);
}

// Output the research data
console.log('// Research data extracted from CSV');
console.log('// Add this to game_data.json under a "research" key');
console.log(JSON.stringify(researchData, null, 2));

// Also save to a file
const outputPath = path.join(__dirname, '..', 'src', 'lib', 'game', 'research_data.json');
fs.writeFileSync(outputPath, JSON.stringify(researchData, null, 2));
console.log(`\nResearch data saved to: ${outputPath}`);
console.log(`Total research items extracted: ${researchData.length}`);