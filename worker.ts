// Passthrough worker — the deploy was assets-only, and asset requests never
// invoke a Worker script, so Observability could never log anything (empty
// panel, invisible 4xx). With a `main` present, requests that MISS the assets
// layer — exactly the site's 4xx traffic — invoke this handler: it logs the
// request as structured JSON (queryable path field in Workers Logs) and
// defers to the assets layer, which serves the 404. Matched assets still skip
// the Worker entirely, so billing is unchanged.

type AssetsFetcher = { fetch: (request: Request) => Promise<Response> };
type Env = { ASSETS: AssetsFetcher };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log(JSON.stringify({ method: request.method, path: url.pathname + url.search }));
    return env.ASSETS.fetch(request);
  },
};
