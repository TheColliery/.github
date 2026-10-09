// Kolwen's instance (BB-28, owner 2026-10-04: "Cron Worker สำหรับ Kolwen คือ Cloudflare GitHub CodeRabbit Claude Code"): the four things the commercial hub
// builds on. DATA ONLY: no function, no credential. The same watcher code as TheColliery's instance; only this list differs. Deployed on the Kolwen account
// by the LLM chief with `node scripts/watcher/deploy-payload.mjs kolwen --from <sender>` (see README.md).
// Order is the stagger: a source with everyHours=n is due when (hour + its index) % n === 0, so adding to the END keeps every earlier slot.
// 63 sources; the busiest hour of the week asks for the number the test prints in its failure message, against maxPerRun and the Free plan's 50 subrequests.
export default {
  instance: 'kolwen',
  maxPerRun: 24,
  sources: [
    { id: 'claude-code', name: 'Claude Code', url: 'https://github.com/anthropics/claude-code/releases.atom', kind: 'atom', everyHours: 1 },
    { id: 'cloudflare-changelog', name: 'Cloudflare changelog', url: 'https://developers.cloudflare.com/changelog/rss/index.xml', kind: 'rss', everyHours: 2 },
    { id: 'github-changelog', name: 'GitHub changelog', url: 'https://github.blog/changelog/feed/', kind: 'rss', everyHours: 2 },
    { id: 'cloudflare-blog', name: 'Cloudflare blog', url: 'https://blog.cloudflare.com/rss/', kind: 'rss', everyHours: 6 },
    { id: 'coderabbit-changelog', name: 'CodeRabbit changelog', url: 'https://docs.coderabbit.ai/changelog.md', kind: 'raw', everyHours: 6 },
    // UMB-460 (1): the beat's 44 rows, in the order of LLMWorks/warehouse/antenna-beat-2026-10.md section 2 (row 1 first), each read once on 2026-10-05.
    { id: 'anthropic-api-notes', name: 'Anthropic · Claude Platform release notes', url: 'https://platform.claude.com/docs/en/release-notes/feed.xml', kind: 'rss', everyHours: 2 },
    { id: 'anthropic-deprecations', name: 'Anthropic · model deprecations', url: 'https://platform.claude.com/docs/en/about-claude/model-deprecations.md', kind: 'raw', everyHours: 6 },
    { id: 'anthropic-pricing', name: 'Anthropic · API pricing', url: 'https://platform.claude.com/docs/en/about-claude/pricing.md', kind: 'raw', everyHours: 6 },
    { id: 'anthropic-models', name: 'Anthropic · models overview', url: 'https://platform.claude.com/docs/en/models/overview.md', kind: 'raw', everyHours: 6 },
    { id: 'anthropic-news', name: 'Anthropic · newsroom', url: 'https://www.anthropic.com/news', kind: 'headings', everyHours: 6 },
    { id: 'anthropic-status', name: 'Anthropic · Claude status', url: 'https://status.claude.com/history.atom', kind: 'atom', everyHours: 2 },
    { id: 'openai-news', name: 'OpenAI · news', url: 'https://openai.com/news/rss.xml', kind: 'rss', everyHours: 2 },
    { id: 'openai-status', name: 'OpenAI · status', url: 'https://status.openai.com/history.atom', kind: 'atom', everyHours: 2 },
    { id: 'codex-npm', name: 'OpenAI · Codex CLI', url: 'https://registry.npmjs.org/@openai/codex/latest', kind: 'raw', everyHours: 2 },
    { id: 'gemini-api-changelog', name: 'Google · Gemini API changelog', url: 'https://ai.google.dev/gemini-api/docs/changelog.md.txt', kind: 'raw', everyHours: 2 },
    { id: 'google-ai-blog', name: 'Google · AI blog', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/', kind: 'rss', everyHours: 6 },
    { id: 'google-developers-blog', name: 'Google · developers blog', url: 'https://developers.googleblog.com/feeds/posts/default/', kind: 'rss', everyHours: 6 },
    { id: 'antigravity-changelog', name: 'Google · Antigravity', url: 'https://antigravity.google/changelog.md', kind: 'raw', everyHours: 6 },
    { id: 'mistral-news', name: 'Mistral · news', url: 'https://mistral.ai/news/rss', kind: 'rss', everyHours: 6 },
    { id: 'mistral-changelog', name: 'Mistral · docs changelog', url: 'https://docs.mistral.ai/resources/changelogs', kind: 'headings', everyHours: 6 },
    { id: 'groq-changelog', name: 'Groq · API changelog', url: 'https://console.groq.com/docs/changelog.md', kind: 'raw', everyHours: 6 },
    { id: 'nvidia-dev-blog', name: 'NVIDIA · developer technical blog', url: 'https://developer.nvidia.com/blog/feed/', kind: 'atom', everyHours: 12 },
    { id: 'openrouter-blog', name: 'OpenRouter · blog', url: 'https://openrouter.ai/blog/feed.xml', kind: 'rss', everyHours: 6 },
    { id: 'openrouter-models', name: 'OpenRouter · public model list', url: 'https://openrouter.ai/api/v1/models', kind: 'raw', everyHours: 6 },
    { id: 'hf-blog', name: 'Hugging Face · blog', url: 'https://huggingface.co/blog/feed.xml', kind: 'rss', everyHours: 6 },
    { id: 'hfapi-qwen', name: 'Alibaba Qwen · newest model on the Hub', url: 'https://huggingface.co/api/models?author=Qwen&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-deepseek', name: 'DeepSeek · newest model on the Hub', url: 'https://huggingface.co/api/models?author=deepseek-ai&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-moonshot', name: 'Moonshot · newest model on the Hub', url: 'https://huggingface.co/api/models?author=moonshotai&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-zai', name: 'Z.ai · newest model on the Hub', url: 'https://huggingface.co/api/models?author=zai-org&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-google', name: 'Google · newest model on the Hub', url: 'https://huggingface.co/api/models?author=google&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-mistral', name: 'Mistral · newest model on the Hub', url: 'https://huggingface.co/api/models?author=mistralai&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-aisingapore', name: 'AI Singapore · newest model on the Hub', url: 'https://huggingface.co/api/models?author=aisingapore&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-nvidia', name: 'NVIDIA · newest model on the Hub', url: 'https://huggingface.co/api/models?author=nvidia&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-swiss-ai', name: 'Swiss AI · newest model on the Hub', url: 'https://huggingface.co/api/models?author=swiss-ai&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-allenai', name: 'Ai2 · newest model on the Hub', url: 'https://huggingface.co/api/models?author=allenai&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-openthaigpt', name: 'OpenThaiGPT · newest model on the Hub', url: 'https://huggingface.co/api/models?author=openthaigpt&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-sarvamai', name: 'Sarvam · newest model on the Hub', url: 'https://huggingface.co/api/models?author=sarvamai&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'hfapi-minimax', name: 'MiniMax · newest model on the Hub', url: 'https://huggingface.co/api/models?author=MiniMaxAI&sort=createdAt&direction=-1&limit=2&expand[]=createdAt', kind: 'raw', everyHours: 12 },
    { id: 'cloudflare-workers-ai', name: 'Cloudflare · Workers AI changelog', url: 'https://developers.cloudflare.com/changelog/rss/workers-ai.xml', kind: 'rss', everyHours: 2 },
    { id: 'sealion-blog', name: 'AI Singapore · SEA-LION blog', url: 'https://sea-lion.ai/feed/', kind: 'rss', everyHours: 12 },
    { id: 'deepseek-updates', name: 'DeepSeek · API change log', url: 'https://api-docs.deepseek.com/updates/', kind: 'headings', everyHours: 6 },
    { id: 'deepseek-status', name: 'DeepSeek · status', url: 'https://status.deepseek.com/history.atom', kind: 'atom', everyHours: 6 },
    { id: 'xai-news', name: 'xAI · news', url: 'https://x.ai/news', kind: 'headings', everyHours: 6 },
    { id: 'perplexity-changelog', name: 'Perplexity · API changelog', url: 'https://docs.perplexity.ai/docs/resources/changelog/rss.xml', kind: 'rss', everyHours: 6 },
    { id: 'allenai-blog', name: 'Ai2 · research and news', url: 'https://allenai.org/rss.xml', kind: 'rss', everyHours: 12 },
    { id: 'sarvam-blog', name: 'Sarvam · blog', url: 'https://www.sarvam.ai/rss.xml', kind: 'rss', everyHours: 12 },
    { id: 'cursor-changelog', name: 'Cursor · changelog', url: 'https://cursor.com/changelog/rss.xml', kind: 'rss', everyHours: 6 },
    { id: 'github-copilot', name: 'GitHub · Copilot changelog label', url: 'https://github.blog/changelog/label/copilot/feed/', kind: 'rss', everyHours: 2 },
    { id: 'paddle-changelog', name: 'Paddle · developer changelog', url: 'https://developer.paddle.com/changelog.xml', kind: 'rss', everyHours: 6 },
    // BB-56 (owner 2026-10-06): two status watches beside the e-mail subscription; the owner keeps one channel once both have carried the same events.
    // The incident HISTORY, read by id (kind incidents): an incident that opens and closes between two hourly reads still moves the key, which the unresolved list (this row's
    // first version) never saw: an 11-minute CDN incident of 2026-10-02 fell through it (Issue 39). Not history.atom: Cloudflare's history feed holds scheduled maintenance dated in the future.
    { id: 'cloudflare-status', name: 'Cloudflare status (incident history)', url: 'https://www.cloudflarestatus.com/api/v2/incidents.json', kind: 'incidents', everyHours: 1 },
    // incidents.json, not summary.json: the history keeps an incident that opened and closed between two reads, the summary forgets it.
    { id: 'groq-status', name: 'Groq status (incidents)', url: 'https://groqstatus.com/api/v2/incidents.json', kind: 'raw', everyHours: 2 },
    // BB-112 sweep gaps (Issues 39, 41, 42 of the .github repo, read 2026-10-08): the Cloudflare beat's holes, appended at the END so every earlier slot keeps its hour.
    // The One Client (WARP) release notes arrive only through the changelog's per-product feed; the four GitHub feeds carry the releases that never reach the
    // changelog (a monorepo's tags are filtered to the package the commercial hub runs: Wrangler, the Agents SDK); the seven pages are the Free-plan facts the
    // deployed Workers are sized on, hashed from their .md form (a change to a number, a date or a sentence moves the hash; the title is the page's first heading).
    { id: 'cloudflare-one-client', name: 'Cloudflare · One Client (WARP) changelog', url: 'https://developers.cloudflare.com/changelog/rss/cloudflare-one-client.xml', kind: 'rss', everyHours: 6 },
    { id: 'cloudflare-wrangler', name: 'Cloudflare · Wrangler releases (workers-sdk)', url: 'https://github.com/cloudflare/workers-sdk/releases.atom', kind: 'atom', everyHours: 6, ignoreTitle: '^(?!wrangler@)|-(?:alpha|beta|rc)' },
    { id: 'cloudflare-mcp-servers', name: 'Cloudflare · MCP servers releases', url: 'https://github.com/cloudflare/mcp-server-cloudflare/releases.atom', kind: 'atom', everyHours: 6 },
    { id: 'cloudflare-agents-sdk', name: 'Cloudflare · Agents SDK releases', url: 'https://github.com/cloudflare/agents/releases.atom', kind: 'atom', everyHours: 6, ignoreTitle: '^(?!agents@)|-(?:alpha|beta|rc)' },
    { id: 'cloudflare-sandbox-sdk', name: 'Cloudflare · Sandbox SDK releases', url: 'https://github.com/cloudflare/sandbox-sdk/releases.atom', kind: 'atom', everyHours: 6, ignoreTitle: '-(?:alpha|beta|rc)' },
    { id: 'cloudflare-doc-workers-limits', name: 'Cloudflare docs · Workers limits', url: 'https://developers.cloudflare.com/workers/platform/limits/index.md', kind: 'raw', everyHours: 24 },
    { id: 'cloudflare-doc-workers-pricing', name: 'Cloudflare docs · Workers pricing', url: 'https://developers.cloudflare.com/workers/platform/pricing/index.md', kind: 'raw', everyHours: 24 },
    { id: 'cloudflare-doc-kv-limits', name: 'Cloudflare docs · KV limits', url: 'https://developers.cloudflare.com/kv/platform/limits/index.md', kind: 'raw', everyHours: 24 },
    { id: 'cloudflare-doc-kv-pricing', name: 'Cloudflare docs · KV pricing', url: 'https://developers.cloudflare.com/kv/platform/pricing/index.md', kind: 'raw', everyHours: 24 },
    { id: 'cloudflare-doc-observability-pricing', name: 'Cloudflare docs · Observability pricing', url: 'https://developers.cloudflare.com/observability/pricing/index.md', kind: 'raw', everyHours: 24 },
    { id: 'cloudflare-doc-r2-pricing', name: 'Cloudflare docs · R2 pricing', url: 'https://developers.cloudflare.com/r2/pricing/index.md', kind: 'raw', everyHours: 24 },
    { id: 'cloudflare-doc-email-service-limits', name: 'Cloudflare docs · Email Service limits', url: 'https://developers.cloudflare.com/email-service/platform/limits/index.md', kind: 'raw', everyHours: 24 },
  ],
};
