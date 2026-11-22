// Acceptance case for spiculedata/social-explorer#347, copied into the web app by check.mjs and run
// with the app's own Vitest suite. Mounts the page with the database service mocked and counts the
// requests each filtered endpoint receives. Synthetic data only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/state', () => import('../../../test/mocks/pageState.svelte'));
vi.mock('#lib/utils/echarts.ts', () => ({ waitForEcharts: () => new Promise(() => {}), initChart: vi.fn() }));
vi.mock('#lib/services/engagementAnalysisDb.ts');

import { resetMockPage, setMockPage } from '../../../test/mocks/pageState.svelte';
import { stubApi } from '../../../test/mocks/apiStub';
import { engagementAnalysisDb as db } from '#lib/services/engagementAnalysisDb.ts';
import Page from './+page.svelte';

const at = (search: string) => setMockPage({ url: new URL(`http://localhost/text-analytics/engagement-analysis${search}`) });
// One entry per filtered endpoint, in load order: platforms, content types, trends, top posts.
const filteredCounts = () => [
  vi.mocked(db.getPlatformEngagement).mock.calls.length,
  vi.mocked(db.getContentTypePerformance).mock.calls.length,
  vi.mocked(db.getEngagementTrends).mock.calls.length,
  vi.mocked(db.getTopPerformingPosts).mock.calls.length
];
const statsCalls = () => vi.mocked(db.getEngagementStats).mock.calls.length;
const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

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

describe('issue 347: the engagement analysis filtered loads', () => {
  it('C1: the first load issues exactly one filtered request per endpoint, and shows the results', async () => {
    vi.mocked(db.getTopPerformingPosts).mockResolvedValue([syntheticPost('a synthetic top post', 1)] as never);
    at('?workspace=4');

    render(Page);

    await waitFor(() => expect(statsCalls()).toBe(1));
    await settle();

    expect(filteredCounts()).toEqual([1, 1, 1, 1]);
    expect(await screen.findByText('a synthetic top post')).toBeTruthy();
  });

  it('C2: one filter change after the first load issues exactly one more request per endpoint', async () => {
    at('?workspace=4');

    render(Page);
    await waitFor(() => expect(statsCalls()).toBe(1));
    await settle();

    const before = filteredCounts();
    await fireEvent.input(screen.getByRole('slider'), { target: { value: '3' } });
    await settle();

    expect(filteredCounts().map((n, i) => n - before[i])).toEqual([1, 1, 1, 1]);
  });

  it('C3: a stale response for an earlier filter cannot overwrite a newer one', async () => {
    at('?workspace=4');
    vi.mocked(db.getTopPerformingPosts).mockImplementation(async (filters: { minEngagementRate?: number }) => {
      if (filters.minEngagementRate === 3) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return [syntheticPost('the slow stale post', 1)] as never;
      }
      return [syntheticPost('the fast fresh post', 2)] as never;
    });

    render(Page);
    await waitFor(() => expect(statsCalls()).toBe(1));
    await settle();

    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '3' } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await fireEvent.input(slider, { target: { value: '5' } });
    await settle(120);

    expect(screen.getByText('the fast fresh post')).toBeTruthy();
    expect(screen.queryByText('the slow stale post')).toBeNull();
  });
});
