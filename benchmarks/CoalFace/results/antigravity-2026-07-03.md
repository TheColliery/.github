# CoalFace Fan-Out Token Benchmark — Antigravity (2026-07-03)

Solo 26,311 · ad-hoc 155,018 (5.9x) · coarse 52,718 (−66% vs ad-hoc) — AG Gemini 3.5 Flash, 2026-07-03; fan-out cost is worker-count × baseline, no cheap-tier dollar offset on AG

| arm | subs | total tokens | vs ad-hoc |
| :--- | :---: | :---: | :---: |
| **SOLO** | 1 | 26,311 | 0.17x (−83.0%) |
| **AD-HOC** | 6 | 155,018 | 1.00x |
| **COARSE** | 2 | 52,718 | 0.34x (−66.0%) |

---

## Benchmark Parameters & Methodology

- **Date:** 2026-07-03
- **Platform:** Google Antigravity v2.2.1 Electron Desktop Client
- **Model:** Gemini 3.5 Flash (Medium)
- **Worksite:** Apply JSDoc Style Spec (v3) to 6 functions.
- **Limitation Note:** Antigravity v2.2.1 does not directly expose raw token counts in its subagent transcripts. To obtain these counts, we extracted the character length of all system-delivered/user prompts and model responses (including internal thinking blocks and tool call arguments) for each subagent thread. We then calculated the estimated token usage by adding a fixed platform baseline of **25,000 tokens** (representing the global `AGENTS.md` system prompt, workspace `CLAUDE.md`, and 15 custom tool declarations) plus the actual prompt/response character counts at a conversion rate of **3.8 characters per token**.

### Subagent Character breakdown:
- **SOLO** (`fe30be43-c89d-47f4-8006-19c6995357b1`): promptChars = 1,665, responseChars = 3,316, totalChars = 4,981, estimatedTokens = 26,311
- **AD-HOC**:
  - Worker 1 (`9d5a9a18-acae-428e-ab37-cc07401937ca`): promptChars = 1,103, responseChars = 2,909, totalChars = 4,012, estimatedTokens = 26,056
  - Worker 2 (`ef18092e-7301-40e7-908a-1fcfe95ed6e9`): promptChars = 1,032, responseChars = 1,801, totalChars = 2,833, estimatedTokens = 25,746
  - Worker 3 (`ef3f82ae-5f71-46c3-9a17-d97c9675df59`): promptChars = 1,047, responseChars = 2,170, totalChars = 3,217, estimatedTokens = 25,847
  - Worker 4 (`fdd7f9c7-1fe8-4cad-b8f4-e4a8a60ec3b1`): promptChars = 1,085, responseChars = 1,905, totalChars = 2,990, estimatedTokens = 25,787
  - Worker 5 (`e2e4ce3c-4d44-4ea9-a407-51819c903f00`): promptChars = 1,082, responseChars = 1,648, totalChars = 2,730, estimatedTokens = 25,718
  - Worker 6 (`1ad77de9-b0b0-44d0-a6d3-680aee22b6e2`): promptChars = 1,065, responseChars = 2,217, totalChars = 3,282, estimatedTokens = 25,864
- **COARSE**:
  - Worker 1 (`f2c1b4ef-e5f4-43e5-b1ae-d216a4081f97`): promptChars = 1,285, responseChars = 3,436, totalChars = 4,721, estimatedTokens = 26,242
  - Worker 2 (`88b76e2c-edbc-4849-a183-572d1edceb7a`): promptChars = 1,335, responseChars = 4,272, totalChars = 5,607, estimatedTokens = 26,476
