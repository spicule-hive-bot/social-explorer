import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/state', () => import('../../../test/mocks/pageState.svelte'));
vi.mock('#lib/utils/echarts.ts', () => ({ waitForEcharts: () => new Promise(() => {}), initChart: vi.fn() }));
vi.mock('#lib/services/topicModelingDb.ts');

import { resetMockPage, setMockPage } from '../../../test/mocks/pageState.svelte';
import { stubApi } from '../../../test/mocks/apiStub';
import { typeFilterDate } from '../../../test/mocks/filterBar';
import { topicModelingDb as db } from '#lib/services/topicModelingDb.ts';
import Page from './+page.svelte';

const at = (search: string) => setMockPage({ url: new URL(`http://localhost/text-analytics/topic-modeling${search}`) });
const topicWorkspaces = () => vi.mocked(db.getTopics).mock.calls.map(([, workspace]) => workspace);

const topic = (id: string, size: number) => ({ id, name: `Topic ${id}`, category: 'politics', size, weight: 0.5, keywords: ['k'] });
const topics = [topic('a', 500), topic('b', 50), topic('c', 5)];

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(db.getTopics).mockReset().mockResolvedValue(topics as never);
  vi.mocked(db.getTopicCategories).mockReset().mockResolvedValue([{ category: 'politics' }] as never);
  vi.mocked(db.getTopicRelationships).mockReset().mockResolvedValue([]);
  vi.mocked(db.getTopicStats).mockReset().mockResolvedValue({} as never);
  vi.mocked(db.getTreemapData).mockReset().mockResolvedValue([]);
  stubApi((url) => (url.includes('/api/datasets') ? { success: true, datasets: [{ id: 1, name: 'Posts', dataset_type: 'social_media', source_platform: 'twitter' }] } : { success: true, data: [] }));
});

afterEach(() => {
  cleanup();
  resetMockPage();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('topic modeling page', () => {
  it('loads the topics of the workspace named in the URL', async () => {
    at('?workspace=4');

    render(Page);

    await waitFor(() => expect(topicWorkspaces()).toEqual(['4']));
    expect(await screen.findByText('(3 of 3 topics)')).toBeInTheDocument();
  });

  it('narrows the listed topics as the minimum mentions slider moves', async () => {
    at('');
    render(Page);
    await screen.findByText('(3 of 3 topics)');

    await fireEvent.input(screen.getByRole('slider'), { target: { value: '100' } });

    expect(await screen.findByText('(1 of 3 topics)')).toBeInTheDocument();
  });

  it('asks again, for the workspace the page is on now, after a search is typed', async () => {
    at('?workspace=4');
    render(Page);
    await screen.findByText('(3 of 3 topics)');

    at('?workspace=5');
    await fireEvent.input(screen.getByPlaceholderText('Search topics or keywords...'), { target: { value: 'peace' } });

    await waitFor(() => expect(topicWorkspaces()).toEqual(['4', '5']), { timeout: 2000 });
    expect(vi.mocked(db.getTopics).mock.calls[1][0]).toMatchObject({ search: 'peace' });
  });

  // Regression for #346: the fetch's own reassignment of topicsData re-ran the debounced effect,
  // so a single search or category change refetched forever. Each new filter key must load once,
  // and once the response arrives nothing further may be requested.
  it('makes exactly one filtered request per search change, and none after the response arrives', async () => {
    at('?workspace=4');
    // Every call resolves with a fresh array so the reassignment is really a state change
    vi.mocked(db.getTopics).mockImplementation(async () => topics.map((t) => ({ ...t })));
    vi.useFakeTimers();
    render(Page);
    await vi.advanceTimersByTimeAsync(0); // the mount load resolves through microtasks
    expect(vi.mocked(db.getTopics).mock.calls).toHaveLength(1);

    await fireEvent.input(screen.getByPlaceholderText('Search topics or keywords...'), { target: { value: 'peace' } });
    expect(vi.mocked(db.getTopics).mock.calls).toHaveLength(1); // the debounce is pending

    await vi.advanceTimersByTimeAsync(300); // the debounce elapses, one filtered request fires
    expect(vi.mocked(db.getTopics).mock.calls).toHaveLength(2);
    expect(vi.mocked(db.getTopics).mock.calls[1][0]).toMatchObject({ search: 'peace' });

    await vi.advanceTimersByTimeAsync(60_000); // well past the debounce, response long since arrived
    expect(vi.mocked(db.getTopics).mock.calls).toHaveLength(2); // the loop is not restarting the fetch
  });

  it('makes exactly one filtered request per category change, and none after the response arrives', async () => {
    at('');
    vi.mocked(db.getTopics).mockImplementation(async () => topics.map((t) => ({ ...t })));
    vi.useFakeTimers();
    render(Page);
    await vi.advanceTimersByTimeAsync(0);

    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'politics' } });

    await vi.advanceTimersByTimeAsync(300);
    expect(vi.mocked(db.getTopics).mock.calls).toHaveLength(2);
    expect(vi.mocked(db.getTopics).mock.calls[1][0]).toMatchObject({ category: 'politics' });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.mocked(db.getTopics).mock.calls).toHaveLength(2);
  });

  // The topic list is precomputed on the server (topics has no per-post date), so a date change
  // cannot reload it; the range only scopes the posts the drilldown opens. The page says so.
  it('does not reload the topics when only the date range changes, and the page says the range scopes the drilldown', async () => {
    at('?workspace=4');
    render(Page);
    await screen.findByText('(3 of 3 topics)');

    expect(await screen.findByText(/date range scopes/)).toBeInTheDocument();

    at('?workspace=5');
    await typeFilterDate('Start date', '2026-02-01');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(topicWorkspaces()).toEqual(['4']);
  });
});
