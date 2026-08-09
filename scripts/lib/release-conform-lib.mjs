// release-conform-lib.mjs — pure predicates over a GitHub Release object.
// No I/O, no fetch, no node builtins beyond what the caller already has in scope.
// Scope is deliberately mechanical only (RELEASE-PATTERN.md task-37 R8): title shape,
// prerelease flag, body presence, emoji-in-heading. Lead quality, CHANGELOG 1:1 fidelity
// and honest framing are judgment calls for the human reviewer — never scored here.

const EM_DASH = '—';
// Common emoji ranges (pictographs, symbols, dingbats, arrows-as-emoji, variation selector).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
// A bare `vX.Y.Z` with nothing after it (the banned "version alone, no summary" shape).
const BARE_VERSION = /^v?\d+\.\d+\.\d+\s*$/;

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

/**
 * Run every mechanical check against one GitHub Release object (the REST API shape:
 * name, tag_name, body, prerelease, draft). Returns an array of finding strings —
 * empty means clean. Caller filters to published (non-draft) releases before calling.
 */
export function checkRelease(release, repoName) {
  const findings = [];
  const title = release.name ?? '';

  if (release.prerelease === true) {
    findings.push('prerelease=true on a published Release (tags=beta+stable / Releases=stable-only — a beta/rc tag gets no Release at all)');
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
