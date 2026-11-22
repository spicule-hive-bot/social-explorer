import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { get } from 'svelte/store';

vi.mock('$app/state', () => import('../../test/mocks/pageState.svelte'));

import { resetMockPage, setMockPage } from '../../test/mocks/pageState.svelte';
import { page } from './pageStore.svelte';
import LegacyPageReader from '../../test/stubs/LegacyPageReader.svelte';

afterEach(() => {
  cleanup();
  resetMockPage();
});

describe('pageStore', () => {
  it('hands subscribers the current page straight away', () => {
    setMockPage({ url: new URL('http://localhost/data?workspace=3'), params: { id: '9' } });

    const current = get(page);

    expect(current.url.searchParams.get('workspace')).toBe('3');
    expect(current.params.id).toBe('9');
  });

  it('tells subscribers when the page changes, and stops after unsubscribe', () => {
    const seen: string[] = [];
    const unsubscribe = page.subscribe((p) => seen.push(p.url.pathname));

    setMockPage({ url: new URL('http://localhost/a') });
    flushSync();
    unsubscribe();
    setMockPage({ url: new URL('http://localhost/b') });
    flushSync();

    expect(seen.at(-1)).toBe('/a');
    expect(seen).not.toContain('/b');
  });
});

describe('legacy components reading the page store', () => {
  it('re-run their reactive statements when the route changes', () => {
    setMockPage({ url: new URL('http://localhost/x?workspace=1'), params: { id: '5' } });
    render(LegacyPageReader);
    expect(screen.getByTestId('workspace').textContent).toBe('1');
    expect(screen.getByTestId('id').textContent).toBe('5');
    expect(screen.getByTestId('admin').textContent).toBe('viewer');

    setMockPage({ url: new URL('http://localhost/x?workspace=2'), params: { id: '6' }, data: { user: { role: 'admin' } } });
    flushSync();

    expect(screen.getByTestId('workspace').textContent).toBe('2');
    expect(screen.getByTestId('id').textContent).toBe('6');
    expect(screen.getByTestId('admin').textContent).toBe('admin');
  });
});
