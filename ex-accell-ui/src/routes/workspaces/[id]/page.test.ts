import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';

const hoisted = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: hoisted.goto }));
vi.mock('$app/state', () => import('../../../test/mocks/pageState.svelte'));

import { resetMockPage, setMockPage } from '../../../test/mocks/pageState.svelte';
import { queryOf, requested, stubApi } from '../../../test/mocks/apiStub';
import Page from './+page.svelte';

const overviewFor = (id: number, name: string, records: number) => ({
  success: true,
  workspace: { id, name, description: 'Dock activity', workspace_type: 'research', project_id: 2, project_name: 'Port', status: 'active', created_at: '2026-01-01T00:00:00Z' },
  data_sources: [],
  investigations: [],
  summary: { total_records: records, total_data_sources: 0, total_investigations: 0 }
});

const overview = overviewFor(4, 'Harbour', 1500);
const other = overviewFor(5, 'Lantern', 10);

/** A fetch stub whose responses resolve only when the test resolves them, so out-of-order replies are possible. */
function deferredApi(): { respond: (id: string, body: unknown) => void } {
  const pending: Array<{ url: string; resolve: (body: unknown) => void }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const id = queryOf(url).get('id') ?? '';
      return new Promise((resolve) => {
        pending.push({ url, resolve: (body) => resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => JSON.stringify(body) } as Response) });
      });
    })
  );
  return {
    respond: (id, body) => {
      const entry = pending.find((p) => p.url.includes(`id=${id}`));
      if (!entry) throw new Error(`no pending request for id=${id}`);
      entry.resolve(body);
    }
  };
}

const at = (id: string) => setMockPage({ params: { id }, url: new URL(`http://localhost/workspaces/${id}`) });

afterEach(() => {
  cleanup();
  resetMockPage();
  hoisted.goto.mockReset();
  vi.unstubAllGlobals();
});

describe('workspace page', () => {
  it('loads the overview of the workspace in the route and shows it', async () => {
    at('4');
    const urls = stubApi(() => overview);

    render(Page);

    expect(await screen.findByRole('heading', { name: 'Harbour' })).toBeInTheDocument();
    expect(requested(urls, '/api/workspace-overview?id=4')).toHaveLength(1);
    expect(screen.getByText(/1\.5K records/)).toBeInTheDocument();
  });

  it('links a dataset to the workspace the route names now', async () => {
    at('4');
    stubApi(() => overview);
    render(Page);
    await fireEvent.click(await screen.findByRole('button', { name: 'Link dataset' }));
    expect(hoisted.goto).toHaveBeenLastCalledWith('/data-management?workspace=4&link=1');

    at('5');
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the reactive reload finish
    await fireEvent.click(await screen.findByRole('button', { name: 'Link dataset' }));

    expect(hoisted.goto).toHaveBeenLastCalledWith('/data-management?workspace=5&link=1');
  });

  it('re-requests and re-renders when the route param changes without a remount', async () => {
    at('4');
    const urls = stubApi((url) => (url.includes('id=5') ? other : overview));
    const { unmount } = render(Page);
    expect(await screen.findByRole('heading', { name: 'Harbour' })).toBeInTheDocument();

    at('5');
    expect(await screen.findByRole('heading', { name: 'Lantern' })).toBeInTheDocument();
    expect(requested(urls, '/api/workspace-overview?id=5')).toHaveLength(1);
    unmount();
  });

  it('does not show the first workspace while the second is loading', async () => {
    at('4');
    const api = deferredApi();
    render(Page);
    api.respond('4', overview);
    expect(await screen.findByRole('heading', { name: 'Harbour' })).toBeInTheDocument();

    at('5');
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the reactive reload start
    // the response for id 5 never arrives: the skeleton shows, not the stale workspace
    expect(screen.queryByRole('heading', { name: 'Harbour' })).not.toBeInTheDocument();
  });

  it('a late response for the first workspace does not overwrite the second', async () => {
    at('4');
    const api = deferredApi();
    render(Page);

    at('5');
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the reactive reload start
    api.respond('5', other);
    expect(await screen.findByRole('heading', { name: 'Lantern' })).toBeInTheDocument();

    api.respond('4', overview);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('heading', { name: 'Lantern' })).toBeInTheDocument();
  });

  it('retries the workspace the route names when the Retry button is used', async () => {
    at('4');
    let calls = 0;
    const urls = stubApi(() => (++calls === 1 ? { success: false, error: 'Workspace is unavailable' } : other));
    render(Page);
    expect(await screen.findByText('Workspace is unavailable')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Lantern' })).toBeInTheDocument();
    expect(requested(urls, '/api/workspace-overview?id=4')).toHaveLength(2);
  });
});
