// paginate.mjs -- every page of a GitHub list endpoint, for the org's scripts that read a list (UMB3-006, CodeRabbit on org-health-watch, gate-check-source, skeleton-check and
// announce-release: each read page one only, so a list over the page size lost its tail without a word).
//
// The caller hands in its own `getFn(path) -> { status, json }`, so this file makes no network call of its own and a test needs none. The reader goes on until a SHORT page
// (a list of exactly one page ends with an empty one). What it could not read whole is returned as `partial`, never as a shorter list: an HTTP failure, a body that is not a list,
// or a full page at the cap. The caller turns a partial list into its own named finding or failure.
export const PER_PAGE = 100;
export const MAX_PAGES = 20;

/**
 * @param {(path: string) => Promise<{status: number, json: any}>} getFn
 * @param {string} p        the endpoint path, with or without a query string; `per_page` and `page` are appended
 * @param {(json: any) => any} pick   takes a response body to its list (identity for a bare list, `(j) => j.workflows` for a wrapped one)
 * @param {number} maxPages the cap; reaching it on a full page is `partial` with `capped`
 * @returns {Promise<{status: number, items: any[], partial: boolean, notList?: boolean, capped?: boolean, pages?: number}>}
 */
export async function getAllPages(getFn, p, pick, maxPages = MAX_PAGES) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await getFn(`${p}${p.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=${page}`);
    if (r.status !== 200) return { status: r.status, items, partial: true };
    const got = pick(r.json);
    if (!Array.isArray(got)) return { status: 200, items, partial: true, notList: true };
    items.push(...got);
    if (got.length < PER_PAGE) return { status: 200, items, partial: false };
  }
  return { status: 200, items, partial: true, capped: true, pages: maxPages };
}

/** Why a partial list is partial, in a few words: the HTTP status (0 = no answer), the cap, or an answer that was not a list. */
export const pageNote = (r) => (r.capped ? `still full after ${r.pages} pages` : r.notList ? 'an answer that is not a list' : r.status === 0 ? 'no answer: a timeout or a network error' : `HTTP ${r.status}`);
