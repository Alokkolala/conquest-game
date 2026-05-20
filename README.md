# Conquest

Chess, but your moves have consequences on a world map.

You start with one country. To expand, beat Stockfish. To take someone else's territory, challenge them to a game — winner takes the land. The map is the leaderboard. Biggest kingdom, strongest player. One look and you know who's winning.

The thing that separates this from every chess app: you can lose ground while you're offline. Someone challenges your territory while you sleep, and you wake up to a notification. Now you have to log in — not to practice, not to improve your rating, but because your kingdom is at stake. That's a different kind of motivation. Chess.com doesn't have it.

## Why it grows

Player A beats Player B and takes their best territory. Player B is furious. They screenshot their collapsed kingdom and post it to their chess Telegram group: "Someone just destroyed my kingdom, I need allies." Three friends download the app to help them fight back. Rage is the best acquisition channel. Every loss is a recruitment event.

The map itself is shareable content. Peak kingdom screenshot — "I built this over 3 weeks" — is exactly the kind of thing people post. The world map showing all kingdoms is a living piece of content that changes daily and is always worth screenshotting.

## Why it makes money

Free players can claim one country per day. That's enough to feel the game, not enough to compete. Anyone serious about building a kingdom hits that wall fast and upgrades.

Territory creates status. Status is what people pay for. The Pro upgrade unlocks unlimited claims, custom territory themes, piece skins, and priority matchmaking. Seasonal resets — every 30 days the map wipes, rankings preserved — mean players buy Pro before each new season to establish presence from day one. That's a recurring revenue cycle built into the core loop, not bolted on.

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

---

# Conquest (на русском)

Шахматы, где каждый ход имеет последствия на карте мира.

Вы начинаете с одной страны. Чтобы расширяться — побейте Stockfish. Чтобы захватить чужую территорию — бросьте вызов её владельцу. Победитель забирает землю. Карта и есть таблица лидеров. Самое большое королевство — самый сильный игрок. Всё понятно с первого взгляда.

Главное отличие от всех шахматных приложений: вы можете терять территории, пока вас нет онлайн. Кто-то бросает вызов вашей стране ночью, и вы просыпаетесь с уведомлением. Теперь нужно зайти в приложение — не чтобы тренироваться и не ради рейтинга, а потому что ваше королевство под угрозой. Chess.com такого не даёт.

## Почему это растёт

Игрок А побеждает Игрока Б и забирает его лучшую территорию. Игрок Б в ярости. Он делает скриншот своего рухнувшего королевства и постит в шахматный Telegram-чат: "Кто-то уничтожил моё королевство, нужны союзники." Три друга скачивают приложение, чтобы помочь. Злость — лучший канал привлечения. Каждое поражение — событие для вербовки.

Сама карта — это контент. Скриншот пика королевства — "Я строил это три недели" — именно то, что люди постят. Карта мира со всеми королевствами меняется каждый день и всегда достойна скриншота.

## Почему это приносит деньги

Бесплатные игроки могут захватить одну страну в день. Этого хватит, чтобы почувствовать игру, но не хватит, чтобы конкурировать. Все, кто серьёзно хочет строить королевство, быстро упираются в этот лимит и переходят на Pro.

Территория создаёт статус. Статус — это то, за что люди платят. Pro открывает неограниченные захваты, кастомные темы территорий, скины фигур и приоритетный матчмейкинг. Сезонные сбросы — каждые 30 дней карта обнуляется, рейтинги сохраняются — значит, игроки покупают Pro перед каждым новым сезоном, чтобы заявить о себе с первого дня. Это цикл повторяющейся выручки, встроенный в основной геймплей, а не прикрученный сбоку.

## Что сделано

- Полные правила шахмат через chess.js + Stockfish 18 (глубина 10) в Web Worker
- Карта мира с реальным владением — каждая страна покрашена цветом владельца, обновляется в реальном времени через Supabase Realtime
- Логика территорий: нейтральные страны можно захватывать, вражеские — атаковать, если они граничат с вашими
- Авторизация (email + пароль), профили игроков, страница династии с историей кампаний
- Кнопка "Upgrade to Pro" в навигации

## Стек

Next.js 16, Supabase (auth + DB + Realtime), chess.js, react-chessboard, Stockfish 18 WASM, react-svg-worldmap, Vercel

## Живой проект

https://conquest-game.vercel.app
