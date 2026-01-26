# Open Source Rhythm Game | StepFever - Play StepMania & DDR Charts in Your Browser

[![CI](https://github.com/religa/stepfever/actions/workflows/ci.yml/badge.svg)](https://github.com/religa/stepfever/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2+-black.svg)](https://bun.sh/)

<!--
Meta Description:
StepFever is a free, open-source rhythm game for web browsers. Play DDR and StepMania charts with keyboard, dance pad, or gamepad. Local multiplayer, theming, and more. No installation required.
-->

<video
  src="https://github.com/user-attachments/assets/73b86bd4-ac32-45ea-91ab-1dd0e61cc244"
  autoplay
  loop
  muted
  playsinline
  width="640">
</video>

<!-- TODO: Add gameplay GIF - critical for engagement -->
<!-- ![StepFever gameplay - browser-based open source rhythm game](docs/images/gameplay.gif) -->

**StepFever** is a **free, open-source rhythm game** that runs entirely in your web browser. Play **StepMania** and **DDR-style** charts (.sm, .ssc) with your keyboard, USB dance pad, or gamepad. No installation required—just open and play!

Perfect for fans of **Dance Dance Revolution (DDR)**, **StepMania**, **In The Groove (ITG)**, and **Etterna** looking for a modern, browser-based alternative.

## Why Choose StepFever?

- **Play Instantly** - No download, runs in Chrome, Firefox, Safari, or Edge
- **StepMania Compatible** - Load your existing .sm/.ssc song library
- **Dance Pad Support** - Connect your USB dance pad and play like arcade DDR
- **Local Multiplayer** - 2-4 players compete on one screen
- **Local-First** - All data stays on your device, works offline
- **100% Free & Open Source** - MIT licensed, no ads, no tracking

## Quick Start

```bash
# Install Bun runtime
curl -fsSL https://bun.sh/install | bash

# Clone and run
git clone https://github.com/religa/stepfever && cd stepfever
bun install && bun dev
```

Open **http://localhost:5173** and start playing!

### Adding Songs

StepFever plays standard StepMania song packs. Download songs from:
- [StepMania Online](https://search.stepmaniaonline.net/) - Song search engine
- [Zenius-I-vanisher](https://zenius-i-vanisher.com/v5.2/simfiles.php) - Simfile database
- [r/Stepmania Wiki](https://www.reddit.com/r/Stepmania/wiki/packs) - Community packs

Extract song folders into `charts/` and restart the dev server:

```
charts/
└── my-song/
    ├── my-song.sm    # Chart file (.sm or .ssc)
    └── my-song.ogg   # Audio (.ogg, .mp3)
```

## How to Play StepFever

### Keyboard Controls for Rhythm Gaming

| Direction | Arrow Keys | WASD | Numpad |
|-----------|------------|------|--------|
| Left | ← | A | 4 |
| Down | ↓ | S | 2 |
| Up | ↑ | W | 8 |
| Right | → | D | 6 |

### Dance Pad & Gamepad Setup

StepFever supports USB dance pads and game controllers:

1. Connect your dance pad or gamepad
2. Go to **Settings → Controller**
3. Use **Learn Mode** to auto-detect button mappings
4. Start playing!

### Gameplay Basics

1. Select a song from the menu
2. Choose a difficulty (Beginner → Expert)
3. Press keys when arrows reach the receptor line
4. Better timing = higher score!

## Scoring System

### Timing Windows

| Judgment | Window | Score |
|----------|--------|-------|
| Marvelous | ±22.5ms | 100% |
| Perfect | ±45ms | 100% |
| Great | ±90ms | 67% |
| Good | ±135ms | 33% |
| Boo/Miss | >135ms | 0% |

### Grade Rankings

| Grade | Accuracy |
|-------|----------|
| AAA | 99%+ |
| AA | 95%+ |
| A | 90%+ |
| B | 80%+ |
| C | 70%+ |
| D | 60%+ |

## Features

### Single Player Mode
- **Speed Modifiers** - X-Mod (0.5x-3x) and C-Mod (constant scroll speed)
- **Audio Calibration** - Sync offset adjustment for your setup
- **AutoPlay Mode** - Watch perfect play for learning charts
- **Offline Support** - Play without internet connection

### Local Multiplayer Mode
- **2-4 Players** - Split-screen competitive rhythm battles
- **Mixed Input** - Keyboard + dance pad players together
- **Versus Scoring** - Accuracy-based rankings and winner announcement

### Customization Options
- **Noteskin Themes** - Multiple visual styles
- **Stage Backgrounds** - Customizable backgrounds
- **Per-Song Settings** - Individual audio offset per song

## Audio Calibration Guide

If notes feel early or late:

1. Go to **Settings → Calibrate**
2. Tap any key on each beat (10 times)
3. Offset is automatically calculated and saved

## Technical Stack

Built with modern web technologies (local-first, no server required):

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh/) 1.2+ |
| Graphics | [PixiJS](https://pixijs.com/) 8.x (WebGL) |
| Audio | [Tone.js](https://tonejs.github.io/) 15.x |
| State | [Zustand](https://github.com/pmndrs/zustand) 5.x (localStorage persist) |

**Browser Support**: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+

## Development

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for:

- Development environment setup
- Architecture and codebase overview
- Contributing guidelines

## Related Rhythm Game Projects

- [StepMania](https://www.stepmania.com/) - The original open-source dance game
- [Etterna](https://etternaonline.com/) - Keyboard-focused StepMania fork
- [NotITG](https://www.notiitg.com/) - Modding-focused StepMania fork

## License

[MIT License](LICENSE)

## Links

- [Report Bug / Request Feature](https://github.com/religa/stepfever/issues)
- [Development Guide](docs/DEVELOPMENT.md)
