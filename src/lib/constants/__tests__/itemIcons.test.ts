import { describe, it, expect } from 'vitest';
import { getItemImageUrl } from '../itemIcons';

describe('getItemImageUrl', () => {
  it('returns a valid Cloudflare URL for a known structure', () => {
    const url = getItemImageUrl('metal_mine', 24, 24);
    expect(url).not.toBeNull();
    expect(url).toContain('beta.infiniteconflict.com/cdn-cgi/image');
    expect(url).toContain('width=24');
    expect(url).toContain('height=24');
    expect(url).toContain('format=webp');
    expect(url).toContain('images/buildings/metal-mine.jpg');
  });

  it('returns a valid Cloudflare URL for a known ship', () => {
    const url = getItemImageUrl('fighter', 32, 32);
    expect(url).not.toBeNull();
    expect(url).toContain('width=32');
    expect(url).toContain('height=32');
    expect(url).toContain('images/ships/fighter.jpg');
  });

  it('returns a valid Cloudflare URL for a colonist', () => {
    const url = getItemImageUrl('soldier', 24, 24);
    expect(url).not.toBeNull();
    expect(url).toContain('images/colonists/soldier.jpg');
  });

  it('returns null for an unknown item', () => {
    expect(getItemImageUrl('nonexistent_item', 24, 24)).toBeNull();
  });

  it('returns null for an empty item ID', () => {
    expect(getItemImageUrl('', 24, 24)).toBeNull();
  });

  it('includes all required Cloudflare parameters', () => {
    const url = getItemImageUrl('farm', 48, 48)!;
    expect(url).toContain('contrast=1');
    expect(url).toContain('brightness=1');
    expect(url).toContain('gamma=1');
    expect(url).toContain('quality=90');
    expect(url).toContain('fit=cover');
  });

  it('handles outpost_ship which uses units directory', () => {
    const url = getItemImageUrl('outpost_ship', 24, 24);
    expect(url).not.toBeNull();
    expect(url).toContain('images/units/outpost-ship.jpg');
  });
});
