import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const token = process.env.PAT_TOKEN || process.env.GITHUB_TOKEN;

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

function formatStat(num) {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k+`;
  }
  return `${num}+`;
}

async function main() {
  try {
    const mineData = await fetchRepoClones('HetCreep/CoalMine');
    const tippleData = await fetchRepoClones('TheColliery/CoalTipple');

    const totalClones = (mineData.count || 0) + (tippleData.count || 0);
    const totalUniques = (mineData.uniques || 0) + (tippleData.uniques || 0);

    console.log(`Combined Clones (14d): ${totalClones}`);
    console.log(`Combined Uniques (14d): ${totalUniques}`);

    const readmePath = join(process.cwd(), 'profile', 'README.md');
    let content = readFileSync(readmePath, 'utf8');

    const formattedClones = formatStat(totalClones);
    const formattedUniques = formatStat(totalUniques);

    // Replace badge parameters using regex
    // e.g. Downloads-1.4k%2B%20%2F%2014d-orange
    const downloadsRegex = /Downloads-[0-9a-zA-Z.%+]+-orange/;
    const developersRegex = /Developers-[0-9a-zA-Z.%+]+-brightgreen/;

    const newDownloadsBadge = `Downloads-${encodeURIComponent(formattedClones + ' / 14d')}-orange`;
    const newDevelopersBadge = `Developers-${encodeURIComponent(formattedUniques + ' / 14d')}-brightgreen`;

    content = content.replace(downloadsRegex, newDownloadsBadge);
    content = content.replace(developersRegex, newDevelopersBadge);

    writeFileSync(readmePath, content, 'utf8');
    console.log('README.md updated successfully with the latest stats.');
  } catch (error) {
    console.error('Execution failed:', error.message);
    process.exit(1);
  }
}

main();
