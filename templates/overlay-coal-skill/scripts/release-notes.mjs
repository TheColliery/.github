#!/usr/bin/env node
// UMB-162 (a). Reads CHANGELOG.md, derives the canon Release title + body for the pushed tag
// (GITHUB_REF_NAME), and writes them to release-title.txt / release-body.md for the workflow's
// next step to hand to `gh release create`/`gh release edit`. A plain CLI entry, not a gate
// (node/runtime.md sec 1's own scope note) -- a crash here is an ordinary uncaught exception,
// non-zero exit, no false green; static top-level lib imports are fine.
import fs from 'node:fs';
// UMB-182: the workflow also hands in PREVIOUS_STABLE_TAG (`git describe --exclude='*-*'`, '' on a
// first stable release) and LATEST_TAG (the repo's current Latest, '' when there is none). Unset
// behaves as '' -- the heading check is then skipped and says so -- so the canon workflow always sets both.
import { extractChangelogEntry, buildReleaseTitle, buildReleaseBody, makeLatestFlag, ChangelogShapeError, ReleaseRefError } from './lib/release-shape.mjs';

const BARE = /^v\d+\.\d+\.\d+$/;

function main() {
  const ref = process.env.GITHUB_REF_NAME;
  if (!ref || !BARE.test(ref)) {
    console.error(`release-notes: GITHUB_REF_NAME "${ref}" is not a bare vX.Y.Z tag -- refusing to guess a title/body`);
    process.exitCode = 1;
    return;
  }
  const tagVersion = ref.slice(1);
  const prev = process.env.PREVIOUS_STABLE_TAG || '';
  const latest = process.env.LATEST_TAG || '';
  for (const [name, value] of [['PREVIOUS_STABLE_TAG', prev], ['LATEST_TAG', latest]]) {
    if (value && !BARE.test(value)) {
      console.error(`release-notes: ${name} "${value}" is not a bare vX.Y.Z tag -- refusing to guess`);
      process.exitCode = 1;
      return;
    }
  }

  let changelog;
  try {
    changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  } catch (e) {
    console.error(`release-notes: could not read CHANGELOG.md: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const { summary, sectionsBody } = extractChangelogEntry(changelog, tagVersion, { previousStable: prev.slice(1) });
    const latestFlag = makeLatestFlag(tagVersion, latest);
    fs.writeFileSync('release-title.txt', buildReleaseTitle(tagVersion, summary));
    fs.writeFileSync('release-body.md', buildReleaseBody(summary, sectionsBody));
    fs.writeFileSync('release-latest.txt', latestFlag);
    console.log(`release-notes: derived the Release title + body for ${ref} from CHANGELOG.md's [${tagVersion}] entry`);
    console.log(prev ? `release-notes: the entry is followed by the previous stable tag's heading [${prev.slice(1)}]` : 'release-notes: no previous stable tag -- the heading-continuity check is skipped');
    console.log(`release-notes: make_latest=${latestFlag} (current Latest: ${latest || 'none'})`);
  } catch (e) {
    if (e instanceof ChangelogShapeError || e instanceof ReleaseRefError) {
      console.error(`release-notes: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    throw e;
  }
}

main();
