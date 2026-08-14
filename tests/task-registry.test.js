import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const TASK_KEY = 'bia_task_registry';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

describe('registerTask', () => {
  it('applies defaults for a new task', () => {
    expect(win.registerTask({ id: 't1', title: 'Write tests' })).toBe(true);

    expect(win.findTask('t1')).toMatchObject({
      id: 't1',
      title: 'Write tests',
      projectId: 'bia-os',
      status: 'planning',
      priority: 'normal',
      progress: 0,
      owner: 'John'
    });
  });

  it('honours caller-supplied fields', () => {
    win.registerTask({
      id: 't2',
      title: 'Ship release',
      projectId: 'other',
      status: 'active',
      priority: 'critical',
      progress: 25
    });

    expect(win.findTask('t2')).toMatchObject({
      projectId: 'other',
      status: 'active',
      priority: 'critical',
      progress: 25
    });
  });

  it('requires an id and a title, and rejects duplicates', () => {
    win.registerTask({ id: 't3', title: 'First' });

    expect(win.registerTask({ id: 't3', title: 'Again' })).toBe(false);
    expect(win.registerTask({ id: 't4' })).toBe(false);
    expect(win.registerTask({ title: 'no id' })).toBe(false);
    expect(win.registerTask(null)).toBe(false);
  });

  it('persists the registry', () => {
    win.registerTask({ id: 't5', title: 'Persisted' });

    expect(JSON.parse(win.localStorage.getItem(TASK_KEY)).map(t => t.id)).toEqual(['t5']);
  });
});

describe('task lookups', () => {
  beforeEach(() => {
    win.registerTask({ id: 'a', title: 'A', projectId: 'p1' });
    win.registerTask({ id: 'b', title: 'B', projectId: 'p2' });
    win.registerTask({ id: 'c', title: 'C', projectId: 'p1' });
  });

  it('returns every task', () => {
    expect(win.getTaskList().map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('filters tasks by project', () => {
    expect(win.getProjectTasks('p1').map(t => t.id)).toEqual(['a', 'c']);
    expect(win.getProjectTasks('unknown')).toEqual([]);
  });

  it('finds a single task by id', () => {
    expect(win.findTask('b').title).toBe('B');
    expect(win.findTask('zzz')).toBeUndefined();
  });
});

describe('updateTaskTimestamp', () => {
  it('stamps the task and re-persists the registry', () => {
    win.registerTask({ id: 't6', title: 'Stamped' });
    const task = win.findTask('t6');
    task.status = 'active';

    win.updateTaskTimestamp(task);

    expect(task.updated).toEqual(expect.any(Number));
    expect(JSON.parse(win.localStorage.getItem(TASK_KEY))[0].status).toBe('active');
  });

  it('ignores a missing task', () => {
    expect(() => win.updateTaskTimestamp(undefined)).not.toThrow();
  });
});

describe('loadTaskRegistry', () => {
  it('restores persisted tasks', () => {
    closeApp(win);
    win = loadApp({
      localStorage: {
        [TASK_KEY]: JSON.stringify([{ id: 'saved', title: 'Saved', status: 'active' }])
      }
    });

    win.loadTaskRegistry();

    expect(win.getTaskList()).toEqual([{ id: 'saved', title: 'Saved', status: 'active' }]);
  });

  it('survives corrupt storage', () => {
    closeApp(win);
    win = loadApp({ localStorage: { [TASK_KEY]: 'not-json' } });

    win.loadTaskRegistry();

    expect(win.getTaskList()).toEqual([]);
  });
});

describe('getTaskDashboard', () => {
  it('returns an empty snapshot when there are no tasks', () => {
    expect(win.getTaskDashboard()).toEqual({
      totalTasks: 0,
      statusCounts: { planning: 0, active: 0, waiting: 0, complete: 0, cancelled: 0 },
      priorities: { high: 0, critical: 0 },
      averageProgress: 0,
      tasksByProject: {}
    });
  });

  it('aggregates statuses, priorities, progress and projects', () => {
    win.registerTask({ id: 'a', title: 'A', status: 'active', priority: 'high', progress: 50, projectId: 'p1' });
    win.registerTask({ id: 'b', title: 'B', status: 'complete', priority: 'critical', progress: 100, projectId: 'p1' });
    win.registerTask({ id: 'c', title: 'C', status: 'waiting', progress: 30, projectId: 'p2' });
    win.registerTask({ id: 'd', title: 'D', status: 'nonsense', progress: 'oops', projectId: 'p2' });

    const dashboard = win.getTaskDashboard();

    expect(dashboard.totalTasks).toBe(4);
    expect(dashboard.statusCounts).toEqual({
      planning: 0,
      active: 1,
      waiting: 1,
      complete: 1,
      cancelled: 0
    });
    expect(dashboard.priorities).toEqual({ high: 1, critical: 1 });
    expect(dashboard.averageProgress).toBe(45);
    expect(Object.keys(dashboard.tasksByProject)).toEqual(['p1', 'p2']);
    expect(dashboard.tasksByProject.p1.map(t => t.id)).toEqual(['a', 'b']);
  });

  it('buckets tasks without a project under "unassigned"', () => {
    win.registerTask({ id: 'e', title: 'E', projectId: '' });

    expect(win.getTaskDashboard().tasksByProject.unassigned.map(t => t.id)).toEqual(['e']);
  });
});
