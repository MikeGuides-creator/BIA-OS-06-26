import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const APP_FILE = process.env.BIA_APP_FILE || 'BIA-OS-15.5 Complete (Stable)';

const html = fs.readFileSync(path.join(repoRoot, APP_FILE), 'utf8');

const baselineGlobals = new Set(
  Object.getOwnPropertyNames(new JSDOM('<!doctype html><html></html>').window)
);

/** Names of app functions invoked during this worker's tests. */
export const invokedFunctions = new Set();

/** Names of app functions defined by the application, in definition order. */
export const definedFunctions = new Set();

function stubUnimplementedApis(window) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = () => null;
  window.print = () => {};
  window.URL.createObjectURL = () => 'blob:mock';
  window.URL.revokeObjectURL = () => {};
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve() }
  });
}

/**
 * Replaces every app-defined global function with a wrapper that records the
 * call, so the suite can report which parts of the app the tests reach.
 */
function instrumentGlobalFunctions(window) {
  for (const name of Object.getOwnPropertyNames(window)) {
    if (baselineGlobals.has(name)) continue;

    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    if (!descriptor || !descriptor.configurable || descriptor.get || descriptor.set) continue;
    if (typeof descriptor.value !== 'function') continue;

    definedFunctions.add(name);

    window[name] = new Proxy(descriptor.value, {
      apply(target, thisArg, args) {
        invokedFunctions.add(name);
        return Reflect.apply(target, thisArg, args);
      },
      construct(target, args, newTarget) {
        invokedFunctions.add(name);
        return Reflect.construct(target, args, newTarget);
      }
    });
  }
}

/**
 * Boots the single-file application inside jsdom and returns its window.
 *
 * Application state lives in globals and localStorage, so every test gets its
 * own freshly booted window.
 */
export function loadApp({ localStorage: seed } = {}) {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole
  });

  const { window } = dom;
  stubUnimplementedApis(window);

  if (seed) {
    for (const [key, value] of Object.entries(seed)) {
      window.localStorage.setItem(key, value);
    }
  }

  for (const script of dom.window.document.querySelectorAll('script')) {
    if (script.src) continue;
    try {
      window.eval(script.textContent);
    } catch (error) {
      // Boot-time DOM errors are expected: the app targets a real browser and
      // relies on APIs jsdom does not implement. Function definitions survive.
      if (!(error instanceof window.Error)) throw error;
    }
  }

  window.document.dispatchEvent(
    new window.Event('DOMContentLoaded', { bubbles: true })
  );

  instrumentGlobalFunctions(window);

  return window;
}

export function closeApp(window) {
  if (!window) return;
  window.close();
}
