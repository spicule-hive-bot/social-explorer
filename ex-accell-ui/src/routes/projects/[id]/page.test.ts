import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => import('../../../test/mocks/pageState.svelte'));

import { resetMockPage, setMockPage } from '../../../test/mocks/pageState.svelte';
import { requested, stubApi } from '../../../test/mocks/apiStub';
import Page from './+page.svelte';

const overview = {
  success: true,
  project: { id: 2, name: 'Port', description: 'Docks', project_type: 'social', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
  workspaces: [],
  activity: [],
  summary: { total_workspaces: 0, total_records: 0, total_data_sources: 0, total_investigations: 0, alerts: 0 }
};

const team = { success: true, data: { members: [], createdBy: 'owner@example.com', canManage: true } };

const at = (id: string) => setMockPage({ params: { id }, url: new URL(`http://localhost/projects/${id}`) });

const posts = [{ id: 1, name: 'Posts', dataset_type: 'social_media' }];
const bluesky = { id: 1, name: 'Bluesky posts', dataset_type: 'social_media', record_count: 1200 };
const radio = { id: 2, name: 'Talk radio', dataset_type: 'radio', record_count: 30 };
let datasets: unknown[] = posts;
let datasetsFail = false;

const respond = (url: string) =>
  url.includes('/api/project-members')
    ? team
    : url.includes('/api/datasets')
      ? (datasetsFail ? { success: false, error: 'the catalog is offline' } : { success: true, datasets })
      : overview;

/**
 * Like `stubApi`, but answers each request on the next macrotask, so a runaway refetch loop
 * cannot starve the microtask queue and freeze the test.
 */
function stubDelayedApi(respondUrl: (url: string) => unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      urls.push(url);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const body = respondUrl(url);
      return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) } as Response;
    })
  );
  return urls;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const openForm = () => fireEvent.click(screen.getByRole('button', { name: '+ New Workspace' }));

afterEach(() => {
  cleanup();
  resetMockPage();
  vi.unstubAllGlobals();
  datasets = posts;
  datasetsFail = false;
});

describe('project page', () => {
  it('loads the overview and the team of the project in the route', async () => {
    at('2');
    const urls = stubApi(respond);

    render(Page);

    expect(await screen.findByRole('heading', { name: 'Port' })).toBeInTheDocument();
    expect(requested(urls, '/api/project-overview?id=2')).toHaveLength(1);
    expect(requested(urls, '/api/project-members?project_id=2')).toHaveLength(1);
  });

  it('adds a team member to the project the route names now', async () => {
    at('2');
    const urls = stubApi(respond);
    render(Page);
    const email = await screen.findByPlaceholderText('colleague@company.com');

    at('3');
    await fireEvent.input(email, { target: { value: 'new@example.com' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(requested(urls, '/api/project-members?project_id=3')).toHaveLength(1));
    const post = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ project_id: 3, email: 'new@example.com' });
  });

  it('loads the datasets once when the new workspace form opens', async () => {
    at('2');
    const urls = stubApi(respond);
    render(Page);

    await fireEvent.click(await screen.findByRole('button', { name: '+ New Workspace' }));

    await waitFor(() => expect(requested(urls, '/api/datasets?status=available')).toHaveLength(1));
  });

  it('creates the workspace in the project the route names now', async () => {
    at('2');
    stubApi((url) => (url.includes('/api/workspaces') ? { success: true, workspace: { id: 9 } } : respond(url)));
    render(Page);
    await fireEvent.click(await screen.findByRole('button', { name: '+ New Workspace' }));
    await fireEvent.input(await screen.findByPlaceholderText('e.g., Twitter Analysis'), { target: { value: 'Quay' } });

    at('3');
    await fireEvent.click(screen.getByRole('button', { name: /^Create/ }));

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url, init]) => String(url) === '/api/workspaces' && init?.method === 'POST')).toBe(true));
    const post = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url) === '/api/workspaces' && init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ project_id: 3, name: 'Quay' });
  });

  it('fetches the available datasets exactly once when the form opens with none available', async () => {
    at('2');
    datasets = [];
    const urls = stubDelayedApi(respond);
    render(Page);
    await screen.findByRole('heading', { name: 'Port' });

    openForm();
    await screen.findByText('No datasets available. Run the ETL pipeline to ingest data.');
    await settle();

    expect(requested(urls, '/api/datasets?status=available')).toHaveLength(1);
  });

  it('lists the datasets once, and refetches only once more when the form is closed and reopened', async () => {
    at('2');
    datasets = [bluesky, radio];
    const urls = stubDelayedApi(respond);
    render(Page);
    await screen.findByRole('heading', { name: 'Port' });

    openForm();
    expect(await screen.findByText('Bluesky posts')).toBeInTheDocument();
    await settle();
    expect(requested(urls, '/api/datasets?status=available')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    openForm();
    expect(await screen.findByText('Bluesky posts')).toBeInTheDocument();
    await settle();
    expect(requested(urls, '/api/datasets?status=available')).toHaveLength(2);
  });

  it('shows an error when the dataset request fails, and never retries it in a loop', async () => {
    at('2');
    datasetsFail = true;
    const urls = stubDelayedApi(respond);
    render(Page);
    await screen.findByRole('heading', { name: 'Port' });

    openForm();
    expect(await screen.findByText(/the catalog is offline/)).toBeInTheDocument();
    await settle();

    expect(requested(urls, '/api/datasets?status=available')).toHaveLength(1);
  });
});
