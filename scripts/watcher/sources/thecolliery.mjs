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
    { id: 'claude-code', name: 'Claude Code', url: 'https://github.com/anthropics/claude-code/releases.atom', kind: 'atom', everyHours: 1, tier: 'cold' },
    { id: 'codex', name: 'OpenAI Codex CLI', url: 'https://registry.npmjs.org/@openai/codex/latest', kind: 'raw', everyHours: 2, tier: 'cold' },
    { id: 'gemini-cli', name: 'Gemini CLI', url: 'https://registry.npmjs.org/@google/gemini-cli/latest', kind: 'raw', everyHours: 2 },
    { id: 'antigravity', name: 'Google Antigravity', url: 'https://antigravity.google/changelog.md', kind: 'raw', everyHours: 24 },
    { id: 'copilot-cli', name: 'GitHub Copilot CLI', url: 'https://github.com/github/copilot-cli/releases.atom', kind: 'atom', everyHours: 2, ignoreTitle: '-\\d+\\s*$', tier: 'cold' },
    { id: 'copilot-changelog', name: 'GitHub Copilot (changelog)', url: 'https://github.blog/changelog/label/copilot/feed/', kind: 'rss', everyHours: 2 },
    { id: 'cursor', name: 'Cursor', url: 'https://cursor.com/changelog/rss.xml', kind: 'rss', everyHours: 24 },
    { id: 'cline', name: 'Cline', url: 'https://github.com/cline/cline/releases.atom', kind: 'atom', everyHours: 2, ignoreTitle: '^sdk/|^SDK|^Desktop|^CLI|^archive/' },
    { id: 'windsurf', name: 'Windsurf (Devin Desktop)', url: 'https://docs.devin.ai/desktop/changelog.md', kind: 'raw', keyPattern: '\\*\\*v\\d+\\.\\d+\\.\\d+\\*\\*', everyHours: 6 },
    { id: 'devin', name: 'Devin', url: 'https://docs.devin.ai/release-notes/overview.md', kind: 'raw', everyHours: 6 },
    { id: 'kiro', name: 'Kiro', url: 'https://kiro.dev/changelog/', kind: 'headings', everyHours: 6 },
    { id: 'augment', name: 'Augment Code', url: 'https://www.augmentcode.com/changelog', kind: 'headings', everyHours: 6 },
    { id: 'goose', name: 'Goose', url: 'https://github.com/aaif-goose/goose/releases.atom', kind: 'atom', everyHours: 6, ignoreTitle: '^gdk-|^windows-installer-test' },
    { id: 'amp', name: 'Amp', url: 'https://ampcode.com/news.rss', kind: 'rss', everyHours: 6 },
    { id: 'opencode', name: 'OpenCode', url: 'https://github.com/anomalyco/opencode/releases.atom', kind: 'atom', everyHours: 2, ignoreTitle: '^vscode-|^github-v|^process-daemon' },
    { id: 'roo-code', name: 'Roo Code', url: 'https://github.com/RooCodeInc/Roo-Code/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'kilo-code', name: 'Kilo Code', url: 'https://github.com/Kilo-Org/kilocode/releases.atom', kind: 'atom', everyHours: 6, ignoreTitle: '^kilo-v2-checkpoints|^jetbrains\\b' },
    { id: 'continue', name: 'Continue', url: 'https://github.com/continuedev/continue/releases.atom', kind: 'atom', everyHours: 12 },
    { id: 'aider', name: 'Aider', url: 'https://github.com/Aider-AI/aider/releases.atom', kind: 'atom', everyHours: 12, ignoreTitle: 'dev' },
    { id: 'qwen-code', name: 'Qwen Code', url: 'https://registry.npmjs.org/@qwen-code/qwen-code/latest', kind: 'raw', everyHours: 6 },
    { id: 'openhands', name: 'OpenHands', url: 'https://github.com/OpenHands/OpenHands/releases.atom', kind: 'atom', everyHours: 6, ignoreTitle: '-r[0-9]+$' },
    { id: 'mistral-vibe', name: 'Mistral Vibe', url: 'https://github.com/mistralai/mistral-vibe/releases.atom', kind: 'atom', everyHours: 6, tier: 'cold' },
    { id: 'crush', name: 'Crush', url: 'https://github.com/charmbracelet/crush/releases.atom', kind: 'atom', everyHours: 12, ignoreTitle: 'nightly' },
    { id: 'zed', name: 'Zed', url: 'https://github.com/zed-industries/zed/releases.atom', kind: 'atom', everyHours: 12, ignoreTitle: 'nightly|staging|-pre|^[a-z]+-v' },
    // the Coal* editor's survey (2026-11-19a): Jules leaves after 2026-12-31, a dated drop (the cron stops reading it on 2027-01-01; the row is deleted later)
    { id: 'jules', name: 'Google Jules', url: 'https://jules.google/docs/changelog.md', kind: 'raw', everyHours: 12, until: '2026-12-31' },
    // UMB2-014: GitHub's own changelog, one feed per label the Coal* beat follows (each holds the last 10 entries). The sixth label, copilot, is already `copilot-changelog` above.
    { id: 'github-changelog-actions', name: 'GitHub changelog (Actions)', url: 'https://github.blog/changelog/label/actions/feed/', kind: 'rss', everyHours: 2 },
    { id: 'github-changelog-application-security', name: 'GitHub changelog (application security)', url: 'https://github.blog/changelog/label/application-security/feed/', kind: 'rss', everyHours: 2 },
    { id: 'github-changelog-supply-chain-security', name: 'GitHub changelog (supply chain security)', url: 'https://github.blog/changelog/label/supply-chain-security/feed/', kind: 'rss', everyHours: 2 },
    { id: 'github-changelog-platform-governance', name: 'GitHub changelog (platform governance)', url: 'https://github.blog/changelog/label/platform-governance/feed/', kind: 'rss', everyHours: 6 },
    { id: 'github-changelog-account-management', name: 'GitHub changelog (account management)', url: 'https://github.blog/changelog/label/account-management/feed/', kind: 'rss', everyHours: 6 },
    // BB-112 / Issues 39-42, main's ruling 2026-10-09: the Cloudflare surfaces THIS account runs (the watcher, the release mirror and the inbox Workers, KV, R2, Email Routing, Registrar, DNS), appended at the END so no earlier slot moves.
    // The status HISTORY by id (an incident that opened and closed between two hourly reads still shows), the per-product changelog feeds of the six products, and the four pages that size the Workers (Free plan limits and pricing, hashed from their .md form).
    // Not here, by the same ruling: the GitHub release feeds, the One Client feed and Workers AI belong to the commercial hub's list (kolwen.mjs).
    { id: 'github-changelog', name: 'GitHub changelog', url: 'https://github.blog/changelog/feed/', kind: 'rss', everyHours: 2 },
    { id: 'coderabbit-changelog', name: 'CodeRabbit changelog', url: 'https://docs.coderabbit.ai/changelog.md', kind: 'raw', everyHours: 6 },
    { id: 'skillspector', name: 'NVIDIA SkillSpector releases', url: 'https://github.com/NVIDIA/SkillSpector/releases.atom', kind: 'atom', everyHours: 24, tier: 'cold' },
    { id: 'git-for-windows', name: 'Git for Windows releases', url: 'https://github.com/git-for-windows/git/releases.atom', kind: 'atom', everyHours: 24, tier: 'cold' },
    { id: 'mcp-spec', name: 'Model Context Protocol specification releases', url: 'https://github.com/modelcontextprotocol/modelcontextprotocol/releases.atom', kind: 'atom', everyHours: 24, tier: 'cold' },
    { id: 'nodejs-security', name: 'Node.js security releases', url: 'https://nodejs.org/en/feed/vulnerability.xml', kind: 'rss', everyHours: 24, tier: 'cold' },
    { id: 'gitbook-changelog', name: 'GitBook changelog', url: 'https://gitbook.com/docs/changelog/rss.xml', kind: 'rss', everyHours: 24, tier: 'cold' },
    // the Coal* editor's survey (2026-11-19a): the releases feed (claude-code, cold) omits the hook and -p lines that CHANGELOG.md carries; keyed on its newest version heading, so an edit inside an entry is no news
    { id: 'claude-code-changelog', name: 'Claude Code (CHANGELOG.md)', url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md', kind: 'raw', keyPattern: '## \\d+\\.\\d+\\.\\d+', everyHours: 24 },
  ],
};
