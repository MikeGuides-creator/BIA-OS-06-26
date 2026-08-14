import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const DEV_HISTORY_KEY = 'bia_dev_console_history';
const COMMAND_HISTORY_KEY = 'bia_command_history';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

describe('recordConsoleHistory', () => {
  it('returns a normalised entry with defaults', () => {
    const entry = win.recordConsoleHistory({ command: 'status', output: 'READY' });

    expect(entry).toMatchObject({
      command: 'status',
      output: 'READY',
      status: 'logged',
      source: 'system-command-console'
    });
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it('falls back to placeholders when called without data', () => {
    expect(win.recordConsoleHistory()).toMatchObject({
      command: 'unknown-command',
      output: '',
      status: 'logged'
    });
  });

  it('keeps the newest entry first', () => {
    win.recordConsoleHistory({ command: 'first' });
    win.recordConsoleHistory({ command: 'second' });

    expect(win.getDeveloperConsoleHistory().map(item => item.command)).toEqual(['second', 'first']);
  });

  it('caps the history at 100 entries', () => {
    for (let i = 0; i < 105; i++) {
      win.recordConsoleHistory({ command: `cmd-${i}` });
    }

    const history = win.getDeveloperConsoleHistory();
    expect(history).toHaveLength(100);
    expect(history[0].command).toBe('cmd-104');
  });

  it('persists to localStorage', () => {
    win.recordConsoleHistory({ command: 'persisted' });

    expect(JSON.parse(win.localStorage.getItem(DEV_HISTORY_KEY))[0].command).toBe('persisted');
  });

  it('renders the history panel when present', () => {
    win.recordConsoleHistory({ command: 'rendered', output: 'output text' });

    const panel = win.document.getElementById('consoleHistoryList');
    if (panel) {
      expect(panel.innerHTML).toContain('rendered');
      expect(panel.innerHTML).toContain('output text');
    }
  });
});

describe('developer console history persistence', () => {
  it('hydrates from localStorage on boot', () => {
    closeApp(win);
    win = loadApp({
      localStorage: {
        [DEV_HISTORY_KEY]: JSON.stringify([{ id: 1, command: 'restored', status: 'logged' }])
      }
    });

    expect(win.getDeveloperConsoleHistory().map(item => item.command)).toEqual(['restored']);
  });

  it('clearConsoleHistory empties both memory and storage', () => {
    win.recordConsoleHistory({ command: 'to-be-cleared' });

    win.clearConsoleHistory();

    expect(win.getDeveloperConsoleHistory()).toEqual([]);
    expect(JSON.parse(win.localStorage.getItem(DEV_HISTORY_KEY))).toEqual([]);
  });
});

describe('recordCommandHistory', () => {
  it('normalises an entry and appends it to storage', () => {
    win.recordCommandHistory({ command: 'generate-script', label: 'Generate Script' });

    const [entry] = JSON.parse(win.localStorage.getItem(COMMAND_HISTORY_KEY));
    expect(entry).toMatchObject({
      command: 'generate-script',
      label: 'Generate Script',
      source: 'system',
      status: 'completed'
    });
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it('defaults an unlabelled command', () => {
    win.recordCommandHistory();

    const [entry] = JSON.parse(win.localStorage.getItem(COMMAND_HISTORY_KEY));
    expect(entry).toMatchObject({ command: 'unknown', label: 'Unnamed Command' });
  });

  it('attaches the running pipeline process to the entry', () => {
    win.startPipelineProcess('Render');

    win.recordCommandHistory({ command: 'render' });

    const entries = JSON.parse(win.localStorage.getItem(COMMAND_HISTORY_KEY));
    expect(entries.at(-1).startedAt).toEqual(expect.any(String));
  });

  it('keeps only the 25 most recent entries, oldest first', () => {
    for (let i = 0; i < 30; i++) {
      win.recordCommandHistory({ command: `cmd-${i}` });
    }

    const entries = JSON.parse(win.localStorage.getItem(COMMAND_HISTORY_KEY));
    expect(entries).toHaveLength(25);
    expect(entries[0].command).toBe('cmd-5');
    expect(entries.at(-1).command).toBe('cmd-29');
  });
});

describe('loadCommandHistory', () => {
  it('restores persisted command history', () => {
    closeApp(win);
    win = loadApp({
      localStorage: {
        [COMMAND_HISTORY_KEY]: JSON.stringify([{ id: 1, command: 'restored', label: 'Restored' }])
      }
    });

    win.loadCommandHistory();
    win.saveCommandHistory();

    expect(JSON.parse(win.localStorage.getItem(COMMAND_HISTORY_KEY)).map(e => e.command)).toEqual([
      'restored'
    ]);
  });

  it('resets to an empty history when storage is corrupt', () => {
    closeApp(win);
    win = loadApp({ localStorage: { [COMMAND_HISTORY_KEY]: '{oops' } });

    win.loadCommandHistory();
    win.saveCommandHistory();

    expect(JSON.parse(win.localStorage.getItem(COMMAND_HISTORY_KEY))).toEqual([]);
  });
});
