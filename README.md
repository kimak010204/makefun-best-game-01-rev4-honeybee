# makefun-best-game-01-rev4-honeybee

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/kimak010204/makefun-best-game-01-rev4-honeybee/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/kimak010204/makefun-best-game-01-rev4-honeybee/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

🐝 **HONEYBEE — Fill the Hive Before Sunset.** A complete, original 2D arcade game for the make.fun best-game-01 bounty. You are a little bee in a sunny meadow: visit flowers to gather pollen, carry it home to the hive, and fill the honey jar to 100% before the sun sets.

**How to play:** WASD / arrow keys fly — or hold the mouse button and the bee follows your cursor. Land on flowers to gather pollen (your pouch holds 6 — the heavier it gets, the slower you fly). Fly home to the hive to turn pollen into honey. Dodge wasps (chasers, patrollers, ambushers) and spider webs — three stings and you fall. At 75% honey the Hornet Queen storms in — dodge her telegraphed dives to drive her off. 1 / 2 / 3 difficulty on the title screen, P pause, M mute, R restart.

**Depth:** six flower kinds, each worth different pollen and regrowing on its own clock (Daisy 1, Tulip 2, Lavender 2, Sunflower 3, Clover 1 — and the rare glowing Golden Bloom 5). Combo system up to x5, power-ups (Swift Nectar, Honey Shield, Pollen Magnet), a Hornet Queen boss fight with health bar, dive telegraphs and wasp summons, and a living sky that ripens from morning blue into orange and purple sunset. Animated wings, banking turns, pollen trails, floating score popups, screen shake, confetti on victory, and a fully synthesised WebAudio soundtrack — no audio files.

**Win / lose:** win when honey reaches 100% (score plus a time bonus for every second left); lose on three stings, or when the sun sets first.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome with no network request. The four shots in `screenshots/` are real renders of the game's own code, driven deterministically by `?shot=start|play|win|lose&seed=N` (see `shots.json`).

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t87hzjc5&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
