// A stand-in for `$app/state` whose `page` is reactive like the real one, so tests can change the route and watch
// components follow. Use it with: vi.mock('$app/state', () => import('../../test/mocks/pageState.svelte'))
type MockPage = {
  url: URL;
  params: Record<string, string>;
  route: { id: string | null };
  status: number;
  error: unknown;
  data: Record<string, unknown>;
  form: unknown;
  state: Record<string, unknown>;
};

const initialPage = (): MockPage => ({
  url: new URL('http://localhost/'),
  params: {},
  route: { id: '/' },
  status: 200,
  error: null,
  data: {},
  form: null,
  state: {}
});

export const page: MockPage = $state(initialPage());

export function setMockPage(next: Partial<MockPage>): void {
  Object.assign(page, next);
}

export function resetMockPage(): void {
  Object.assign(page, initialPage());
}
