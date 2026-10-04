// announce-release: mirror a published GitHub Release of a TheColliery repository into the organisation's Announcements discussions.
//
// WHY THIS SHAPE (UMB-344, verified against GitHub's docs 2026-10-03): the Releases REST parameter discussion_category_name opens its
// discussion "in the repository" the Release lives in, and the organisation's discussions live in the source repository (.github), so
// that parameter cannot post to the org page. A workflow in .github can: the GraphQL createDiscussion mutation (the live schema has no
// REST create and no category mutation) takes the repository id and the category id, and the workflow token needs
// "discussions: write" (workflow-syntax permissions list). Announcement-format categories accept new discussions only from people with
// maintain or admin permission, which the workflow's own token holds on its own repository. No new credential.
//
// WHAT IT POSTS: a machine mirror of a Release that is ALREADY published (never a draft, never a private repository). Nothing is
// hand-written here; a hand post is outward content under the owner's word. The post is idempotent: a marker comment at the end of the
// body names the Release, and a Release whose marker is already in a recent Announcements discussion is not posted again.
//
// Zero dependencies: node builtins and the global fetch. Every call carries a timeout; the create is never retried (a timeout does not
// prove the post did not land, and a second create would double-post).
import { SUMMARY_BAND } from '../../templates/overlay-coal-skill/scripts/lib/release-shape.mjs';

export const ORG = 'TheColliery';
export const SOURCE_REPO = '.github';
export const API = 'https://api.github.com';
export const BODY_CAP = 60000; // GitHub's discussion body limit is 65,536; leave room for the footer
export const TITLE_CAP = 200; // GitHub's ceiling is a hard one: it stored a 211-character title as 199 (n = 1), so a title is never cut to fit
export const SCAN_PAGES = 5; // 250 discussions back when looking for an existing marker

const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TAG_RE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const CALL_TIMEOUT_MS = 30000;

export const marker = (repo, tag) => `<!-- release-announcement: ${ORG}/${repo}@${tag} -->`;

export function checkRepo(repo) {
  if (typeof repo !== 'string' || !REPO_RE.test(repo) || repo.length > 100) throw new Error(`repo ${JSON.stringify(repo)} is not a repository name (letters, digits, dot, dash, underscore)`);
  return repo;
}
export function checkTag(tag) {
  if (typeof tag !== 'string' || !TAG_RE.test(tag) || tag.length > 100) throw new Error(`tag ${JSON.stringify(tag)} is not a vX.Y.Z tag`);
  return tag;
}

// A Release body that quotes @someone would notify them from the discussion. Outside code spans, a mention is wrapped in backticks
// (it stays readable and pings nobody). Code spans and fences are left as they are.
export function neutralizeMentions(text) {
  return String(text).split(/(`+[^`]*`+)/).map((part, i) => (i % 2 === 1 ? part
    : part.replace(/(^|[^\w@`/])@([A-Za-z0-9][A-Za-z0-9-]*(?:\/[A-Za-z0-9_-]+)?)/g, '$1`@$2`'))).join('');
}

export function buildAnnouncement(repo, release, repoUrl) {
  const tag = checkTag(release.tag_name);
  const name = (release.name || '').trim();
  const full = name ? (name.startsWith(tag) ? `${repo} ${name}` : `${repo} ${tag} - ${name}`) : `${repo} ${tag}`;
  // The title is never cut mid-sentence. The Release title's summary is bounded at its source (RELEASE-PATTERN.md, the band's top); a title
  // longer than the band allows is an older Release, and it posts as "<Repo> vX.Y.Z" with the summary as the body's first line.
  const longest = Array.from(`${repo} ${tag} - `).length + SUMMARY_BAND[1];
  const title = Array.from(full).length <= Math.min(longest, TITLE_CAP) ? full : `${repo} ${tag}`;
  if (Array.from(title).length > TITLE_CAP) throw new Error(`the title for ${repo} ${tag} would exceed ${TITLE_CAP} characters`);
  let notes = neutralizeMentions((release.body || '').replace(/\r\n/g, '\n').trim());
  if (notes.length > BODY_CAP) notes = notes.slice(0, notes.lastIndexOf('\n', BODY_CAP) > 0 ? notes.lastIndexOf('\n', BODY_CAP) : BODY_CAP).trimEnd() + '\n\n(Truncated here; the full notes are on the Release page below.)';
  if (!notes) notes = `${repo} ${tag} is published.`;
  const body = `${notes}\n\n---\n\n[Release page](${release.html_url}) · [${repo}](${repoUrl})\n\n${marker(repo, tag)}`;
  return { title, body };
}

// `ctx` = { token, fetchImpl?, log? }. The token is read by the caller from the environment and never printed.
function client(ctx) {
  const f = ctx.fetchImpl || fetch;
  const headers = { Authorization: `Bearer ${ctx.token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'thecolliery-announce-release', 'X-GitHub-Api-Version': '2022-11-28' };
  const rest = async (p) => {
    const res = await f(API + p, { headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GET ${p} answered ${res.status}`);
    return res.json();
  };
  const gql = async (query, variables) => {
    const res = await f(`${API}/graphql`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GraphQL answered ${res.status}`);
    const j = await res.json();
    if (j.errors && j.errors.length) throw new Error(`GraphQL: ${j.errors.map((e) => e.message).join('; ')}`);
    return j.data;
  };
  return { rest, gql };
}

const Q_TARGET = 'query($o:String!,$n:String!){repository(owner:$o,name:$n){id hasDiscussionsEnabled discussionCategories(first:25){nodes{id name slug}}}}';
const Q_SCAN = 'query($o:String!,$n:String!,$c:ID!,$a:String){repository(owner:$o,name:$n){discussions(first:50,categoryId:$c,after:$a,orderBy:{field:CREATED_AT,direction:DESC}){nodes{url body}pageInfo{hasNextPage endCursor}}}}';
const M_CREATE = 'mutation($r:ID!,$c:ID!,$t:String!,$b:String!){createDiscussion(input:{repositoryId:$r,categoryId:$c,title:$t,body:$b}){discussion{id url}}}';
const Q_NODE = 'query($i:ID!){node(id:$i){... on Discussion{url title body}}}';

export async function findTarget(api) {
  const d = await api.gql(Q_TARGET, { o: ORG, n: SOURCE_REPO });
  const repo = d && d.repository;
  if (!repo) throw new Error(`${ORG}/${SOURCE_REPO} is not readable`);
  if (!repo.hasDiscussionsEnabled) throw new Error(`${ORG}/${SOURCE_REPO} has Discussions switched off`);
  const cat = repo.discussionCategories.nodes.find((c) => c.slug === 'announcements');
  if (!cat) throw new Error('the source repository has no Announcements category (slug "announcements")');
  return { repositoryId: repo.id, categoryId: cat.id };
}

export async function findExisting(api, target, mk) {
  let after = null;
  for (let page = 0; page < SCAN_PAGES; page++) {
    const d = await api.gql(Q_SCAN, { o: ORG, n: SOURCE_REPO, c: target.categoryId, a: after });
    const ds = d.repository.discussions;
    const hit = ds.nodes.find((n) => typeof n.body === 'string' && n.body.includes(mk));
    if (hit) return hit.url;
    if (!ds.pageInfo.hasNextPage) return null;
    after = ds.pageInfo.endCursor;
  }
  return null;
}

// One Release: 'posted' | 'would-post' | 'already'. `post` false = print what would be posted and stop.
export async function announceOne(api, target, repo, tag, { post, log }) {
  checkRepo(repo); checkTag(tag);
  const meta = await api.rest(`/repos/${ORG}/${repo}`);
  if (meta.private) throw new Error(`${ORG}/${repo} is private: a private repository is never announced`);
  const release = await api.rest(`/repos/${ORG}/${repo}/releases/tags/${tag}`);
  if (release.draft) throw new Error(`${repo} ${tag} is a draft: only a published Release is announced`);
  const { title, body } = buildAnnouncement(repo, release, meta.html_url);
  const existing = await findExisting(api, target, marker(repo, tag));
  if (existing) { log(`already announced: ${repo} ${tag} -> ${existing}`); return 'already'; }
  if (!post) { log(`DRY RUN, nothing posted. Would open in Announcements: "${title}" (${body.length} characters)`); return 'would-post'; }
  const made = await api.gql(M_CREATE, { r: target.repositoryId, c: target.categoryId, t: title, b: body });
  const url = made.createDiscussion.discussion.url;
  // The API's answer is not the artefact: read the discussion back and compare.
  const back = (await api.gql(Q_NODE, { i: made.createDiscussion.discussion.id })).node;
  if (!back || back.title !== title || back.body.replace(/\r\n/g, '\n') !== body) throw new Error(`posted ${url} but the read-back differs from what was sent (the discussion exists; nothing was deleted)`);
  log(`posted: ${repo} ${tag} -> ${url}`);
  return 'posted';
}

// Sweep: every published Release of every public, non-archived, non-fork repository of the org published within `windowHours`.
export async function sweep(api, target, { post, log, windowHours, now = Date.now() }) {
  const repos = await api.rest(`/orgs/${ORG}/repos?type=public&per_page=100`);
  if (!Array.isArray(repos)) throw new Error('the org repository list is not a list');
  if (repos.length >= 100) throw new Error('the org has 100 or more public repositories: the sweep reads one page and refuses to run on a partial list');
  const since = now - windowHours * 3600 * 1000;
  const due = [];
  for (const r of repos.filter((x) => !x.archived && !x.fork && !x.is_template && !x.private).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const list = await api.rest(`/repos/${ORG}/${r.name}/releases?per_page=10`);
    // A stable Release only: a pre-release (the launch form) is a repo's own announcement and goes by hand, with a repo and a tag.
    for (const rel of list) if (!rel.draft && !rel.prerelease && rel.published_at && Date.parse(rel.published_at) >= since && TAG_RE.test(rel.tag_name)) due.push({ repo: r.name, tag: rel.tag_name, at: Date.parse(rel.published_at) });
  }
  due.sort((a, b) => a.at - b.at);
  log(`sweep: ${due.length} Release(s) published in the last ${windowHours} hours`);
  const counts = { posted: 0, 'would-post': 0, already: 0, failed: 0 };
  for (const d of due) {
    try { counts[await announceOne(api, target, d.repo, d.tag, { post, log })]++; } catch (e) { counts.failed++; log(`FAIL ${d.repo} ${d.tag}: ${e.message}`); }
  }
  return counts;
}

export async function run({ repo, tag, post, windowHours, token, fetchImpl, log = console.log, now }) {
  if (!token) throw new Error('GH_TOKEN is not set');
  if (repo) { checkRepo(repo); checkTag(tag); } // before any network call
  const api = client({ token, fetchImpl });
  const target = await findTarget(api);
  if (repo) return { [await announceOne(api, target, repo, tag, { post, log })]: 1 };
  if (tag) throw new Error('a tag needs a repo');
  return sweep(api, target, { post, log, windowHours, now });
}
