import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

describe('application boot', () => {
  it('exposes the core command, registry and pipeline APIs as globals', () => {
    for (const name of [
      'runSystemCommand',
      'getModules',
      'registerProject',
      'registerTask',
      'getModuleHealth',
      'createProgressBar',
      'generateSubtitles',
      'startPipelineProcess'
    ]) {
      expect(typeof win[name], name).toBe('function');
    }
  });
});
