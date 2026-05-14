export const MANUAL_LINKS = {
  resources: 'https://manual.infiniteconflict.com/books/quick-reference/page/list-of-resources',
  structures: 'https://manual.infiniteconflict.com/books/quick-reference/page/list-of-structures',
  ships: 'https://manual.infiniteconflict.com/books/quick-reference/page/list-of-ships',
  colonists: 'https://manual.infiniteconflict.com/books/quick-reference/page/list-of-colonists',
  travelTimes: 'https://manual.infiniteconflict.com/books/quick-reference/page/travel-times',
} as const;

export type ManualLinkKey = keyof typeof MANUAL_LINKS;

// Per-lane manual topics: ship gets both ships and travel times.
export const LANE_MANUAL_TOPICS: Partial<Record<string, ManualLinkKey[]>> = {
  building: ['structures'],
  ship: ['ships', 'travelTimes'],
  colonist: ['colonists'],
};
