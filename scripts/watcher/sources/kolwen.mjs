// Kolwen's instance (BB-28, owner 2026-10-04: "Cron Worker สำหรับ Kolwen คือ Cloudflare GitHub CodeRabbit Claude Code"): the four things the commercial hub
// builds on. DATA ONLY: no function, no credential. The same watcher code as TheColliery's instance; only this list differs. Deployed on the Kolwen account
// by the LLM chief with `node scripts/watcher/deploy-payload.mjs kolwen --from <sender>` (see README.md).
// Order is the stagger: a source with everyHours=n is due when (hour + its index) % n === 0, so adding to the END keeps every earlier slot.
export default {
  instance: 'kolwen',
  maxPerRun: 24,
  sources: [
    { id: 'claude-code', name: 'Claude Code', url: 'https://github.com/anthropics/claude-code/releases.atom', kind: 'atom', everyHours: 1 },
    { id: 'cloudflare-changelog', name: 'Cloudflare changelog', url: 'https://developers.cloudflare.com/changelog/rss/index.xml', kind: 'rss', everyHours: 2 },
    { id: 'github-changelog', name: 'GitHub changelog', url: 'https://github.blog/changelog/feed/', kind: 'rss', everyHours: 2 },
    { id: 'cloudflare-blog', name: 'Cloudflare blog', url: 'https://blog.cloudflare.com/rss/', kind: 'rss', everyHours: 6 },
    { id: 'coderabbit-changelog', name: 'CodeRabbit changelog', url: 'https://docs.coderabbit.ai/changelog.md', kind: 'raw', everyHours: 6 },
  ],
};
