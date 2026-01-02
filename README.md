# glance-cli

**AI-powered web reader for your terminal** – Fetch any webpage, extract clean content, and get instant AI summaries.

- **100% FREE by default** – Uses local Ollama (no API keys needed!)
- **Privacy-first** – Your data stays on your machine
- **Lightning fast** – Built with Bun and TypeScript
- **Production-ready** – Smart caching, error handling, and retry logic

Turn any webpage into terminal-friendly insights — no browser needed.

[![npm version](https://badge.fury.io/js/glance-cli.svg)](https://www.npmjs.com/package/glance-cli)
[![Downloads](https://img.shields.io/npm/dm/glance-cli.svg)](https://www.npmjs.com/package/glance-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Quick Start

```bash
# Install with Bun (preferred - faster!)
bun install -g glance-cli

# Or with npm
npm install -g glance-cli

# Use immediately (works without setup!)
glance https://example.com
```

**For 100% free local AI:**
```bash
# One-time setup (~4GB download)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# Now completely free forever
glance https://nextjs.org/docs --tldr
```

---

## 🎯 Why Glance?

| Feature | Glance + Ollama | Traditional AI Tools |
|---------|-----------------|---------------------|
| **Cost** | $0 forever | $20-100/month |
| **Privacy** | 100% local | Cloud-based |
| **Speed** | 2-3 seconds | 10-30 seconds |
| **Setup** | 2 minutes | Instant (with $$) |

Perfect for developers who want fast, private, and free AI summarization in their terminal.

---

## 📖 Basic Usage

### Summary Modes
```bash
# Quick summary
glance https://nextjs.org/docs

# One-sentence TL;DR
glance https://techcrunch.com/article --tldr

# Bullet point key insights
glance https://blog.example.com --key-points

# Simple explanation
glance https://complex-topic.com --eli5

# Ask specific questions
glance https://nextjs.org/docs --ask "What's the App Router?"
```

### AI Models

**Free Local AI (Recommended):**
```bash
glance https://example.com --model llama3
# Popular models: llama3, mistral, phi3, gemma2
# List available: glance --list-models
```

**Optional Cloud AI:**
```bash
# OpenAI (requires API key)
export OPENAI_API_KEY=sk-...
glance https://example.com --model gpt-4o-mini

# Google Gemini (requires API key)
export GEMINI_API_KEY=...
glance https://example.com --model gemini-2.0-flash-exp
```

**Smart Detection:**
```bash
# See what services you have
glance --check-services

# Force free-only
glance https://example.com --free-only

# Prefer quality (use paid if available)
glance https://example.com --prefer-quality
```

### Output Options
```bash
# Export to Markdown
glance https://nextjs.org/docs --export notes.md

# Export to JSON
glance https://api-docs.com --json -o data.json

# Save as audio (text-to-speech)
glance https://article.com --audio-output summary.mp3

# Read aloud immediately
glance https://blog.com --read
```

### Advanced Features
```bash
# Screenshot + summary
glance https://example.com --screenshot page.png --tldr

# JavaScript-heavy sites (SPAs)
glance https://react-app.com --full-render

# Multiple languages
glance https://lemonde.fr --tldr -l fr  # French
glance https://elpais.com -k -l es      # Spanish

# Streaming output
glance https://long-article.com --stream
```

---

## 🎨 Output Formats

```bash
# Terminal (default) - colorful, emoji-rich
glance https://example.com

# Markdown
glance https://example.com -o article.md

# JSON (for scripting)
glance https://example.com -o data.json

# HTML (embeddable)
glance https://example.com --format html -o page.html

# Plain text (pipeable)
glance https://example.com --format plain | grep "keyword"
```

---

## 💾 Smart Caching

Glance automatically caches results to save time and API costs:

```bash
# First request: ~3 seconds
glance https://example.com

# Cached request: ~0.1 seconds
glance https://example.com

# View cache stats
glance --cache-stats

# Clear cache
glance --clear-cache
```

**Cache features:**
- 24-hour TTL (configurable)
- 70% compression
- LRU eviction (100MB max)
- Hit rate tracking

---

## 🛠️ Common Use Cases

### 1. Quick Documentation Lookup
```bash
glance https://nextjs.org/docs --ask "How do I use Server Actions?"
```

### 2. Morning News Briefing
```bash
glance https://news.ycombinator.com --tldr --read
```

### 3. Research & Note-Taking
```bash
glance https://research-paper.com --key-points --export notes.md
```

### 4. Batch Processing
```bash
cat urls.txt | while read url; do
  glance "$url" --tldr >> daily-summary.md
done
```

### 5. API Documentation
```bash
glance https://api-docs.com --ask "How do I authenticate?" --format plain
```

---

## 📚 All Options

```bash
# Summary modes
glance <url>                  # Standard summary
glance <url> --tldr           # One sentence
glance <url> --key-points     # Bullet points
glance <url> --eli5           # Simple explanation
glance <url> --ask "question" # Custom Q&A

# AI models
--model <name>                # llama3, gpt-4o-mini, gemini-2.0-flash-exp
--list-models                 # Show available Ollama models
--check-services              # Show available AI/voice services
--free-only                   # Never use paid APIs
--prefer-quality              # Use premium services when available

# Output
-o, --export <file>           # Save to file (auto-detects format)
--markdown                    # Markdown format
--json                        # JSON format
--format <type>               # terminal, markdown, json, html, plain
--stream                      # Live streaming output

# Voice/Audio
--read, --speak               # Read aloud (text-to-speech)
--audio-output <file>         # Save as MP3
--voice <name>                # Choose voice (alloy, echo, nova, etc.)
--list-voices                 # Show available voices

# Advanced
--screenshot <file>           # Capture screenshot
--full-render                 # Render JavaScript (for SPAs)
--metadata                    # Show page metadata
--links                       # Extract all links
--tables                      # Extract tables
-l, --language <code>         # Output language (en, fr, es, ht)
-e, --emoji                   # Add emojis

# Cache
--cache-stats                 # Show cache statistics
--cache-cleanup               # Remove expired entries
--clear-cache                 # Clear all cache
--no-cache                    # Skip cache for this request

# Other
-v, --verbose                 # Show detailed logs
-h, --help                    # Show help
-V, --version                 # Show version
```

---

## 🔧 Configuration

### Environment Variables

```bash
# AI Providers (optional)
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...

# Voice (optional)
export ELEVENLABS_API_KEY=...

# Ollama (optional, auto-detected)
export OLLAMA_ENDPOINT=http://localhost:11434

# Cache (optional)
export GLANCE_CACHE_DIR=~/.glance/cache
export GLANCE_CACHE_TTL=86400000  # 24h in ms
```

---

## 🚀 Examples

### Learning & Research
```bash
# Understand a new framework
glance https://nextjs.org/docs --eli5

# Quick reference
glance https://nextjs.org/docs --key-points --export nextjs-notes.md

# Specific questions
glance https://nextjs.org/docs --ask "What's the difference between pages and app router?"
```

### Daily Workflow
```bash
# Morning news
glance https://news.ycombinator.com --tldr --read

# Documentation lookup
glance https://nextjs.org/docs/app/api-reference/functions/fetch --ask "How do I revalidate?"

# Code examples
glance https://tutorial.com --format plain | grep -A 10 "example"
```

### Content Creation
```bash
# Extract for blog post
glance https://source-article.com --key-points --export research.md

# Multilingual content
glance https://lemonde.fr --tldr -l fr --export french-news.md
```

---

## 🎓 Pro Tips

**1. Use local AI for daily tasks:**
```bash
glance https://example.com --model llama3  # Free, fast, private
```

**2. Cache speeds up repeated requests:**
```bash
glance https://docs.com  # First: 3s
glance https://docs.com  # Cached: 0.1s
```

**3. Pipe output for scripting:**
```bash
glance https://example.com --format plain | grep "keyword" | wc -l
```

**4. Save audio for commute:**
```bash
glance https://article.com --tldr --audio-output commute.mp3
```

**5. Use streaming for long content:**
```bash
glance https://long-article.com --stream
```

---

## 🤝 Contributing

Contributions welcome! Check out our [Contributing Guide](CONTRIBUTING.md).

```bash
git clone https://github.com/jkenley/glance-cli.git
cd glance-cli
bun install
bun dev https://example.com
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **GitHub**: [github.com/jkenley/glance-cli](https://github.com/jkenley/glance-cli)
- **NPM**: [npmjs.com/package/glance-cli](https://www.npmjs.com/package/glance-cli)
- **Issues**: [github.com/jkenley/glance-cli/issues](https://github.com/jkenley/glance-cli/issues)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

**Built with ❤️ by [Kenley Jean](https://github.com/jkenley)**

*Star ⭐ the repo if you find it useful!*