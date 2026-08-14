import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const PIPELINE_KEY = 'bia-pipeline-timestamps';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

function stored() {
  return JSON.parse(win.localStorage.getItem(PIPELINE_KEY));
}

describe('startPipelineProcess', () => {
  it('records a running process and persists it', () => {
    win.startPipelineProcess('Render Video');

    expect(stored().currentProcess).toMatchObject({ label: 'Render Video', status: 'running' });
    expect(stored().currentProcess.startedAt).toEqual(expect.any(String));
    expect(stored().lastCompleted).toBeNull();
  });

  it('falls back to a generic label', () => {
    win.startPipelineProcess();

    expect(stored().currentProcess.label).toBe('Pipeline Process');
  });

  it('replaces an already running process', () => {
    win.startPipelineProcess('First');
    win.startPipelineProcess('Second');

    expect(stored().currentProcess.label).toBe('Second');
    expect(stored().history).toEqual([]);
  });
});

describe('completePipelineProcess', () => {
  it('moves the running process into history with a duration', () => {
    win.startPipelineProcess('Export');

    win.completePipelineProcess();

    const state = stored();
    expect(state.currentProcess).toBeNull();
    expect(state.lastCompleted).toMatchObject({ label: 'Export', status: 'completed' });
    expect(state.lastCompleted.durationMs).toBeGreaterThanOrEqual(0);
    expect(state.history).toHaveLength(1);
  });

  it('honours an explicit status', () => {
    win.startPipelineProcess('Export');

    win.completePipelineProcess('failed');

    expect(stored().lastCompleted.status).toBe('failed');
  });

  it('does nothing when no process is running', () => {
    win.completePipelineProcess();

    expect(win.localStorage.getItem(PIPELINE_KEY)).toBeNull();
  });

  it('keeps at most 25 history entries, newest first', () => {
    for (let i = 1; i <= 27; i++) {
      win.startPipelineProcess(`Run ${i}`);
      win.completePipelineProcess();
    }

    const history = stored().history;
    expect(history).toHaveLength(25);
    expect(history[0].label).toBe('Run 27');
    expect(history[24].label).toBe('Run 3');
  });
});

describe('loadPipelineTimestamps', () => {
  it('restores a persisted pipeline state and trims the history', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ id: i, label: `Run ${i}` }));
    closeApp(win);
    win = loadApp({
      localStorage: {
        [PIPELINE_KEY]: JSON.stringify({
          currentProcess: { id: 1, label: 'Restored', startedAt: new Date().toISOString() },
          lastCompleted: { id: 0, label: 'Older' },
          history
        })
      }
    });

    win.loadPipelineTimestamps();
    win.savePipelineTimestamps();

    const state = stored();
    expect(state.currentProcess.label).toBe('Restored');
    expect(state.lastCompleted.label).toBe('Older');
    expect(state.history).toHaveLength(25);
    expect(state.history[0].label).toBe('Run 5');
  });

  it('ignores corrupt or non-object payloads', () => {
    closeApp(win);
    win = loadApp({ localStorage: { [PIPELINE_KEY]: '"just-a-string"' } });

    win.loadPipelineTimestamps();
    win.savePipelineTimestamps();

    expect(stored()).toEqual({ currentProcess: null, lastCompleted: null, history: [] });
  });
});

describe('getCurrentProcessElapsedMs', () => {
  it('returns zero when nothing is running', () => {
    expect(win.getCurrentProcessElapsedMs()).toBe(0);
  });

  it('measures the time since the process started', () => {
    closeApp(win);
    const startedAt = new Date(Date.now() - 90_000).toISOString();
    win = loadApp({
      localStorage: {
        [PIPELINE_KEY]: JSON.stringify({
          currentProcess: { id: 1, label: 'Long run', startedAt },
          lastCompleted: null,
          history: []
        })
      }
    });

    win.loadPipelineTimestamps();

    expect(win.getCurrentProcessElapsedMs()).toBeGreaterThanOrEqual(90_000);
    expect(win.formatPipelineDuration(win.getCurrentProcessElapsedMs())).toMatch(/^1m \d+s$/);
  });
});

describe('updateActiveProcessBanner', () => {
  it('shows the running process and its elapsed time', () => {
    win.startPipelineProcess('Render Video');

    win.updateActiveProcessBanner();

    expect(win.document.getElementById('activeProcessBanner').textContent).toContain('Render Video • RUNNING');
  });

  it('shows SYSTEM READY when idle', () => {
    win.updateActiveProcessBanner();

    expect(win.document.getElementById('activeProcessBanner').textContent).toBe('SYSTEM READY');
  });

  it('prefers an explicit label override', () => {
    win.updateActiveProcessBanner('CUSTOM STATE');

    expect(win.document.getElementById('activeProcessBanner').textContent).toBe('CUSTOM STATE');
  });
});

describe('updateProductionState', () => {
  it('stores the value with a per-step timestamp', () => {
    win.updateProductionState('script', 'Once upon a time.');

    const state = JSON.parse(win.localStorage.getItem('bia-production-state'));
    expect(state.script).toBe('Once upon a time.');
    expect(state.lastUpdated).toEqual(expect.any(String));
    expect(state.stepTimestamps.script).toBe(state.lastUpdated);
  });

  it('keeps timestamps for each pipeline step it touches', () => {
    win.updateProductionState('topic', 'Topic');
    win.updateProductionState('subtitles', '0:00 - 0:02\nHello.');

    const state = JSON.parse(win.localStorage.getItem('bia-production-state'));
    expect(Object.keys(state.stepTimestamps)).toEqual(expect.arrayContaining(['topic', 'subtitles']));
  });
});
