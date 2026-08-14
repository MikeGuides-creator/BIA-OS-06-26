import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

describe('command parsing', () => {
  it('is case-insensitive and tolerates extra whitespace', () => {
    expect(win.runSystemCommand('  PROJECT-SUMMARY  ')).toEqual(win.getProjectSummary());
  });

  it('reports unknown commands with the list of supported ones', () => {
    const result = win.runSystemCommand('does-not-exist');

    expect(result.error).toBe('Unknown system command');
    expect(result.command).toBe('does-not-exist');
    expect(result.availableCommands).toContain('help');
  });

  it('treats empty input as an unknown command', () => {
    expect(win.runSystemCommand('').error).toBe('Unknown system command');
    expect(win.runSystemCommand(undefined).error).toBe('Unknown system command');
  });

  it('logs every command to the developer console history', () => {
    win.runSystemCommand('version');
    win.runSystemCommand('nope');

    const [failed, succeeded] = win.getDeveloperConsoleHistory();
    expect(succeeded).toMatchObject({ command: 'version', status: 'completed' });
    expect(failed).toMatchObject({ command: 'nope', status: 'error' });
  });
});

describe('informational commands', () => {
  it('version returns the system descriptor', () => {
    expect(win.runSystemCommand('version')).toMatchObject({ status: expect.any(String) });
  });

  it('status summarises the live stores', () => {
    expect(win.runSystemCommand('status')).toEqual({
      system: expect.any(String),
      assets: expect.any(Number),
      schedules: expect.any(Number),
      queueItems: expect.any(Number),
      activityEntries: expect.any(Number)
    });
  });

  it('modules lists the module registry', () => {
    const modules = win.runSystemCommand('modules');

    expect(modules).toBe(win.getModules());
    expect(Object.keys(modules)).toContain('telemetry');
    expect(modules.telemetry).toMatchObject({ name: 'Telemetry', status: 'active' });
  });

  it('snapshot bundles system, roadmap and module data', () => {
    const snapshot = win.runSystemCommand('snapshot');

    expect(snapshot).toMatchObject({
      system: expect.any(Object),
      roadmap: expect.anything(),
      modules: expect.any(Object)
    });
  });

  it('help lists the task commands too', () => {
    expect(win.runSystemCommand('help').availableCommands).toEqual(
      expect.arrayContaining(['tasks', 'new-task', 'task-status', 'task-progress', 'task-priority'])
    );
  });

  it('docs and documentation are aliases', () => {
    expect(win.runSystemCommand('documentation')).toBe(win.runSystemCommand('docs'));
  });

  it('console-history returns the live history array', () => {
    win.runSystemCommand('version');

    expect(win.runSystemCommand('console-history')).toBe(win.getDeveloperConsoleHistory());
  });

  it('diagnostics, module-health and system-health return reports', () => {
    expect(win.runSystemCommand('diagnostics')).toContain('BIA-OS DIAGNOSTICS');
    expect(win.runSystemCommand('module-health')).toContain('Health Score:');
    expect(win.runSystemCommand('system-health')).toContain('SYSTEM HEALTH');
  });
});

describe('project commands', () => {
  it('new-project registers the requested id', () => {
    const result = win.runSystemCommand('new-project alpha');

    expect(result).toMatchObject({ message: 'New project created' });
    expect(win.findProject('alpha')).toBeDefined();
  });

  it('new-project rejects an existing id', () => {
    expect(win.runSystemCommand('new-project bia-os')).toEqual({
      error: 'Project already exists',
      projectId: 'bia-os'
    });
  });

  it('project-details defaults to bia-os and reports unknown ids', () => {
    expect(win.runSystemCommand('project-details')).toMatchObject({ id: 'bia-os' });
    expect(win.runSystemCommand('project-details ghost')).toEqual({
      error: 'Project not found',
      projectId: 'ghost'
    });
  });

  it('update-progress clamps the value and validates input', () => {
    expect(win.runSystemCommand('update-progress bia-os 85')).toMatchObject({ progress: 85 });
    expect(win.runSystemCommand('update-progress bia-os 900')).toMatchObject({ progress: 100 });
    expect(win.runSystemCommand('update-progress bia-os -5')).toMatchObject({ progress: 0 });
    expect(win.runSystemCommand('update-progress bia-os abc').error).toBe('Progress value required');
    expect(win.runSystemCommand('update-progress ghost 10').error).toBe('Project not found');
  });

  it('update-progress treats an omitted value as 0, since Number("") is 0', () => {
    expect(win.runSystemCommand('update-progress bia-os')).toMatchObject({ progress: 0 });
  });

  it('project-status only accepts known statuses', () => {
    expect(win.runSystemCommand('project-status bia-os complete')).toMatchObject({
      message: 'Project status updated',
      status: 'complete'
    });
    expect(win.findProject('bia-os').status).toBe('complete');

    const invalid = win.runSystemCommand('project-status bia-os sideways');
    expect(invalid.error).toBe('Valid status required');
    expect(invalid.allowedStatuses).toContain('archived');
  });

  it('archive-project archives and re-scores the project', () => {
    const result = win.runSystemCommand('archive-project bia-os');

    expect(result).toMatchObject({ message: 'Project archived', health: 0 });
    expect(win.findProject('bia-os').status).toBe('archived');
  });

  it('archive-project validates its arguments', () => {
    expect(win.runSystemCommand('archive-project').error).toBe('Project ID required');
    expect(win.runSystemCommand('archive-project ghost').error).toBe('Project not found');
  });

  it('project-list and projects expose the registry', () => {
    expect(win.runSystemCommand('project-list')).toEqual(win.getProjectList());
    expect(win.runSystemCommand('projects')[0]).toMatchObject({ id: 'bia-os' });
  });

  it('project-dashboard renders a text report', () => {
    const report = win.runSystemCommand('project-dashboard');

    expect(report).toContain('PROJECT DASHBOARD');
    expect(report).toContain('Total Projects: 1');
    expect(report).toContain('BIA-OS — ACTIVE — 73% — Health 88');
  });
});

describe('task commands', () => {
  it('new-task requires an id and a title', () => {
    expect(win.runSystemCommand('new-task').error).toBe('Task ID and title required');
    expect(win.runSystemCommand('new-task t1').error).toBe('Task ID and title required');
  });

  it('new-task joins the remaining words into the title', () => {
    expect(win.runSystemCommand('new-task t1 review the dashboard')).toEqual({
      message: 'Task created',
      taskId: 't1',
      title: 'review the dashboard'
    });
    expect(win.findTask('t1').title).toBe('review the dashboard');
  });

  it('tasks and project-tasks list the registry', () => {
    win.runSystemCommand('new-task t1 first task');

    expect(win.runSystemCommand('tasks')).toEqual({ tasks: win.getTaskList() });
    expect(win.runSystemCommand('project-tasks')).toEqual({
      projectId: 'bia-os',
      tasks: win.getProjectTasks('bia-os')
    });
    expect(win.runSystemCommand('project-tasks other')).toEqual({ projectId: 'other', tasks: [] });
  });

  it('task-details returns the task or an error', () => {
    win.runSystemCommand('new-task t1 first task');

    expect(win.runSystemCommand('task-details t1')).toMatchObject({ id: 't1' });
    expect(win.runSystemCommand('task-details ghost')).toEqual({
      error: 'Task not found',
      taskId: 'ghost'
    });
  });

  it('task-status validates the status', () => {
    win.runSystemCommand('new-task t1 first task');

    expect(win.runSystemCommand('task-status t1 active')).toEqual({
      message: 'Task status updated',
      taskId: 't1',
      status: 'active'
    });
    expect(win.runSystemCommand('task-status t1 sideways').error).toBe('Valid status required');
    expect(win.runSystemCommand('task-status ghost active').error).toBe('Task not found');
  });
});
