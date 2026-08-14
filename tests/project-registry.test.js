import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const REGISTRY_KEY = 'bia_project_registry';

let win;

afterEach(() => {
  closeApp(win);
  win = undefined;
});

function bootWith(projects) {
  win = loadApp(
    projects ? { localStorage: { [REGISTRY_KEY]: JSON.stringify(projects) } } : undefined
  );
  if (projects) win.loadProjectRegistry();
  return win;
}

describe('default registry', () => {
  beforeEach(() => bootWith());

  it('ships with the BIA-OS project', () => {
    expect(win.findProject('bia-os')).toMatchObject({ id: 'bia-os', status: 'active' });
    expect(win.getProject('bia-os')).toBe(win.findProject('bia-os'));
    expect(win.findProject('missing')).toBeUndefined();
  });
});

describe('registerProject', () => {
  beforeEach(() => bootWith());

  it('applies defaults and timestamps for a new project', () => {
    expect(win.registerProject({ id: 'p1', name: 'Project One' })).toBe(true);

    const project = win.findProject('p1');
    expect(project).toMatchObject({
      id: 'p1',
      name: 'Project One',
      status: 'planning',
      progress: 0,
      health: 100,
      owner: 'John'
    });
    expect(project.created).toEqual(expect.any(Number));
    expect(project.updated).toEqual(expect.any(Number));
  });

  it('lets callers override the defaults', () => {
    win.registerProject({ id: 'p2', name: 'Two', status: 'warning', progress: 40, owner: 'Ada' });

    expect(win.findProject('p2')).toMatchObject({ status: 'warning', progress: 40, owner: 'Ada' });
  });

  it('rejects duplicates and malformed input', () => {
    win.registerProject({ id: 'p3' });

    expect(win.registerProject({ id: 'p3' })).toBe(false);
    expect(win.registerProject({ name: 'no id' })).toBe(false);
    expect(win.registerProject(null)).toBe(false);
    expect(win.registerProject(undefined)).toBe(false);
  });

  it('persists the registry to localStorage', () => {
    win.registerProject({ id: 'p4', name: 'Four' });

    const stored = JSON.parse(win.localStorage.getItem(REGISTRY_KEY));
    expect(stored.map(p => p.id)).toContain('p4');
  });
});

describe('loadProjectRegistry', () => {
  it('restores a persisted registry', () => {
    bootWith([{ id: 'saved-1', name: 'Saved', status: 'complete', progress: 100, health: 90 }]);

    expect(win.getProjectList()).toEqual([
      { id: 'saved-1', name: 'Saved', status: 'complete', progress: 100, health: 90 }
    ]);
  });

  it('keeps the in-memory registry when stored data is corrupt', () => {
    win = loadApp({ localStorage: { [REGISTRY_KEY]: '{not json' } });
    win.loadProjectRegistry();

    expect(win.getProjectList().map(p => p.id)).toEqual(['bia-os']);
  });
});

describe('updateProject', () => {
  beforeEach(() => bootWith());

  it('merges updates and refreshes the timestamp', () => {
    win.registerProject({ id: 'p5', name: 'Five' });
    const before = win.findProject('p5').updated;

    expect(win.updateProject('p5', { status: 'active', progress: 60 })).toBe(true);

    const project = win.findProject('p5');
    expect(project).toMatchObject({ status: 'active', progress: 60, name: 'Five' });
    expect(project.updated).toBeGreaterThanOrEqual(before);
  });

  it('reports failure for an unknown project', () => {
    expect(win.updateProject('nope', { status: 'active' })).toBe(false);
  });
});

describe('project queries', () => {
  beforeEach(() => {
    bootWith([
      { id: 'a', name: 'A', status: 'active', progress: 80, health: 100 },
      { id: 'b', name: 'B', status: 'planning', progress: 10, health: 85 },
      { id: 'c', name: 'C', status: 'warning', progress: 30, health: 75 },
      { id: 'd', name: 'D', status: 'archived', progress: 100, health: 0 }
    ]);
  });

  it('filters by status', () => {
    expect(win.getProjectsByStatus('active').map(p => p.id)).toEqual(['a']);
    expect(win.getProjectsByStatus('complete')).toEqual([]);
  });

  it('summarises and counts each status bucket', () => {
    const expected = { active: 1, planning: 1, warning: 1, complete: 0, archived: 1 };

    expect(win.getProjectSummary()).toEqual(expected);
    expect(win.getProjectCounts()).toEqual(expected);
  });

  it('exposes a trimmed project list', () => {
    expect(win.getProjectList()[1]).toEqual({
      id: 'b',
      name: 'B',
      status: 'planning',
      progress: 10,
      health: 85
    });
  });

  it('builds a dashboard with averages', () => {
    const dashboard = win.getProjectDashboard();

    expect(dashboard).toMatchObject({ total: 4, active: 1, planning: 1, warning: 1, archived: 1 });
    expect(dashboard.averageProgress).toBe(55);
    expect(dashboard.averageHealth).toBe(65);
    expect(dashboard.projects).toHaveLength(4);
  });
});

describe('calculateProjectHealth', () => {
  beforeEach(() => bootWith());

  it('scores a healthy project at full marks', () => {
    expect(win.calculateProjectHealth({ progress: 90, status: 'active' })).toBe(100);
  });

  it('penalises low progress and warning status', () => {
    expect(win.calculateProjectHealth({ progress: 10, status: 'active' })).toBe(85);
    expect(win.calculateProjectHealth({ progress: 90, status: 'warning' })).toBe(75);
    expect(win.calculateProjectHealth({ progress: 10, status: 'warning' })).toBe(60);
  });

  it('zeroes archived projects', () => {
    expect(win.calculateProjectHealth({ progress: 100, status: 'archived' })).toBe(0);
  });

  it('writes the score back onto the project', () => {
    const project = { id: 'x', progress: 5, status: 'warning' };

    win.updateProjectHealth(project);

    expect(project.health).toBe(60);
    expect(project.updated).toEqual(expect.any(Number));
  });
});

describe('getProjectHealth', () => {
  it('reports HEALTHY when every project is active or complete', () => {
    bootWith([
      { id: 'a', status: 'active' },
      { id: 'b', status: 'complete' }
    ]);

    expect(win.getProjectHealth()).toEqual({ status: 'HEALTHY', score: 100 });
  });

  it('reports STABLE for a planning-heavy portfolio', () => {
    bootWith([
      { id: 'a', status: 'planning' },
      { id: 'b', status: 'planning' }
    ]);

    expect(win.getProjectHealth()).toEqual({ status: 'STABLE', score: 75 });
  });

  it('reports WARNING when warnings drag the score down', () => {
    bootWith([
      { id: 'a', status: 'warning' },
      { id: 'b', status: 'warning' }
    ]);

    expect(win.getProjectHealth()).toEqual({ status: 'WARNING', score: 50 });
  });

  it('reports CRITICAL when archived projects dominate', () => {
    bootWith([
      { id: 'a', status: 'archived' },
      { id: 'b', status: 'archived' },
      { id: 'c', status: 'active' }
    ]);

    expect(win.getProjectHealth()).toEqual({ status: 'CRITICAL', score: 33 });
  });

  it('reports NO PROJECTS for an empty registry', () => {
    bootWith([]);

    expect(win.getProjectHealth()).toEqual({ status: 'NO PROJECTS', score: 0 });
  });
});
