import { page as pageState, type Page } from '$app/state';
import type { Readable } from 'svelte/store';

/**
 * The page as a store, for components written in Svelte 4 (legacy) syntax.
 *
 * SvelteKit 3 removed `$app/stores`. Its replacement, `page` from `$app/state`, is reactive state, and legacy
 * components do not track state that is imported from another module inside `$:` statements, so
 * `$: id = page.params.id` would never update after the first render. This store re-publishes `$app/state` so those
 * components keep `$page` working unchanged. Components in runes mode should import `page` from `$app/state` instead.
 * Delete this file once the last legacy component that reads the route is converted to runes.
 */
function snapshot(): Page {
  return {
    url: pageState.url,
    params: pageState.params,
    route: pageState.route,
    status: pageState.status,
    error: pageState.error,
    data: pageState.data,
    form: pageState.form,
    state: pageState.state
  } as Page;
}

export const page: Readable<Page> = {
  subscribe(run) {
    run(snapshot());
    let isFirstRun = true;
    // `$effect.root` is a no-op while rendering on the server, where the page cannot change after the first value
    return $effect.root(() => {
      $effect.pre(() => {
        const next = snapshot();
        if (isFirstRun) {
          isFirstRun = false;
          return;
        }
        run(next);
      });
    });
  }
};
