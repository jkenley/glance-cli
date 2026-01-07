# glance-cli

**AI-powered web reader for your terminal** – Fetch any webpage, extract clean content, get instant AI summaries, and listen with natural voice synthesis.

[![npm version](https://badge.fury.io/js/glance-cli.svg)](https://www.npmjs.com/package/glance-cli)
[![Downloads](https://img.shields.io/npm/dm/glance-cli.svg)](https://www.npmjs.com/package/glance-cli)
[![Tests](https://github.com/jkenley/glance-cli/actions/workflows/test.yml/badge.svg)](https://github.com/jkenley/glance-cli/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why glance-cli?

- ✅ **100% FREE** – Uses local Ollama (no API keys needed)
- 🌍 **Auto language detection** – English, French, Spanish, Haitian Creole
- 🔒 **Privacy first** – Your browsing history stays local
- 🎤 **Voice-enabled** – Read articles aloud with multilingual support
- 💾 **Multiple formats** – Save as markdown, JSON, or plain text
- ⚡ **Lightning fast** – Built with Bun and TypeScript

---

## Quick Start
```bash
# Install
npm install -g glance-cli

# Use immediately
glance https://news.com                    # Get AI summary
glance https://news.com --read             # Read aloud
glance https://news.com --browse           # Interactive navigation
```

**For 100% free local AI:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3
glance https://techcrunch.com --tldr --read
```

---

## Core Features

### 🌐 Interactive Browse Mode
Navigate websites interactively with AI summaries on demand.
```bash
glance https://news.ycombinator.com --browse

# Inside browse mode:
1                    # Navigate to link 1
3 --tldr            # Navigate + get summary
5 --read            # Navigate + read aloud
1 --output file.md  # Navigate + save to file
n                   # Show navigation links
e                   # Show external links
b                   # Go back
q                   # Quit
```

### 📝 Read & Summarize
Extract content with AI summaries in multiple styles.
```bash
glance <url>              # AI summary (default)
glance <url> --tldr       # One sentence
glance <url> --key-points # Bullet points
glance <url> --eli5       # Simple explanation
glance <url> --full       # Full content (no summary)
glance <url> --copy       # Copy to clipboard
```

### 🎤 Voice & Audio
Listen to articles with natural voice synthesis.
```bash
glance <url> --read                    # Read aloud (auto-detects language)
glance <url> --audio-output audio.mp3  # Save as MP3
glance <url> --voice nova --read       # Choose specific voice
glance <url> -l fr --read              # French voice

glance --list-voices                   # See available voices
```

**Voice Options:**
- **Free**: System TTS (macOS/Windows/Linux)
- **Premium**: ElevenLabs (natural voices, requires API key)

### 💾 Save & Export
Save content in multiple formats.
```bash
glance <url> --output summary.md       # Save as markdown
glance <url> --output data.json        # Save as JSON
glance <url> --format plain -o file    # Save as plain text
```

### 🌍 Auto Language Detection
Automatically detects and adapts to content language.
```bash
glance https://lemonde.fr --tldr       # Auto-detects French
glance https://news.es --read          # Auto-detects Spanish + voice
glance <url> -l es --read              # Override to Spanish
```

Supported: English, French, Spanish, Haitian Creole

---

## Common Use Cases
```bash
# Morning news with audio
glance https://news.ycombinator.com --tldr --read

# Quick copy for sharing
glance https://article.com --tldr --copy

# Interactive research
glance https://en.wikipedia.org/wiki/AI --browse

# Study while coding
glance https://tutorial.com --full --read

# Save documentation
glance https://docs.python.org --output guide.md

# Multilingual content
glance https://lemonde.fr --read        # Auto-detects French voice
```

---

## AI Models

**Local (Free)** – via Ollama:
- `llama3:latest` – Fast, reliable (recommended)
- `gemma3:4b` – Lightweight, efficient
- `mistral:7b` – Excellent quality
- `deepseek-r1:latest` – Strong reasoning

**Cloud (Optional)** – requires API keys:
- `gpt-4o-mini` – OpenAI
- `gemini-2.0-flash-exp` – Google Gemini
```bash
glance <url> --model llama3            # Use specific model
glance --list-models                   # Show available models
glance <url> --free-only               # Never use paid APIs
```

---

## Configuration
```bash
# AI Providers (optional)
export OPENAI_API_KEY=...
export GEMINI_API_KEY=...

# Voice (optional, for premium voices)
export ELEVENLABS_API_KEY=...

# Ollama (optional, auto-detected)
export OLLAMA_ENDPOINT=http://localhost:11434
```

---

## All Options
```bash
# Content
--browse                 # Interactive navigation
--tldr                   # One sentence summary
--key-points, -k         # Bullet points
--eli5                   # Simple explanation
--full                   # Full content
--ask "question"         # Custom Q&A

# Voice & Audio
--read, -r               # Read aloud
--audio-output <file>    # Save as MP3
--voice <name>           # Choose voice
--list-voices            # Show available voices
-l, --language <code>    # Output language (en, fr, es, ht)

# AI Models
--model <name>           # Choose AI model
--list-models            # Show local models
--free-only              # Never use paid APIs

# Output
--format <type>          # Format: md, json, plain
--output, -o <file>      # Save to file
--copy, -c               # Copy to clipboard
--stream                 # Live streaming output

# Advanced
--screenshot <file>      # Capture screenshot
--full-render            # Render JavaScript
--metadata               # Show page metadata
--links                  # Extract all links
-v, --verbose            # Detailed logs
```

---

## Contributing

Contributions welcome! Check out our [Contributing Guide](CONTRIBUTING.md).
```bash
git clone https://github.com/jkenley/glance-cli.git
cd glance-cli
bun install
bun dev https://example.com
```

---

## Support

If you find glance-cli useful, consider [buying me a coffee](https://ko-fi.com/jkenley) ☕

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jkenley)

---

## Links

- **GitHub**: [github.com/jkenley/glance-cli](https://github.com/jkenley/glance-cli)
- **NPM**: [npmjs.com/package/glance-cli](https://www.npmjs.com/package/glance-cli)
- **Issues**: [github.com/jkenley/glance-cli/issues](https://github.com/jkenley/glance-cli/issues)

---

**Built with ❤️ by [Kenley Jean](https://github.com/jkenley)** • MIT License

*Star ⭐ the repo if you find it useful!*