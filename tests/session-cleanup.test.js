import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const MODULE_KEY = 'bia_modules';
const AUTO_QUEUE_KEY = 'bia_auto_queue_v1';
const AUTO_QUEUE_RUNNING_KEY = 'bia_auto_queue_running_v1';
const COMMAND_HISTORY_KEY = 'bia_command_history';
const PRODUCTION_STATE_KEY = 'bia-production-state';
const PIPELINE_KEY = 'bia-pipeline-timestamps';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

describe('biaClearAllOperationalState', () => {
  beforeEach(() => {
    win.localStorage.setItem(PRODUCTION_STATE_KEY, JSON.stringify({ topic: 'old topic' }));
    win.localStorage.setItem(PIPELINE_KEY, JSON.stringify({ history: [{ label: 'Script' }] }));
    win.localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify([{ id: 1 }]));
    win.localStorage.setItem(AUTO_QUEUE_RUNNING_KEY, 'true');
    win.localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify([{ command: 'status' }]));
    win.localStorage.setItem(MODULE_KEY, JSON.stringify({ subtitles: { name: 'Subtitles', status: 'error' } }));
  });

  it('removes persisted production, pipeline, queue and history state', () => {
    win.biaClearAllOperationalState();

    expect(win.localStorage.getItem(PRODUCTION_STATE_KEY)).toBeNull();
    expect(win.localStorage.getItem(PIPELINE_KEY)).toBeNull();
    expect(win.localStorage.getItem(AUTO_QUEUE_KEY)).toBeNull();
    expect(win.localStorage.getItem(COMMAND_HISTORY_KEY)).toBeNull();
    expect(win.localStorage.getItem(AUTO_QUEUE_RUNNING_KEY)).toBe('false');
    expect(win.commandHistory).toEqual([]);
  });

  it('resets every persisted module back to ready', () => {
    win.biaClearAllOperationalState();

    const modules = JSON.parse(win.localStorage.getItem(MODULE_KEY));
    const statuses = Object.values(modules).map((module) => module.status);

    expect(statuses.length).toBeGreaterThan(1);
    expect(new Set(statuses)).toEqual(new Set(['ready']));
    expect(modules.subtitles.status).toBe('ready');
  });

  it('clears the in-memory generated production text', () => {
    win.latestGeneratedScript = 'script body';
    win.generatedSubtitleText = 'subtitles';
    win.importedEpisodeTitle = 'Episode 1';

    win.biaClearAllOperationalState();

    expect(win.latestGeneratedScript).toBe('');
    expect(win.generatedSubtitleText).toBe('');
    expect(win.importedEpisodeTitle).toBe('');
  });
});

describe('biaClearQueueAutomation', () => {
  it('empties the automation queue and marks it as not running', () => {
    win.localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify([{ id: 1, label: 'Script' }]));
    win.localStorage.setItem(AUTO_QUEUE_RUNNING_KEY, 'true');

    win.biaClearQueueAutomation();

    expect(JSON.parse(win.localStorage.getItem(AUTO_QUEUE_KEY))).toEqual([]);
    expect(win.localStorage.getItem(AUTO_QUEUE_RUNNING_KEY)).toBe('false');
  });
});

describe('biaClearSessionEverywhere', () => {
  it('clears operational state without throwing', () => {
    win.localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify([{ id: 1 }]));
    win.localStorage.setItem(PRODUCTION_STATE_KEY, JSON.stringify({ topic: 'old' }));

    expect(() => win.biaClearSessionEverywhere()).not.toThrow();

    expect(win.localStorage.getItem(PRODUCTION_STATE_KEY)).toBeNull();
  });
});

describe('system metadata', () => {
  it('getChangelog returns newest-first version entries', () => {
    const changelog = win.getChangelog();

    expect(Array.isArray(changelog)).toBe(true);
    expect(changelog.length).toBeGreaterThan(1);
    expect(changelog[0]).toMatchObject({
      version: expect.any(String),
      build: expect.any(String),
      title: expect.any(String)
    });
    expect(Array.isArray(changelog[0].changes)).toBe(true);
    expect(parseFloat(changelog[0].version)).toBeGreaterThan(parseFloat(changelog[1].version));
  });

  it('getSystemDocumentation exposes the documentation layer', () => {
    const docs = win.getSystemDocumentation();

    expect(docs).toBeTruthy();
    expect(typeof docs).toBe('object');
  });

  it('getSystemInfo reports identity plus live counters', () => {
    win.addCommand('status');
    win.addActivity('Something happened');

    const info = win.getSystemInfo();

    expect(info.version).toBeTruthy();
    expect(info.activityEntries).toBeGreaterThan(0);
    expect(info.queueItems).toBeGreaterThan(0);
    expect(info.assets).toBeGreaterThanOrEqual(0);
    expect(info.schedules).toBeGreaterThanOrEqual(0);
    expect(info.templates).toBeGreaterThanOrEqual(0);
  });
});

describe('telemetry refresh helpers', () => {
  it('biaPass5UpdateTelemetry runs against the booted DOM', () => {
    expect(() => win.biaPass5UpdateTelemetry()).not.toThrow();
  });

  it('biaPass4CleanupDashboardTelemetry runs against the booted DOM', () => {
    expect(() => win.biaPass4CleanupDashboardTelemetry()).not.toThrow();
  });
});
