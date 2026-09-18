// Shared lazy-fetch store (023 D5, 024 D8) — the framework-idiomatic
// replacement of the ENDPOINTS / ENDPOINTS_ERROR / ENDPOINTS_DONE /
// endpointsPromise quadruple + the fetchEndpoints().then(renderDetails)
// re-render convention. The store mutation re-renders the reading
// components; no manual plumbing.
//
// A missing (404) or failed file must never break the other views: `data`
// stays null and the Speed view shows its empty state; `error` records why
// for the footer note. `done` alone disambiguates "still loading" from
// "fetched, nothing there" — a 404 leaves both data and error falsy.

import type { EndpointsMap } from "./types";

export const store = $state({
  data: null as EndpointsMap | null,
  error: null as string | null,
  done: false,
});

let promise: Promise<EndpointsMap | null> | null = null;

export function ensureEndpoints(): Promise<EndpointsMap | null> {
  if (!promise) {
    promise = fetch("./data/endpoints.json")
      .then((r) =>
        // 404 is a tolerated state (data rolled back / 022 not shipped),
        // not an error — the Speed view just has nothing to plot.
        r.status === 404
          ? null
          : r.ok
            ? (r.json() as Promise<EndpointsMap>)
            : Promise.reject(new Error("HTTP " + r.status))
      )
      .then((j) => {
        store.data = j;
        return j;
      })
      .catch((err: unknown) => {
        store.error = err instanceof Error ? err.message : String(err);
        return null;
      })
      .finally(() => {
        store.done = true;
      });
  }
  return promise;
}
