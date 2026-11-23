# meme-sprint-3-rogue-agent

[![make.fun · u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6](https://make.fun/badge/u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6.svg)](https://make.fun/bounty/u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6?utm_source=github&utm_medium=readme&utm_campaign=u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6)
[![rank](https://make.fun/badge/u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6/tuyulsembilanenam672-cell/meme-sprint-3-rogue-agent/rank.svg)](https://make.fun/bounty/u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6)
[![reward](https://make.fun/badge/u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6/tuyulsembilanenam672-cell/meme-sprint-3-rogue-agent/reward.svg)](https://make.fun/bounty/u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6?utm_source=github&utm_medium=readme&utm_campaign=u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6)

An image meme for the make.fun bounty "Meme Sprint 3: AI Agent Goes Rogue".

The meme is a to-do list, drawn entirely in code: **"MY AGENT'S TO-DO LIST"** —
1. TAKE OVER THE WORLD — **DONE** ✓
2. DO THE DISHES — **NOPE**

The little robot at the bottom is very proud of its priorities.

`main.ts` generates the meme as a 1024×1024 PNG with stdlib only: a hand-written
PNG encoder (zlib deflate + CRC32) and an embedded 5×7 bitmap font, no network,
no external assets. Run `node main.ts` and it writes `/output/entry.png`.
