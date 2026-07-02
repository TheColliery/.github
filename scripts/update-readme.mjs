import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function authHeaders() {
  const token = process.env.PAT_TOKEN;
  if (!token) {
    console.error('Error: No authentication token (PAT_TOKEN) detected.');
    process.exit(1);
  }
  return {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TheColliery-Stats-Updater',
    'Authorization': `token ${token}`
  };
}

async function fetchRepoClones(repo) {
  const url = `https://api.github.com/repos/${repo}/traffic/clones`;
  console.log(`Fetching clones for ${repo}...`);
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to fetch clones for ${repo} (${res.status}: ${res.statusText})`);
  }
  return res.json();
}

// Returns the empty-clone sentinel so the caller can continue with the other repos.
async function fetchRepoClonesSafe(repo) {
  try {
    return await fetchRepoClones(repo);
  } catch (err) {
    console.error(`FAIL fetch ${repo}: ${err.message}`);
    process.exitCode = 1;
    return { count: 0, uniques: 0 };
  }
}

function formatStat(num) {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k+`;
  }
  return `${num}+`;
}

// Each badge token, its drift-detecting regex, and the replacement value builder.
// The two READMEs carry DIFFERENT badge sets (profile = global combined only;
// root = per-tool only), so a per-file "every regex must match" check is wrong.
// Instead each replacement returns its hit count; main() asserts the AGGREGATE
// across both files equals the expected total — a drifted regex (0 hits everywhere)
// then fails loud instead of silently no-op'ing.
function badgeSpecs(stats) {
  return [
    { name: 'Downloads (global)', re: /(?<![\w_])Downloads-[0-9a-zA-Z.%+]+-orange/g, val: `Downloads-${encodeURIComponent(stats.combinedClones + ' / 14d')}-orange` },
    { name: 'Developers (global)', re: /(?<![\w_])Developers-[0-9a-zA-Z.%+]+-brightgreen/g, val: `Developers-${encodeURIComponent(stats.combinedUniques + ' / 14d')}-brightgreen` },
    { name: 'CoalMine_Downloads', re: /CoalMine_Downloads-[0-9a-zA-Z.%+]+-orange/g, val: `CoalMine_Downloads-${encodeURIComponent(stats.mineClones + ' / 14d')}-orange` },
    { name: 'CoalMine_Developers', re: /CoalMine_Developers-[0-9a-zA-Z.%+]+-brightgreen/g, val: `CoalMine_Developers-${encodeURIComponent(stats.mineUniques + ' / 14d')}-brightgreen` },
    { name: 'CoalTipple_Downloads', re: /CoalTipple_Downloads-[0-9a-zA-Z.%+]+-orange/g, val: `CoalTipple_Downloads-${encodeURIComponent(stats.tippleClones + ' / 14d')}-orange` },
    { name: 'CoalTipple_Developers', re: /CoalTipple_Developers-[0-9a-zA-Z.%+]+-brightgreen/g, val: `CoalTipple_Developers-${encodeURIComponent(stats.tippleUniques + ' / 14d')}-brightgreen` },
    { name: 'CoalBoard_Downloads', re: /CoalBoard_Downloads-[0-9a-zA-Z.%+]+-orange/g, val: `CoalBoard_Downloads-${encodeURIComponent(stats.boardClones + ' / 14d')}-orange` },
    { name: 'CoalBoard_Developers', re: /CoalBoard_Developers-[0-9a-zA-Z.%+]+-brightgreen/g, val: `CoalBoard_Developers-${encodeURIComponent(stats.boardUniques + ' / 14d')}-brightgreen` },
    { name: 'CoalHearth_Downloads', re: /CoalHearth_Downloads-[0-9a-zA-Z.%+]+-orange/g, val: `CoalHearth_Downloads-${encodeURIComponent(stats.hearthClones + ' / 14d')}-orange` },
    { name: 'CoalHearth_Developers', re: /CoalHearth_Developers-[0-9a-zA-Z.%+]+-brightgreen/g, val: `CoalHearth_Developers-${encodeURIComponent(stats.hearthUniques + ' / 14d')}-brightgreen` },
    { name: 'CoalFace_Downloads', re: /CoalFace_Downloads-[0-9a-zA-Z.%+]+-orange/g, val: `CoalFace_Downloads-${encodeURIComponent(stats.faceClones + ' / 14d')}-orange` },
    { name: 'CoalFace_Developers', re: /CoalFace_Developers-[0-9a-zA-Z.%+]+-brightgreen/g, val: `CoalFace_Developers-${encodeURIComponent(stats.faceUniques + ' / 14d')}-brightgreen` },
  ];
}

// Returns a map of badge name → hit count in this file (0 = not present here).
function updateFileStats(filePath, stats) {
  const hits = {};
  try {
    let content = readFileSync(filePath, 'utf8');
    for (const spec of badgeSpecs(stats)) {
      const matched = content.match(spec.re);
      hits[spec.name] = matched ? matched.length : 0;
      content = content.replace(spec.re, spec.val);
    }
    writeFileSync(filePath, content, 'utf8');
    console.log(`Updated stats in ${filePath} successfully.`);
  } catch (err) {
    console.error(`FAIL updating stats in ${filePath}: ${err.message}`);
    process.exitCode = 1;
  }
  return hits;
}

// Fail loud if any badge was replaced NOWHERE across all files: a regex that
// stops matching (badge markup drifted) would otherwise silently no-op.
function assertEveryBadgeMatched(perFileHits, stats) {
  const totals = {};
  for (const spec of badgeSpecs(stats)) totals[spec.name] = 0;
  for (const hits of perFileHits) {
    for (const [name, n] of Object.entries(hits)) totals[name] += n;
  }
  const missing = Object.entries(totals).filter(([, n]) => n === 0).map(([name]) => name);
  if (missing.length) {
    console.error(`FAIL: badge regex matched nothing in any file — markup drifted? Unmatched: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}

async function main() {
  // Per-repo fetch: failures are non-fatal (logged + exitCode=1) so the other repos still update.
  const [mineData, tippleData, boardData, hearthData, faceData] = await Promise.all([
    fetchRepoClonesSafe('HetCreep/CoalMine'),
    fetchRepoClonesSafe('TheColliery/CoalTipple'),
    fetchRepoClonesSafe('TheColliery/CoalBoard'),
    fetchRepoClonesSafe('TheColliery/CoalHearth'),
    fetchRepoClonesSafe('TheColliery/CoalFace'),
  ]);

  const totalClones = (mineData.count || 0) + (tippleData.count || 0) + (boardData.count || 0) + (hearthData.count || 0) + (faceData.count || 0);
  const totalUniques = (mineData.uniques || 0) + (tippleData.uniques || 0) + (boardData.uniques || 0) + (hearthData.uniques || 0) + (faceData.uniques || 0);

  const stats = {
    combinedClones: formatStat(totalClones),
    combinedUniques: formatStat(totalUniques),
    mineClones: formatStat(mineData.count || 0),
    mineUniques: formatStat(mineData.uniques || 0),
    tippleClones: formatStat(tippleData.count || 0),
    tippleUniques: formatStat(tippleData.uniques || 0),
    boardClones: formatStat(boardData.count || 0),
    boardUniques: formatStat(boardData.uniques || 0),
    hearthClones: formatStat(hearthData.count || 0),
    hearthUniques: formatStat(hearthData.uniques || 0),
    faceClones: formatStat(faceData.count || 0),
    faceUniques: formatStat(faceData.uniques || 0)
  };

  console.log(`CoalMine - Clones: ${stats.mineClones}, Uniques: ${stats.mineUniques}`);
  console.log(`CoalTipple - Clones: ${stats.tippleClones}, Uniques: ${stats.tippleUniques}`);
  console.log(`CoalBoard - Clones: ${stats.boardClones}, Uniques: ${stats.boardUniques}`);
  console.log(`CoalHearth - Clones: ${stats.hearthClones}, Uniques: ${stats.hearthUniques}`);
  console.log(`CoalFace - Clones: ${stats.faceClones}, Uniques: ${stats.faceUniques}`);
  console.log(`Combined - Clones: ${stats.combinedClones}, Uniques: ${stats.combinedUniques}`);

  // Update both profile/README.md and root README.md.
  const profileReadmePath = join(process.cwd(), 'profile', 'README.md');
  const rootReadmePath = join(process.cwd(), 'README.md');

  const profileHits = updateFileStats(profileReadmePath, stats);
  const rootHits = updateFileStats(rootReadmePath, stats);
  assertEveryBadgeMatched([profileHits, rootHits], stats);
}

// Run only when invoked directly (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export { badgeSpecs, updateFileStats, assertEveryBadgeMatched };
