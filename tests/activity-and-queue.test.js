import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const FEED_KEY = 'bia_activity_feed';
const QUEUE_KEY = 'bia_command_queue';
const MODULES_KEY = 'bia_modules';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

function feed() {
  win.saveSystemState();
  return JSON.parse(win.localStorage.getItem(FEED_KEY));
}

function queue() {
  win.saveSystemState();
  return JSON.parse(win.localStorage.getItem(QUEUE_KEY));
}

describe('addActivity', () => {
  it('prepends a timestamped entry', () => {
    win.addActivity('Script generated');

    expect(feed()[0]).toEqual({
      time: expect.stringMatching(/\d{1,2}:\d{2}/),
      message: 'Script generated'
    });
  });

  it('keeps the newest entries first, capped at six', () => {
    for (let i = 1; i <= 8; i++) win.addActivity(`event ${i}`);

    const entries = feed();
    expect(entries).toHaveLength(6);
    expect(entries[0].message).toBe('event 8');
    expect(entries.at(-1).message).toBe('event 3');
  });

  it('mirrors the entry into the console output box', () => {
    const output = win.document.getElementById('consoleOutput');
    output.value = '';

    win.addActivity('Subtitles generated');

    expect(output.value).toContain('Subtitles generated');
  });
});

describe('addCommand', () => {
  it('queues a command as pending work', () => {
    win.addCommand('generate-script');

    expect(queue()[0]).toMatchObject({ command: 'generate-script', status: 'queued' });
    expect(queue()[0].id).toEqual(expect.any(Number));
  });

  it('keeps at most eight queued commands', () => {
    for (let i = 1; i <= 10; i++) win.addCommand(`cmd-${i}`);

    const entries = queue();
    expect(entries).toHaveLength(8);
    expect(entries[0].command).toBe('cmd-10');
    expect(entries.at(-1).command).toBe('cmd-3');
  });
});

describe('updateCommandStatus', () => {
  it('updates the status of a queued command', () => {
    win.addCommand('generate-script');
    const { id } = queue()[0];

    win.updateCommandStatus(id, 'running');

    expect(queue()[0].status).toBe('running');
  });

  it('ignores an unknown command id', () => {
    win.addCommand('generate-script');

    expect(() => win.updateCommandStatus(-1, 'running')).not.toThrow();
    expect(queue()[0].status).toBe('queued');
  });
});

describe('loadSystemState', () => {
  it('restores the persisted feed and queue', () => {
    closeApp(win);
    win = loadApp({
      localStorage: {
        [FEED_KEY]: JSON.stringify([{ time: '09:00', message: 'restored event' }]),
        [QUEUE_KEY]: JSON.stringify([{ id: 1, command: 'restored-cmd', status: 'running' }])
      }
    });

    win.loadSystemState();

    expect(feed()).toContainEqual({ time: '09:00', message: 'restored event' });
    expect(queue()).toEqual([{ id: 1, command: 'restored-cmd', status: 'running' }]);
  });

  it('applies persisted module statuses to known modules only', () => {
    win.localStorage.setItem(
      MODULES_KEY,
      JSON.stringify({ subtitles: { status: 'error' }, ghost: { status: 'error' } })
    );

    win.loadSystemState();

    const modules = JSON.parse((win.saveSystemState(), win.localStorage.getItem(MODULES_KEY)));
    expect(modules.subtitles.status).toBe('error');
    expect(modules.ghost).toBeUndefined();
  });

  it('survives corrupt storage', () => {
    closeApp(win);
    win = loadApp({ localStorage: { [FEED_KEY]: 'nope', [QUEUE_KEY]: 'nope' } });

    expect(() => win.loadSystemState()).not.toThrow();
  });
});

describe('updateModuleStatus', () => {
  it('updates a known module and ignores unknown keys', () => {
    win.updateModuleStatus('subtitles', 'running');
    win.updateModuleStatus('does-not-exist', 'running');

    const modules = JSON.parse((win.saveSystemState(), win.localStorage.getItem(MODULES_KEY)));
    expect(modules.subtitles.status).toBe('running');
    expect(modules['does-not-exist']).toBeUndefined();
  });
});
