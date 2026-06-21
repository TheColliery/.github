import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const token = process.env.PAT_TOKEN;

if (!token) {
  console.error('Error: No authentication token (PAT_TOKEN or GITHUB_TOKEN) detected.');
  process.exit(1);
}

const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'TheColliery-Stats-Updater',
  'Authorization': `token ${token}`
};

async function fetchRepoClones(repo) {
  const url = `https://api.github.com/repos/${repo}/traffic/clones`;
  console.log(`Fetching clones for ${repo}...`);
  const res = await fetch(url, { headers });
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

function updateFileStats(filePath, stats) {
  try {
    let content = readFileSync(filePath, 'utf8');

    // Replace global combined badges
    const globalDownloadsRegex = /(?<![\w_])Downloads-[0-9a-zA-Z.%+]+-orange/g;
    const globalDevelopersRegex = /(?<![\w_])Developers-[0-9a-zA-Z.%+]+-brightgreen/g;
    
    content = content.replace(globalDownloadsRegex, `Downloads-${encodeURIComponent(stats.combinedClones + ' / 14d')}-orange`);
    content = content.replace(globalDevelopersRegex, `Developers-${encodeURIComponent(stats.combinedUniques + ' / 14d')}-brightgreen`);

    // Replace CoalMine badges
    const mineDownloadsRegex = /CoalMine_Downloads-[0-9a-zA-Z.%+]+-orange/g;
    const mineDevelopersRegex = /CoalMine_Developers-[0-9a-zA-Z.%+]+-brightgreen/g;
    
    content = content.replace(mineDownloadsRegex, `CoalMine_Downloads-${encodeURIComponent(stats.mineClones + ' / 14d')}-orange`);
    content = content.replace(mineDevelopersRegex, `CoalMine_Developers-${encodeURIComponent(stats.mineUniques + ' / 14d')}-brightgreen`);

    // Replace CoalTipple badges
    const tippleDownloadsRegex = /CoalTipple_Downloads-[0-9a-zA-Z.%+]+-orange/g;
    const tippleDevelopersRegex = /CoalTipple_Developers-[0-9a-zA-Z.%+]+-brightgreen/g;

    content = content.replace(tippleDownloadsRegex, `CoalTipple_Downloads-${encodeURIComponent(stats.tippleClones + ' / 14d')}-orange`);
    content = content.replace(tippleDevelopersRegex, `CoalTipple_Developers-${encodeURIComponent(stats.tippleUniques + ' / 14d')}-brightgreen`);

    // Replace CoalBoard badges
    const boardDownloadsRegex = /CoalBoard_Downloads-[0-9a-zA-Z.%+]+-orange/g;
    const boardDevelopersRegex = /CoalBoard_Developers-[0-9a-zA-Z.%+]+-brightgreen/g;

    content = content.replace(boardDownloadsRegex, `CoalBoard_Downloads-${encodeURIComponent(stats.boardClones + ' / 14d')}-orange`);
    content = content.replace(boardDevelopersRegex, `CoalBoard_Developers-${encodeURIComponent(stats.boardUniques + ' / 14d')}-brightgreen`);

    writeFileSync(filePath, content, 'utf8');
    console.log(`Updated stats in ${filePath} successfully.`);
  } catch (err) {
    console.error(`FAIL updating stats in ${filePath}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  // Per-repo fetch: failures are non-fatal (logged + exitCode=1) so the other repos still update.
  const [mineData, tippleData, boardData] = await Promise.all([
    fetchRepoClonesSafe('HetCreep/CoalMine'),
    fetchRepoClonesSafe('TheColliery/CoalTipple'),
    fetchRepoClonesSafe('TheColliery/CoalBoard'),
  ]);

  const totalClones = (mineData.count || 0) + (tippleData.count || 0) + (boardData.count || 0);
  const totalUniques = (mineData.uniques || 0) + (tippleData.uniques || 0) + (boardData.uniques || 0);

  const stats = {
    combinedClones: formatStat(totalClones),
    combinedUniques: formatStat(totalUniques),
    mineClones: formatStat(mineData.count || 0),
    mineUniques: formatStat(mineData.uniques || 0),
    tippleClones: formatStat(tippleData.count || 0),
    tippleUniques: formatStat(tippleData.uniques || 0),
    boardClones: formatStat(boardData.count || 0),
    boardUniques: formatStat(boardData.uniques || 0)
  };

  console.log(`CoalMine - Clones: ${stats.mineClones}, Uniques: ${stats.mineUniques}`);
  console.log(`CoalTipple - Clones: ${stats.tippleClones}, Uniques: ${stats.tippleUniques}`);
  console.log(`CoalBoard - Clones: ${stats.boardClones}, Uniques: ${stats.boardUniques}`);
  console.log(`Combined - Clones: ${stats.combinedClones}, Uniques: ${stats.combinedUniques}`);

  // Update both profile/README.md and root README.md.
  const profileReadmePath = join(process.cwd(), 'profile', 'README.md');
  const rootReadmePath = join(process.cwd(), 'README.md');

  updateFileStats(profileReadmePath, stats);
  updateFileStats(rootReadmePath, stats);
}

main();
