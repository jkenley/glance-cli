# glance-cli

**AI-powered web reader for your terminal** – Fetch any webpage, extract clean content, get instant AI summaries, and listen with natural voice synthesis.

- **100% FREE by default** – Uses local Ollama (no API keys needed!)
- **Auto language detection** – Detects English, French, Spanish, Haitian Creole
- **No tracking** – Your browsing history stays private
- **Voice-enabled** – Read articles aloud with multilingual support
- **File output** – Save summaries as markdown, JSON, or plain text
- **Lightning fast** – Built with Bun and TypeScript

Turn any webpage into terminal-friendly insights with AI summaries or full content, read it, listen to it, or export it.

[![npm version](https://badge.fury.io/js/glance-cli.svg)](https://www.npmjs.com/package/glance-cli)
[![Downloads](https://img.shields.io/npm/dm/glance-cli.svg)](https://www.npmjs.com/package/glance-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ⚡ Quick Start

```bash
# Install
bun install -g glance-cli  # Or: npm install -g glance-cli

# Use immediately
glance https://www.ayiti.ai                     # AI summary
glance https://www.ayiti.ai/fr --read           # Auto-detects French + voice  
glance https://news.com --output summary.md     # Save as markdown
```

**For 100% free local AI:**
```bash
# One-time setup (~4GB)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# Now completely free forever
glance https://techcrunch.com --tldr --read
```

---

## 🎯 Core Features

### 📝 **Content Modes**
```bash
glance <url>                  # AI summary (default)
glance <url> --tldr           # One sentence
glance <url> --key-points     # Bullet points
glance <url> --eli5           # Simple explanation
glance <url> --full           # Full content (no summary)
glance <url> --ask "..."      # Ask specific question
```

### 🎤 **Voice & Audio**
```bash
glance <url> --read                           # Read aloud
glance <url> --audio-output article.mp3       # Save as MP3
glance <url> --voice nova --read              # Choose voice
glance <url> -l fr --voice antoine --read     # French voice

glance --list-voices                          # See all voices
```

**Voice Options:**
- **Free**: System TTS (macOS Say, Windows SAPI, Linux espeak)
- **Premium**: ElevenLabs (natural voices, requires `ELEVENLABS_API_KEY`)

### 🌍 **Multi-Language Support**
```bash
glance https://lemonde.fr --tldr              # Auto-detects French from URL
glance https://www.ayiti.ai/fr --read         # Auto-detects French + voice
glance <url> --full -l es --voice isabella --read   # Override to Spanish + voice

# Auto-detection: Detects language from URL patterns and content
# Supported: en, fr, es, ht (Haitian Creole)
# Override: Use --language flag to force specific language
```

### 🤖 **AI Models**
```bash
# Free local AI (recommended)
glance <url> --model llama3

# Premium cloud AI (optional, requires API keys)
glance <url> --model gpt-4o-mini              # OpenAI
glance <url> --model gemini-2.0-flash-exp     # Google Gemini

# Model management
glance --list-models          # Show available local models
glance --check-services       # Show AI/voice service status
glance <url> --free-only      # Never use paid APIs
```

---

## 📖 Common Use Cases

```bash
# Morning news with audio
glance https://news.ycombinator.com --tldr --read

# Documentation lookup
glance https://nextjs.org/docs --ask "What's the App Router?"

# Study while coding
glance https://tutorial.com --full --read

# Auto language detection  
glance https://www.ayiti.ai/fr --tldr              # Automatically detects French

# Multilingual learning
glance https://lemonde.fr --full -l en --read      # French → English + voice

# Save in different formats
glance https://news.com --output summary.md        # Markdown format
glance https://api-docs.com --output data.json     # JSON format
glance https://article.com --format plain --output content.txt  # Plain text

# Batch processing
for url in $(cat urls.txt); do
  glance "$url" --tldr --output "$(basename $url).md"
done
```

---

## 📚 All Options

### **Content**
```bash
--tldr                        # One sentence summary
--key-points, -k              # Bullet points
--eli5                        # Simple explanation
--full                        # Full content (no summary)
--ask "question"              # Custom Q&A
```

### **Voice & Audio**
```bash
--read, -r                    # Read aloud
--audio-output <file>         # Save as MP3
--voice <name>                # Choose voice (nova, onyx, antoine, isabella)
--list-voices                 # Show available voices
-l, --language <code>         # Output language (en, fr, es, ht)
```

### **AI Models**
```bash
--model <name>                # AI model (llama3, gpt-4o-mini, gemini-2.0-flash-exp)
--list-models                 # Show local models
--check-services              # Show service status
--free-only                   # Never use paid APIs
--prefer-quality              # Use premium if available
```

### **Output & File Saving**
```bash
--format <type>               # Output format: md, json, plain (default: terminal)
--output, -o <file>           # Save to file (auto-detects format from extension)
--stream                      # Live streaming output
```

### **Advanced**
```bash
--screenshot <file>           # Capture screenshot
--full-render                 # Render JavaScript (for SPAs)
--metadata                    # Show page metadata
--links                       # Extract all links
-v, --verbose                 # Detailed logs
-h, --help                    # Show help
-V, --version                 # Show version
```

---

## 🔧 Configuration

```bash
# AI Providers (optional)
export OPENAI_API_KEY=...
export GEMINI_API_KEY=...

# Voice (optional, for premium)
export ELEVENLABS_API_KEY=...

# Ollama (optional, auto-detected)
export OLLAMA_ENDPOINT=http://localhost:11434
```

---

## 🎓 Pro Tips

```bash
# 1. Auto language detection + file saving
glance https://lemonde.fr --output french-article.md   # Auto-detects French format

# 2. Format override for different use cases  
glance https://news.com --format json --output backup.md  # JSON content in .md file

# 3. Use local AI for privacy
glance https://www.ayiti.ai --model llama3 --free-only

# 4. Match voice to auto-detected language
glance https://www.ayiti.ai/fr --voice antoine --read    # French detection + voice

# 5. Streaming for long content
glance https://long-article.com --stream
```

---

## 🚀 Performance

- **Fast**: ~5 seconds with local AI (Ollama)
- **Efficient**: Cheerio-based content extraction
- **Lightweight**: ~8MB bundle size

---

## 🤝 Contributing

Contributions welcome! Check out our [Contributing Guide](CONTRIBUTING.md).

```bash
git clone https://github.com/jkenley/glance-cli.git
cd glance-cli
bun install
bun dev https://www.ayiti.ai
```

---

## ☕ Support

I built this in my spare time because I wanted a better way to read web content from my terminal. If you find it useful and want to support continued development, you can [buy me a coffee](https://ko-fi.com/jkenley).

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jkenley)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **GitHub**: [github.com/jkenley/glance-cli](https://github.com/jkenley/glance-cli)
- **NPM**: [npmjs.com/package/glance-cli](https://www.npmjs.com/package/glance-cli)
- **Issues**: [github.com/jkenley/glance-cli/issues](https://github.com/jkenley/glance-cli/issues)

---

**Built with ❤️ by [Kenley Jean](https://github.com/jkenley)**

*Star ⭐ the repo if you find it useful!*