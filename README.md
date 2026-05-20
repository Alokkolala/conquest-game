# Conquest

Chess, but your moves have consequences on a world map.

You start with one country. To expand, beat Stockfish. To take someone else's territory, challenge them to a game — winner takes the land. The map is the leaderboard. Biggest kingdom, strongest player. One look and you know who's winning.

The thing that separates this from every chess app: you can lose ground while you're offline. Someone challenges your territory while you sleep, and you wake up to a notification. Now you have to log in — not to practice, not to improve your rating, but because your kingdom is at stake. That's a different kind of motivation. Chess.com doesn't have it.

## Why it grows

Player A beats Player B and takes their best territory. Player B is furious. They screenshot their collapsed kingdom and post it to their chess Telegram group: "Someone just destroyed my kingdom, I need allies." Three friends download the app to help them fight back. Rage is the best acquisition channel. Every loss is a recruitment event.

The map itself is shareable content. Peak kingdom screenshot — "I built this over 3 weeks" — is exactly the kind of thing people post. The world map showing all kingdoms is a living piece of content that changes daily and is always worth screenshotting.

## Why it makes money

Territory creates status. Status is what people pay for. The Pro upgrade path is already in the app: custom territory themes, piece skins, priority matchmaking. Seasonal resets — every 30 days the map wipes, rankings preserved — mean players buy cosmetics before each new season to establish presence from day one. That's a recurring revenue cycle built into the core loop, not bolted on.

## What's built

- Full chess rules via chess.js + Stockfish 18 (depth 10) running in a Web Worker
- World map with real ownership — every country colored by who controls it, updated live via Supabase Realtime
- Territory logic: neutral countries are claimable, enemy countries adjacent to yours are attackable, everything else is out of reach until you expand
- Auth (email + password), player profiles, dynasty page with campaign history
- "Upgrade to Pro" in the nav

## Stack

Next.js 16, Supabase (auth + DB + Realtime), chess.js, react-chessboard, Stockfish 18 WASM, react-svg-worldmap, Vercel

## Live

https://conquest-game.vercel.app
