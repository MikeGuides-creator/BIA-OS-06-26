import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

function statusOf(checks, name) {
  return checks.find(check => check.name === name)?.status;
}

describe('getModuleHealth', () => {
  it('checks every tracked subsystem', () => {
    const checks = win.getModuleHealth();

    expect(checks.map(check => check.name)).toEqual([
      'Developer Memory',
      'Command History',
      'Queue Dock',
      'Telemetry',
      'Activity Feed',
      'Production Output',
      'System Console',
      'Topic Engine',
      'Script Engine'
    ]);
    expect(checks.every(check => ['ONLINE', 'WARNING', 'OFFLINE'].includes(check.status))).toBe(true);
  });

  it('warns for empty stores and reports ONLINE once they hold data', () => {
    expect(statusOf(win.getModuleHealth(), 'Developer Memory')).toBe('WARNING');

    win.recordConsoleHistory({ command: 'status' });

    expect(statusOf(win.getModuleHealth(), 'Developer Memory')).toBe('ONLINE');
  });

  it('reports OFFLINE when a DOM-backed module is missing', () => {
    win.document.getElementById('productionOutput').remove();

    expect(statusOf(win.getModuleHealth(), 'Production Output')).toBe('OFFLINE');
  });

  it('reports engines ONLINE while their generators are defined', () => {
    const checks = win.getModuleHealth();

    expect(statusOf(checks, 'Topic Engine')).toBe('ONLINE');
    expect(statusOf(checks, 'Script Engine')).toBe('ONLINE');
  });
});

describe('generateSystemHealthReport', () => {
  it('scores ONLINE modules at 100 and WARNING modules at 50', () => {
    const checks = win.getModuleHealth();
    const online = checks.filter(c => c.status === 'ONLINE').length;
    const warning = checks.filter(c => c.status === 'WARNING').length;
    const expectedScore = Math.round(((online * 100 + warning * 50) / (checks.length * 100)) * 100);

    const report = win.generateSystemHealthReport();

    expect(report).toContain(`Health Score: ${expectedScore}%`);
    expect(report).toContain(`Online: ${online}`);
    expect(report).toContain(`Warning: ${warning}`);
    expect(report).toContain('Offline: 0');
    expect(report).toContain('STABLE WITH WARNINGS');
  });

  it('escalates to ATTENTION REQUIRED when a module is offline', () => {
    win.document.getElementById('productionOutput').remove();

    expect(win.generateSystemHealthReport()).toContain('ATTENTION REQUIRED');
  });
});

describe('generateModuleHealthReport', () => {
  it('lists every module with a padded status line', () => {
    const report = win.generateModuleHealthReport();

    expect(report).toContain('SYSTEM HEALTH');
    for (const check of win.getModuleHealth()) {
      expect(report).toContain(`${check.name.padEnd(22, '.')} ${check.status}`);
    }
  });

  it('updates the command centre status text from the score', () => {
    win.generateModuleHealthReport();

    expect(win.document.getElementById('statusText').textContent).toBe('STABLE WITH WARNINGS');
  });
});

describe('updateCommandCenterHealthIndicator', () => {
  it('maps scores onto status labels', () => {
    const statusText = win.document.getElementById('statusText');

    win.updateCommandCenterHealthIndicator(95);
    expect(statusText.textContent).toBe('SYSTEM STABLE');

    win.updateCommandCenterHealthIndicator(75);
    expect(statusText.textContent).toBe('STABLE WITH WARNINGS');

    win.updateCommandCenterHealthIndicator(40);
    expect(statusText.textContent).toBe('SYSTEM NEEDS ATTENTION');
  });
});

describe('generateSystemDiagnostics', () => {
  it('reports the current store counts', () => {
    win.recordConsoleHistory({ command: 'one' });
    win.recordConsoleHistory({ command: 'two' });

    const diagnostics = win.generateSystemDiagnostics();

    expect(diagnostics).toContain('BIA-OS DIAGNOSTICS');
    expect(diagnostics).toContain('Developer Memory: 2');
    expect(diagnostics).toContain('SYSTEM HEALTHY');
  });
});
