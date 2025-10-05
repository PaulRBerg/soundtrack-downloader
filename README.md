# YouTube Soundtrack Downloader [![NextJS][next-badge]][next] [![Node.js Version][node-badge]][node-url] [![TypeScript Version][typescript-badge]][typescript-url] [![License: MIT][license-badge]][license-url]

[next]: https://nextjs.org/
[next-badge]: https://img.shields.io/badge/Next-black?style=flat&logo=next.js&logoColor=white
[node-badge]: https://img.shields.io/badge/node-%3E%3D20-green
[node-url]: https://nodejs.org
[typescript-badge]: https://img.shields.io/badge/typescript-5.9-blue
[typescript-url]: https://www.typescriptlang.org/
[license-badge]: https://img.shields.io/badge/License-MIT-orange.svg
[license-url]: https://opensource.org/licenses/MIT

A simple app to download MP3 audio segments from long YouTube videos containing soundtracks.

![Artwork](./artwork.jpg)

## Features

Extract audio segments from YouTube videos with precision:

- **Time-based extraction** - Download specific segments using MM:SS format timestamps
- **320kbps MP3 output** - High-quality audio encoding via FFmpeg
- **Seamless loop optimization** - Optional crossfade for perfect audio loops (50ms fade in/out)
- **Stream processing** - Direct audio streaming without full file downloads
- **Clean, responsive UI** - Dark mode support with Tailwind CSS

Built with modern web technologies:

- **[Next.js v15](https://nextjs.org)** - App Router with React v19 Server Components
- **[TypeScript v5](https://typescriptlang.org)** - Strict type safety with Zod validation
- **[Tailwind CSS v4](https://tailwindcss.com)** - Utility-first styling with design tokens
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - YouTube video download engine
- **[FFmpeg](https://ffmpeg.org)** - Audio processing and format conversion
- **[Bun](https://bun.sh)** - Fast package manager and JavaScript runtime
- **[BiomeJS](https://biomejs.dev)** - Lightning-fast linting and formatting
- **[Just](https://just.systems)** - Command runner for task automation

## Prerequisites

- **[Bun](https://bun.sh)** - Package manager and runtime
- **[Just](https://just.systems)** - Task runner
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - Required for YouTube downloads
- **[FFmpeg](https://ffmpeg.org)** - Required for audio processing

### Installation

```bash
# macOS (recommended)
brew install bun just yt-dlp ffmpeg

# Ubuntu/Debian
curl -fsSL https://bun.sh/install | bash
brew install just  # or use cargo install just
sudo apt-get install yt-dlp ffmpeg

# Windows
# Install Bun: https://bun.sh/docs/installation
# Install Just: https://github.com/casey/just#installation
# Install yt-dlp and FFmpeg: https://github.com/yt-dlp/yt-dlp#installation
```

### Custom Paths

Set environment variables for non-standard installations:

- `YT_DLP_PATH` - Path to yt-dlp binary (default: `/opt/homebrew/bin/yt-dlp` on macOS)
- `FFMPEG_PATH` - Path to ffmpeg binary (default: `/opt/homebrew/bin/ffmpeg` on macOS)

## Getting Started

Install dependencies and start the development server:

```bash
bun install
just dev
```

Open [http://localhost:3000](http://localhost:3000) and:

1. Paste a YouTube video URL
2. Enter start and end times in MM:SS format (e.g., `05:30` to `15:45`)
3. Optionally enable seamless loop optimization for crossfade
4. Click "Download Audio" to process and download the MP3 segment

The app uses yt-dlp to stream audio directly and FFmpeg to extract the segment without downloading the full video.

## How It Works

1. **User Input** - Form validates YouTube URL and time range with Zod schema
2. **Video Info** - yt-dlp fetches video metadata (title, duration) with Android player client for reliability
3. **Audio Stream** - yt-dlp streams best audio format to stdout without disk I/O
4. **FFmpeg Processing** - Extracts segment with optional crossfade (50ms fade in/out for loops)
5. **Download** - Streams processed MP3 directly to browser with sanitized filename

All processing happens server-side using Node.js streams for efficient memory usage.

## Development Commands

Run `just` to see all available commands.

### Core Tasks

| Command      | Description              |
| ------------ | ------------------------ |
| `just dev`   | Start development server |
| `just build` | Build for production     |
| `just start` | Start production server  |
| `just clean` | Clean build artifacts    |

### Code Quality

| Command           | Description                            |
| ----------------- | -------------------------------------- |
| `just full-check` | Lint, format check, type check         |
| `just full-write` | Auto-fix linting and formatting issues |
| `just tsc-check`  | TypeScript validation only             |

## Project Structure

```tree
├── app/
│   ├── api/
│   │   └── download/
│   │       └── route.ts           # Audio download API endpoint
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx         # Reusable button component
│   ├── favicon.ico
│   ├── globals.css                # Global styles with Tailwind
│   ├── layout.tsx                 # Root layout with dark mode support
│   └── page.tsx                   # Main download form UI
├── public/                        # Static assets
├── biome.jsonc                    # Biome linter/formatter config
├── justfile                       # Task automation scripts
├── knip.jsonc                     # Dead code detection config
├── next.config.js                 # Next.js configuration
├── package.json                   # Dependencies and scripts
├── postcss.config.js              # Tailwind CSS processing
└── tsconfig.json                  # TypeScript strict mode config
```

## Technical Details

### Audio Processing

- **Format**: MP3 with 320kbps encoding (libmp3lame)
- **Loop Optimization**: 50ms crossfade using FFmpeg's `afade` filter
- **Streaming**: Direct yt-dlp stdout → FFmpeg → PassThrough stream → Web ReadableStream
- **No Disk I/O**: All processing happens in memory for speed and efficiency

### API Endpoint

`POST /api/download`

**Request:**

```json
{
  "url": "https://youtube.com/watch?v=...",
  "startTime": 330,
  "endTime": 945,
  "optimizeLoop": true
}
```

**Response:** Streaming MP3 file with `Content-Disposition` header

### Error Handling

- Validates YouTube URL format and time ranges with Zod
- Checks segment duration against video length
- Gracefully kills processes on stream cancellation
- Returns detailed error messages for debugging

## Deployment

**Note:** This app requires yt-dlp and FFmpeg on the server. Vercel and most serverless platforms don't support these
binaries by default.

Consider:

- **VPS/Cloud VM** - AWS EC2, DigitalOcean Droplets, Hetzner
- **Platform-as-a-Service** - Railway, Fly.io, Render (with custom Dockerfile)
- **Containerized** - Docker with yt-dlp and FFmpeg included

## License

This project is licensed under MIT.
