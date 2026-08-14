import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp, closeApp } from './helpers/loadApp.js';

const SUBTITLES = [
  '0:00 - 0:03',
  'I think this is the hard part.',
  '',
  '0:03 - 0:06',
  'So we build it anyway.',
  ''
].join('\n');

let win;

beforeEach(() => {
  win = loadApp();
});

afterEach(() => {
  closeApp(win);
});

describe('normalizeScript', () => {
  it('trims lines and drops blank ones', () => {
    expect(win.normalizeScript('  first line \n\n\n   second line  \n')).toBe(
      'first line\nsecond line'
    );
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(win.normalizeScript('   \n\n  ')).toBe('');
  });
});

describe('splitBatchScripts', () => {
  it('splits on the --- separator and trims each script', () => {
    expect(win.splitBatchScripts('one --- two --- three')).toEqual(['one', 'two', 'three']);
  });

  it('drops empty segments', () => {
    expect(win.splitBatchScripts('--- only ---   ---')).toEqual(['only']);
    expect(win.splitBatchScripts('')).toEqual([]);
  });
});

describe('getVisualIdentity', () => {
  it('describes a consistent character, environment and style', () => {
    expect(win.getVisualIdentity()).toEqual({
      character: expect.stringContaining('creator'),
      environment: expect.stringContaining('office'),
      style: expect.stringContaining('cinematic')
    });
  });
});

describe('getCameraDirection', () => {
  it('cycles through five shot types, one-indexed', () => {
    expect(win.getCameraDirection(1)).toBe('medium shot, eye level');
    expect(win.getCameraDirection(2)).toBe('close-up shot, emotional reaction');
    expect(win.getCameraDirection(5)).toBe('medium close-up, focused expression');
    expect(win.getCameraDirection(6)).toBe(win.getCameraDirection(1));
    expect(win.getCameraDirection(11)).toBe(win.getCameraDirection(1));
  });
});

describe('buildScenePrompt', () => {
  it('picks a scene that matches the caption sentiment', () => {
    expect(win.buildScenePrompt('I think it works', 1)).toContain('thinking quietly');
    expect(win.buildScenePrompt('That is wrong', 1)).toContain('slight confusion');
    expect(win.buildScenePrompt('Time to build', 1)).toContain('typing or sketching');
    expect(win.buildScenePrompt('Look at that growth', 1)).toContain('slight smile');
    expect(win.buildScenePrompt('Sunlight fills the room', 1)).toContain('calm neutral action');
  });

  it('includes the camera direction, identity and consistency guardrails on one line', () => {
    const prompt = win.buildScenePrompt('Sunlight fills the room', 2);

    expect(prompt).toContain(win.getCameraDirection(2));
    expect(prompt).toContain(win.getVisualIdentity().character);
    expect(prompt).toContain('no text, no captions, no logos');
    expect(prompt).not.toContain('\n');
  });
});

describe('generateImageSyncFromSubtitleText', () => {
  it('builds one numbered image block per subtitle cue', () => {
    const plan = win.generateImageSyncFromSubtitleText(SUBTITLES);

    expect(plan).toContain('IMAGE 1: 0:00 - 0:03');
    expect(plan).toContain('Caption: I think this is the hard part.');
    expect(plan).toContain('IMAGE 2: 0:03 - 0:06');
    expect(plan).toContain('Caption: So we build it anyway.');
    expect(plan.match(/^IMAGE \d+:/gm)).toHaveLength(2);
  });

  it('derives each prompt from its caption', () => {
    const plan = win.generateImageSyncFromSubtitleText(SUBTITLES);

    expect(plan).toContain(win.buildScenePrompt('I think this is the hard part.', 1).trim());
  });

  it('joins multi-line captions into a single caption', () => {
    const plan = win.generateImageSyncFromSubtitleText('0:00 - 0:03\nfirst half\nsecond half\n');

    expect(plan).toContain('Caption: first half second half');
  });

  it('skips cues without a parseable timestamp or without text', () => {
    const plan = win.generateImageSyncFromSubtitleText(
      ['00:00:01 --> 00:00:03', 'srt style cue', '', '0:05 - 0:07', 'kept cue'].join('\n')
    );

    expect(plan).toContain('IMAGE 1: 0:05 - 0:07');
    expect(plan).not.toContain('srt style cue');
  });

  it('explains when there is nothing to work with', () => {
    expect(win.generateImageSyncFromSubtitleText('')).toBe(
      'No subtitles found. Generate subtitles first.'
    );
    expect(win.generateImageSyncFromSubtitleText('   ')).toBe(
      'No subtitles found. Generate subtitles first.'
    );
    expect(win.generateImageSyncFromSubtitleText('unparseable text')).toBe(
      'Image sync could not read the current subtitle format.'
    );
  });
});

describe('parseTitles', () => {
  it('parses numbered titles with a CTR estimate', () => {
    expect(win.parseTitles('1. First title (CTR: 8.5%)\n2. Second title (CTR: 4%)')).toEqual([
      { title: 'First title', ctr: '8.5' },
      { title: 'Second title', ctr: '4' }
    ]);
  });

  it('keeps plain lines and assigns a fallback CTR', () => {
    const titles = win.parseTitles('3. Plain title');

    expect(titles).toHaveLength(1);
    expect(titles[0].title).toBe('Plain title');
    expect(titles[0].ctr).toBeGreaterThanOrEqual(3);
    expect(titles[0].ctr).toBeLessThanOrEqual(12);
  });

  it('ignores blank lines', () => {
    expect(win.parseTitles('\n\n')).toEqual([]);
  });
});

describe('generateFallbackScript', () => {
  it('produces a script that mentions the requested topic', async () => {
    const script = await win.generateFallbackScript('faceless channels');

    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(50);
    expect(script.toLowerCase()).toContain('faceless channels');
  });
});
