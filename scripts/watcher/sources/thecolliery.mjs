// TheColliery's instance (BB-28, owner 2026-10-04: "Cron Worker สำหรับ TheColliery คือ ทุกแพลตฟอร์ม ai agents"): every AI agent platform the Coal* READMEs
// and skill files name, plus the major ones none of them names yet. DATA ONLY: no function, no credential (a source that needs one is a gap, not an entry).
// Source order is the stagger: a source with everyHours=n is due when (hour + its index) % n === 0, so adding to the END keeps every earlier slot.
// Preferred sources, in order: a releases.atom feed or an RSS feed, a raw markdown changelog, an HTML changelog by its first headings; where a repository
// buries its stable releases under alpha or nightly tags (Codex, Gemini CLI, Qwen Code), the npm registry's `latest` manifest, which only a stable publish moves. ignoreTitle drops
// pre-release noise (nightly, alpha, SDK or desktop tags that share a repository with the platform itself).
export default {
  instance: 'thecolliery',
  maxPerRun: 24,
  sources: [
    { id: 'claude-code', name: 'Claude Code', url: 'https://github.com/anthropics/claude-code/releases.atom', kind: 'atom', everyHours: 1 },
    { id: 'codex', name: 'OpenAI Codex CLI', url: 'https://registry.npmjs.org/@openai/codex/latest', kind: 'raw', everyHours: 2 },
    { id: 'gemini-cli', name: 'Gemini CLI', url: 'https://registry.npmjs.org/@google/gemini-cli/latest', kind: 'raw', everyHours: 2 },
    { id: 'antigravity', name: 'Google Antigravity', url: 'https://antigravity.google/changelog.md', kind: 'raw', everyHours: 6 },
    { id: 'copilot-cli', name: 'GitHub Copilot CLI', url: 'https://github.com/github/copilot-cli/releases.atom', kind: 'atom', everyHours: 2, ignoreTitle: '-\\d+\\s*$' },
    { id: 'copilot-changelog', name: 'GitHub Copilot (changelog)', url: 'https://github.blog/changelog/label/copilot/feed/', kind: 'rss', everyHours: 2 },
    { id: 'cursor', name: 'Cursor', url: 'https://cursor.com/changelog/rss.xml', kind: 'rss', everyHours: 2 },
    { id: 'cline', name: 'Cline', url: 'https://github.com/cline/cline/releases.atom', kind: 'atom', everyHours: 2, ignoreTitle: '^sdk/|^SDK|^Desktop|^CLI' },
    { id: 'windsurf', name: 'Windsurf (Devin Desktop)', url: 'https://docs.devin.ai/desktop/changelog', kind: 'raw', everyHours: 6 },
    { id: 'devin', name: 'Devin', url: 'https://docs.devin.ai/release-notes/overview.md', kind: 'raw', everyHours: 6 },
    { id: 'kiro', name: 'Kiro', url: 'https://kiro.dev/changelog/', kind: 'headings', everyHours: 6 },
    { id: 'augment', name: 'Augment Code', url: 'https://www.augmentcode.com/changelog', kind: 'headings', everyHours: 6 },
    { id: 'goose', name: 'Goose', url: 'https://github.com/block/goose/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'amp', name: 'Amp', url: 'https://ampcode.com/news.rss', kind: 'rss', everyHours: 6 },
    { id: 'opencode', name: 'OpenCode', url: 'https://github.com/sst/opencode/releases.atom', kind: 'atom', everyHours: 2 },
    { id: 'roo-code', name: 'Roo Code', url: 'https://github.com/RooCodeInc/Roo-Code/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'kilo-code', name: 'Kilo Code', url: 'https://github.com/Kilo-Org/kilocode/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'continue', name: 'Continue', url: 'https://github.com/continuedev/continue/releases.atom', kind: 'atom', everyHours: 12 },
    { id: 'aider', name: 'Aider', url: 'https://github.com/Aider-AI/aider/releases.atom', kind: 'atom', everyHours: 12, ignoreTitle: 'dev' },
    { id: 'qwen-code', name: 'Qwen Code', url: 'https://registry.npmjs.org/@qwen-code/qwen-code/latest', kind: 'raw', everyHours: 6 },
    { id: 'openhands', name: 'OpenHands', url: 'https://github.com/OpenHands/OpenHands/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'mistral-vibe', name: 'Mistral Vibe', url: 'https://github.com/mistralai/mistral-vibe/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'crush', name: 'Crush', url: 'https://github.com/charmbracelet/crush/releases.atom', kind: 'atom', everyHours: 12, ignoreTitle: 'nightly' },
    { id: 'zed', name: 'Zed', url: 'https://github.com/zed-industries/zed/releases.atom', kind: 'atom', everyHours: 12, ignoreTitle: 'nightly|staging|-pre|^[a-z]+-v' },
    { id: 'jules', name: 'Google Jules', url: 'https://jules.google/docs/changelog.md', kind: 'raw', everyHours: 12 },
  ],
};
