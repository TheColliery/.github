// release-conform-lib.mjs — pure predicates over a GitHub Release object.
// No I/O, no fetch, no node builtins beyond what the caller already has in scope.
// Scope is deliberately mechanical only (RELEASE-PATTERN.md task-37 R8 + UMB-050/053):
// title shape, prerelease flag, body presence, emoji-in-heading, and the PS-5.1
// ETS-object-leak signature. Lead quality, CHANGELOG 1:1 fidelity and honest framing are
// judgment calls for the human reviewer — never scored here.

const EM_DASH = '—';
// Common emoji ranges (pictographs, symbols, dingbats, arrows-as-emoji, variation selector).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
// A bare `vX.Y.Z` with nothing after it (the banned "version alone, no summary" shape) -- a
// trailing separator with NO summary behind it counts too: "v2.1.2 -" is the titleless release
// RELEASE-NOTES-TEMPLATE's issue 1 records (UMB-112 row 20, CodeRabbit).
const BARE_VERSION = /^v?\d+\.\d+\.\d+\s*(?:[-\u2013\u2014:]\s*)?$/;

/** Does `title` open with `repoName` as a literal prefix (the banned repo-name-prefix)? */
export function hasRepoPrefix(title, repoName) {
  if (!title || !repoName) return false;
  const t = title.trim().toLowerCase();
  const r = repoName.trim().toLowerCase();
  return t.startsWith(r + ' ') || t.startsWith(r + ':') || t.startsWith(r + '-');
}

/** Is `title` a bare version with no summary at all? */
export function isBareVersionTitle(title) {
  if (!title) return true;
  return BARE_VERSION.test(title.trim());
}

/** Separator class right after the version: 'hyphen' | 'em-dash' | 'other' | 'none' (no version match). */
export function separatorClass(title) {
  if (!title) return 'none';
  const m = title.trim().match(/^v?\d+\.\d+\.\d+\s*(.)/);
  if (!m) return 'none';
  if (m[1] === '-') return 'hyphen';
  if (m[1] === EM_DASH) return 'em-dash';
  return 'other';
}

/** True when `text` contains an emoji character. */
export function hasEmoji(text) {
  return !!text && EMOJI.test(text);
}

// PowerShell 5.1's Get-Content -Raw attaches ETS NoteProperties to the string it returns;
// passing that decorated string into ConvertTo-Json (piped, or via a hashtable that does
// not first cast it with [string]) serializes the WHOLE object -- these keys are the
// leaked object's own property names and do not appear in ordinary release prose
// (RELEASE-PATTERN.md "A Release body is re-read after every write", UMB-050/UMB-053).
const PS_LEAK_MARKERS = ['"PSPath"', '"PSParentPath"', '"PSChildName"', '"PSDrive"', '"PSProvider"'];

/** True when `body` carries the structural signature of a leaked PS ETS-decorated object. */
export function hasPsObjectLeak(body) {
  if (!body) return false;
  return PS_LEAK_MARKERS.some((marker) => body.includes(marker));
}

// A SemVer pre-release identifier: a hyphen right after MAJOR.MINOR.PATCH (v0.1.0-beta.1, v2.0.0-rc.1).
const PRERELEASE_TAG = /^v?\d+\.\d+\.\d+-[0-9A-Za-z.-]+/;

/**
 * THE LAUNCH FORM (owner 2026-09-21, RELEASE-PATTERN.md "Which tags get a Release"): a repo whose FIRST public version is a pre-release form gets ONE
 * Release marked prerelease:true as its launch announcement; later pre-release tags stay tag-only;
 * the first stable closes the form. So the one conformant prerelease Release is the repo's OLDEST
 * published Release. Returns that Release's tag_name, or null when the oldest published Release is
 * stable (or there is none). Order-independent; drafts are not published and are ignored.
 */
export function launchFormTag(releases) {
  const published = (releases ?? []).filter((r) => r && !r.draft);
  if (published.length === 0) return null;
  const oldest = published.reduce((a, b) => (Date.parse(b.created_at) < Date.parse(a.created_at) ? b : a));
  return oldest.prerelease === true ? oldest.tag_name : null;
}

/**
 * Run every mechanical check against one GitHub Release object (the REST API shape:
 * name, tag_name, body, prerelease, draft). Returns an array of finding strings —
 * empty means clean. Caller filters to published (non-draft) releases before calling.
 * `ctx.launchTag` (from launchFormTag over the repo's releases) names the one prerelease Release
 * the launch form allows; a caller that passes no ctx gets the original stable-only reading.
 */
export function checkRelease(release, repoName, ctx = {}) {
  const findings = [];
  const title = release.name ?? '';

  if (release.prerelease === true) {
    if (ctx.launchTag !== undefined && ctx.launchTag === release.tag_name) {
      if (!PRERELEASE_TAG.test(release.tag_name ?? '')) {
        findings.push(`prerelease=true on tag '${release.tag_name}', which has no SemVer pre-release identifier (the launch form is for a beta/rc/alpha first version)`);
      }
    } else {
      findings.push(`prerelease=true on a published Release that is not the repo's launch-form Release (tags=beta+stable / Releases=stable-only, plus exactly ONE launch-form pre-release Release: the repo's first)`);
    }
  }

  if (isBareVersionTitle(title)) {
    findings.push(`title '${title}' is a bare version with no summary`);
  } else {
    if (hasRepoPrefix(title, repoName)) {
      findings.push(`title '${title}' carries a repo-name prefix (bare vX.Y.Z only)`);
    }
    const sep = separatorClass(title);
    if (sep === 'em-dash') {
      findings.push(`title '${title}' uses an em-dash separator (spaced hyphen '-' required)`);
    } else if (sep === 'other') {
      findings.push(`title '${title}' uses a non-hyphen separator after the version`);
    }
  }

  if (hasEmoji(title)) {
    findings.push(`title '${title}' contains an emoji`);
  }

  const body = release.body ?? '';
  if (!body.trim()) {
    findings.push('body is empty');
  } else if (hasPsObjectLeak(body)) {
    findings.push('body looks like a serialized PowerShell object (ETS NoteProperties leaked) -- not release text; see RELEASE-PATTERN.md "A Release body is re-read after every write"');
  } else {
    for (const line of body.split(/\r?\n/)) {
      if (/^#{1,6}\s/.test(line) && hasEmoji(line)) {
        findings.push(`body heading '${line.trim()}' contains an emoji`);
        break;
      }
    }
  }

  return findings;
}
