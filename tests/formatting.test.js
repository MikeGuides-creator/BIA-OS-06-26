import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

let win;

beforeAll(() => {
  win = loadApp();
});

afterAll(() => {
  closeApp(win);
});

describe('createProgressBar', () => {
  it('fills blocks proportionally to the value', () => {
    expect(win.createProgressBar(50, 10)).toBe('█████░░░░░');
    expect(win.createProgressBar(100, 4)).toBe('████');
    expect(win.createProgressBar(0, 4)).toBe('░░░░');
  });

  it('defaults to twelve blocks', () => {
    expect(win.createProgressBar(100)).toHaveLength(12);
  });

  it('clamps out-of-range and non-numeric values', () => {
    expect(win.createProgressBar(180, 5)).toBe('█████');
    expect(win.createProgressBar(-40, 5)).toBe('░░░░░');
    expect(win.createProgressBar('not-a-number', 5)).toBe('░░░░░');
    expect(win.createProgressBar(undefined, 5)).toBe('░░░░░');
  });

  it('rounds partial blocks', () => {
    expect(win.createProgressBar(33, 3)).toBe('█░░');
    expect(win.createProgressBar(50, 3)).toBe('██░');
  });
});

describe('createStatusBadge', () => {
  it('maps known statuses case-insensitively', () => {
    expect(win.createStatusBadge('active')).toContain('● ACTIVE');
    expect(win.createStatusBadge('Active')).toContain('status-active');
    expect(win.createStatusBadge('PLANNING')).toContain('● PLANNING');
    expect(win.createStatusBadge('warning')).toContain('● WARNING');
    expect(win.createStatusBadge('complete')).toContain('● COMPLETE');
    expect(win.createStatusBadge('archived')).toContain('● ARCHIVED');
  });

  it('falls back to unknown for missing or unrecognised statuses', () => {
    expect(win.createStatusBadge('nonsense')).toContain('● UNKNOWN');
    expect(win.createStatusBadge()).toContain('status-unknown');
    expect(win.createStatusBadge(null)).toContain('status-unknown');
  });
});

describe('formatPipelineDuration', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(win.formatPipelineDuration(5000)).toBe('5s');
    expect(win.formatPipelineDuration(59999)).toBe('59s');
  });

  it('formats longer durations as minutes and seconds', () => {
    expect(win.formatPipelineDuration(60000)).toBe('1m 0s');
    expect(win.formatPipelineDuration(125000)).toBe('2m 5s');
  });

  it('returns a dash for missing or negative durations', () => {
    expect(win.formatPipelineDuration(0)).toBe('—');
    expect(win.formatPipelineDuration(-1)).toBe('—');
    expect(win.formatPipelineDuration(null)).toBe('—');
    expect(win.formatPipelineDuration(undefined)).toBe('—');
  });
});

describe('formatPipelineTime', () => {
  it('renders a wall-clock time for a valid ISO string', () => {
    expect(win.formatPipelineTime('2024-01-01T10:20:30Z')).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('returns a dash for empty or unparseable input', () => {
    expect(win.formatPipelineTime('')).toBe('—');
    expect(win.formatPipelineTime(null)).toBe('—');
    expect(win.formatPipelineTime('not-a-date')).toBe('—');
  });
});

describe('formatTime', () => {
  it('renders zero-padded hours, minutes and seconds', () => {
    expect(win.formatTime(0)).toBe('00:00:00');
    expect(win.formatTime(59)).toBe('00:00:59');
    expect(win.formatTime(3661)).toBe('01:01:01');
    expect(win.formatTime(86399)).toBe('23:59:59');
  });
});

describe('escapeHtml', () => {
  it('escapes angle brackets and ampersands', () => {
    expect(win.escapeHtml('<b>a & b</b>')).toBe('&lt;b&gt;a &amp; b&lt;/b&gt;');
  });

  it('coerces non-string input', () => {
    expect(win.escapeHtml(42)).toBe('42');
    expect(win.escapeHtml(null)).toBe('');
  });
});

describe('getDateOffset', () => {
  it('returns an ISO date shifted by the requested number of days', () => {
    const today = new Date();
    const expected = new Date(today);
    expected.setDate(expected.getDate() + 3);

    expect(win.getDateOffset(3)).toBe(expected.toISOString().split('T')[0]);
    expect(win.getDateOffset(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
