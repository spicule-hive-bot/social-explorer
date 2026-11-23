import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/state', () => import('../../../test/mocks/pageState.svelte'));
vi.mock('#lib/utils/echarts.ts', () => ({ waitForEcharts: () => new Promise(() => {}), initChart: vi.fn() }));
vi.mock('#lib/services/engagementAnalysisDb.ts');

import { resetMockPage, setMockPage } from '../../../test/mocks/pageState.svelte';
import { stubApi } from '../../../test/mocks/apiStub';
import { typeFilterDate } from '../../../test/mocks/filterBar';
import { engagementAnalysisDb as db } from '#lib/services/engagementAnalysisDb.ts';
import Page from './+page.svelte';

const at = (search: string) => setMockPage({ url: new URL(`http://localhost/text-analytics/engagement-analysis${search}`) });
const statsCalls = () => vi.mocked(db.getEngagementStats).mock.calls.map(([workspace]) => workspace);
const platformCalls = () => vi.mocked(db.getPlatformEngagement).mock.calls.map(([, workspace]) => workspace);
// One entry per filtered endpoint, in load order: platforms, content types, trends, top posts.
const filteredCounts = () => [
  vi.mocked(db.getPlatformEngagement).mock.calls.length,
  vi.mocked(db.getContentTypePerformance).mock.calls.length,
  vi.mocked(db.getEngagementTrends).mock.calls.length,
  vi.mocked(db.getTopPerformingPosts).mock.calls.length
];
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const syntheticPost = (text: string, id: number) => ({
  id,
  text,
  platform: 'Twitter',
  contentType: 'Video',
  engagement: { likes: 1, comments: 1, shares: 1, rate: 1 },
  reach: 1,
  timestamp: '2026-01-01T00:00:00Z'
});

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(db.getEngagementStats).mockReset().mockResolvedValue({} as never);
  vi.mocked(db.getPlatformEngagement).mockReset().mockResolvedValue([]);
  vi.mocked(db.getContentTypePerformance).mockReset().mockResolvedValue([]);
  vi.mocked(db.getEngagementTrends).mockReset().mockResolvedValue([]);
  vi.mocked(db.getTopPerformingPosts).mockReset().mockResolvedValue([]);
  stubApi((url) => (url.includes('/api/datasets') ? { success: true, datasets: [{ id: 1, name: 'Posts', dataset_type: 'social_media', source_platform: 'twitter' }] } : { success: true, data: [] }));
});

afterEach(() => {
  cleanup();
  resetMockPage();
  vi.unstubAllGlobals();
});

describe('engagement analysis page', () => {
  it('loads the engagement of the workspace named in the URL', async () => {
    at('?workspace=4');

    render(Page);

    await waitFor(() => expect(statsCalls()).toEqual(['4']));
    await settle();
    expect(new Set(platformCalls())).toEqual(new Set(['4']));
  });

  it('loads the filtered figures once for the first load', async () => {
    at('?workspace=4');

    render(Page);
    await waitFor(() => expect(statsCalls()).toEqual(['4']));
    await settle();

    expect(platformCalls()).toEqual(['4']);
  });

  it('issues exactly one filtered load when one filter changes after the first load', async () => {
    at('?workspace=4');
    vi.mocked(db.getTopPerformingPosts).mockResolvedValueOnce([]).mockResolvedValue([syntheticPost('a synthetic top post', 1)] as never);

    render(Page);
    await waitFor(() => expect(statsCalls()).toEqual(['4']));
    await settle();

    const before = filteredCounts();
    await fireEvent.input(screen.getByRole('slider'), { target: { value: '3' } });
    await settle();

    expect(filteredCounts().map((n, i) => n - before[i])).toEqual([1, 1, 1, 1]);
    // The displayed results are the ones the change loaded
    expect(await screen.findByText('a synthetic top post')).toBeTruthy();
  });

  it('reloads when a filter other than the platform changes', async () => {
    at('?workspace=4');
    vi.mocked(db.getContentTypePerformance).mockResolvedValue([{ type: 'Video', engagementRate: 7.2, posts: 1, reach: 1, sentiment: 'positive' }] as never);

    render(Page);
    await waitFor(() => expect(statsCalls()).toEqual(['4']));
    await settle();

    const before = filteredCounts();
    await fireEvent.change(await screen.findByDisplayValue('All Content Types'), { target: { value: 'Video' } });
    await settle();

    expect(filteredCounts().map((n, i) => n - before[i])).toEqual([1, 1, 1, 1]);
  });

  it('keeps the newer filtered results when an older response lands late', async () => {
    at('?workspace=4');
    vi.mocked(db.getTopPerformingPosts).mockImplementation(async (filters: { minEngagementRate?: number }) => {
      if (filters.minEngagementRate === 3) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return [syntheticPost('the slow stale post', 1)] as never;
      }
      return [syntheticPost('the fast fresh post', 2)] as never;
    });

    render(Page);
    await waitFor(() => expect(statsCalls()).toEqual(['4']));
    await settle();

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '3' } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await fireEvent.input(slider, { target: { value: '5' } });
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(screen.getByText('the fast fresh post')).toBeTruthy();
    expect(screen.queryByText('the slow stale post')).toBeNull();
  });

  it('loads for all workspaces when the URL names none', async () => {
    at('');

    render(Page);

    await waitFor(() => expect(statsCalls()).toEqual([undefined]));
  });

  it('reloads for the workspace the page is on now when the date range changes after navigation', async () => {
    at('?workspace=4');
    render(Page);
    await waitFor(() => expect(statsCalls()).toEqual(['4']));
    await settle();

    at('?workspace=5');
    await typeFilterDate('Start date', '2026-02-01');

    await waitFor(() => expect(statsCalls()).toEqual(['4', '5']));
  });
});
