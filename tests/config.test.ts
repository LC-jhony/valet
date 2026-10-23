import { describe, expect, it } from 'vitest';
import { defaultConfig, normalizeConfig } from '../shared/config';

describe('desktop config', () => {
  it('ignores removed bottom-panel preferences from older configs', () => {
    const config = normalizeConfig({ theme: 'min-light', sidebarWidth: 300, panelOpen: false, panelHeight: 500 });

    expect(config.theme).toBe('min-light');
    expect(config.sidebarWidth).toBe(300);
    expect(config).not.toHaveProperty('panelOpen');
    expect(config).not.toHaveProperty('panelHeight');
  });

  it('keeps the defaults when no config exists', () => {
    expect(defaultConfig()).not.toHaveProperty('panelOpen');
    expect(defaultConfig()).not.toHaveProperty('panelHeight');
  });

  it('accepts every bundled theme and rejects unknown ids', () => {
    expect(normalizeConfig({ theme: 'carbon-dark' }).theme).toBe('carbon-dark');
    expect(normalizeConfig({ theme: 'carbon-light' }).theme).toBe('carbon-light');
    expect(normalizeConfig({ theme: 'not-a-theme' }).theme).toBe('min-dark');
  });
});
