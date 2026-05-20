# Conquest

Chess, but your moves have consequences on a world map.

You start with one country. To expand, beat Stockfish. To take someone else's territory, challenge them to a game — winner takes the land. The map is the leaderboard. Biggest kingdom, strongest player. One look and you know who's winning.

The thing that separates this from every chess app: you can lose ground while you're offline. Someone challenges your territory while you sleep, and you wake up to a notification. Now you have to log in — not to practice, not to improve your rating, but because your kingdom is at stake. That's a different kind of motivation. Chess.com doesn't have it.

## What's built

- Full chess rules via chess.js + Stockfish 18 (depth 10) running in a Web Worker
- World map with real ownership — every country colored by who controls it, updated live via Supabase Realtime
- Territory logic: neutral countries are claimable, enemy countries adjacent to yours are attackable, everything else is out of reach until you expand
- Auth (email + password), player profiles, dynasty page with campaign history
- "Upgrade to Pro" in the nav — signals the monetization path (custom territory themes, priority matchmaking)

## Why this is a Level 4 submission

The assignment asks for something that could be a real service. Conquest is the only chess concept where losing a game has a consequence inside the product that isn't your ELO. The territory mechanic creates the anxiety loop that keeps people coming back — same mechanic that made Clash of Clans work. Rage at losing your best territory is the acquisition channel. Every loss makes you want to recruit allies.

The hex-grid version ships in 12 hours. The real vision: real city maps, real neighborhoods, you physically move to claim districts. Chess determines who controls each block. That's the pitch beyond the hackathon.

## Stack

Next.js 16, Supabase (auth + DB + Realtime), chess.js, react-chessboard, Stockfish 18 WASM, react-svg-worldmap, Vercel

## Live

https://conquest-game.vercel.app
