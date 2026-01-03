---
id: "glance-cli-ai-web-reader-free"
slug: "glance-cli-ai-web-reader"
title: "Glance CLI: AI-Powered Web Reader with Voice - Now 100% Free!"
excerpt: "Turn any webpage into terminal-friendly insights with AI summaries and multilingual voice output. 100% free by default with local Ollama - no API keys needed!"
featuredImage: "/blogs/glance-cli-terminal.jpg"
imageCredit: "Terminal interface by Kenley Jean-Louis"
imageCreditUrl: "https://github.com/jkenley/glance-cli"
publishedAt: "2026-01-02"
readTime: "9 min"
category: "open-source"
tags: ["cli", "terminal", "developer-tools", "open-source"]
author:
  name: "Kenley Jean-Louis"
  avatar: "/images/kenley.jpg"
  bio: "Senior Software Engineer • Montreal, Canada"
  socialLinkedin: "https://www.linkedin.com/in/jkenley"
  socialTwitter: "@jkenley"
  socialGithub: "https://github.com/jkenley"
status: "published"
createdAt: "2026-01-02"
updatedAt: "2026-01-03"
---

# Glance CLI: AI-Powered Web Reader with Voice - Now 100% Free!

I built a powerful CLI tool that transforms any webpage into clean, actionable insights right in your terminal. What started as a simple web reader has evolved into something special: **100% free AI-powered summarization with multilingual voice output** that works entirely offline.

No subscriptions. No API costs. Your data never leaves your machine.

---

## Why I Built This

As someone who spends most of my day in the terminal, I was tired of constantly switching to browsers just to read documentation, news, or research papers. I needed something that could:

- **Work completely offline** (no API dependencies)
- **Handle multiple languages** (I work across French, English, Spanish, and Haitian Creole daily)
- **Read content aloud** while I code or work on other tasks
- **Be fast and reliable** without breaking my workflow

After trying existing tools that either required expensive subscriptions or didn't quite fit my needs, I decided to build exactly what I wanted. The result is a tool that's become an essential part of my daily workflow—and apparently others find it useful too.

**The best part?** It's completely free and privacy-first by design.

---

## What It Does (And What's New!)

Glance transforms any webpage into clean, actionable insights with AI-powered summaries and **multilingual voice output**. Here's what makes it special:

```bash
# Install (works with both Bun and npm)
bun install -g glance-cli  # Faster!
# OR: npm install -g glance-cli

# Use immediately (even without setup!)
glance https://example.com --tldr

# Listen to content while you work
glance https://techcrunch.com --tldr --read

# Multilingual support with native voices
glance https://lemonde.fr --voice antoine -l fr --read
```

### 🎙️ **NEW: Voice Output with Language Intelligence**

The biggest update is **intelligent voice synthesis** that automatically adapts to content language:

- **🇺🇸 English**: Nova (energetic), Onyx (authoritative), and more
- **🇫🇷 French**: Antoine and other native French voices
- **🇪🇸 Spanish**: Isabella and native Spanish speakers
- **🇭🇹 Haitian Creole**: Full voice support

```bash
# Auto-selects appropriate voice for content language
glance https://lemonde.fr --read  # Uses French voice automatically

# Or choose specific voices
glance https://article.com --voice nova --read
glance https://elpais.com --voice isabella -l es --read
```

### 🧠 **Smart Service Detection**

The tool now intelligently detects what you have available and **prioritizes free options**:

1. **Free First**: Ollama (local AI) - 100% free, private, fast
2. **Premium Fallback**: OpenAI/Gemini (if you have API keys)
3. **Voice Options**: Local TTS → ElevenLabs (premium)

```bash
# Check what services you have available
glance --check-services

# Force free-only mode (never use paid APIs)
glance https://example.com --free-only

# Use premium quality when needed
glance https://complex-paper.com --prefer-quality
```

### 📖 **NEW: Full Content Mode with AI Formatting** (v0.9.1)

Revolutionary feature that transforms how you consume long-form content:

- **Complete Articles**: Read entire blog posts, documentation, and papers without summarization
- **AI Smart Formatting**: Automatically organizes messy website layouts into beautiful, readable structure
- **Perfect for Voice**: Optimized formatting works seamlessly with voice synthesis
- **Multilingual Translation**: Read French articles in English, Spanish content in French, etc.

```bash
# Read entire articles with perfect formatting
glance https://messy-blog.com --full --read

# Translate and format French content to English
glance https://lemonde.fr/tech-article --full -l en --read

# Save beautifully formatted content
glance https://complex-website.com --full --export clean-article.md
```

### 🚀 **PERFORMANCE & RELIABILITY** (v0.10.2)

Enhanced performance and eliminated corruption issues:

- **Zero Corruption**: Completely eliminated binary artifacts and garbled output
- **Consistent Results**: Every request generates fresh, clean content  
- **Simplified Architecture**: Removed complex caching layer for better reliability
- **Faster Development**: Streamlined codebase enables rapid feature development

```bash
# Reliable, corruption-free summaries every time
glance https://any-website.com --tldr  # Fresh, clean content always
glance https://complex-site.com --full  # No artifacts, pure content
```

---

## Getting Started

### 🆓 100% Free Setup (Recommended)

```bash
# 1. Install with Bun (faster!) or npm
bun install -g glance-cli
# OR: npm install -g glance-cli

# 2. Install local AI (one-time, ~4GB download)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# 3. Start using immediately!
glance https://nextjs.org/docs --tldr
glance https://news.ycombinator.com --tldr --read
```

**This costs $0 forever and your data never leaves your machine.**

### ⚡ Works Immediately (Even Without Setup)

Glance now works out of the box—even before you install Ollama! It gracefully falls back through available services:

```bash
# Install and use immediately
bun install -g glance-cli
glance https://example.com  # Works instantly!
```

### 🎤 Voice Setup (Optional)

```bash
# Free option: Uses your system's built-in voices
glance https://article.com --read

# Premium option: Natural AI voices (requires API key)
export ELEVENLABS_API_KEY=...
glance https://article.com --voice nova --read

# List available voices by language
glance --list-voices
```

### 🎯 Premium AI (Optional)

For maximum quality on complex content:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...
glance https://research-paper.com --prefer-quality

# Google Gemini
export GEMINI_API_KEY=...
glance https://complex-docs.com --model gemini-2.0-flash-exp
```

I use the free local option about 95% of the time and only reach for premium APIs for complex technical analysis.

---

## How I Actually Use It

### 🌅 Morning Routine with Audio
```bash
# Listen to headlines while having coffee
glance https://news.ycombinator.com --tldr --read

# Save tech news as audio for commute
glance https://techcrunch.com --key-points --audio-output commute.mp3
```

### 📚 Learning & Research
```bash
# Understand complex topics
glance https://nextjs.org/docs --eli5 --voice nova --read

# Take structured notes
glance https://research-paper.com --key-points --export notes.md

# Quick Q&A without context switching
glance https://nextjs.org/docs --ask "What's the difference between App Router and Pages Router?"
```

### 💻 Developer Workflow
```bash
# Listen to docs while coding
glance https://api-docs.com --ask "How do I authenticate?" --read

# Quick reference with streaming output
glance https://long-tutorial.com --stream

# Export for team sharing
glance https://important-article.com --export team-notes.md
```

### 🌍 Multilingual Content with Native Voices
```bash
# French tech articles with French voice
glance https://lemonde.fr/tech --voice antoine -l fr --read

# Spanish news with Spanish voice
glance https://elpais.com/tech --voice isabella -l es --read

# Haitian Creole content
glance https://example.ht --voice nova -l ht --read
```

### 🎯 Power User Tricks
```bash
# Batch processing
cat urls.txt | while read url; do
  glance "$url" --tldr >> daily-summary.md
done

# Screenshot + summary for visual content
glance https://design-article.com --screenshot page.png --key-points

# Force high quality for complex content
glance https://academic-paper.com --prefer-quality --ask "What are the main findings?"
```

This has genuinely transformed how I consume information—no more constant browser switching, and I can multitask while "reading" through audio.

---

## Basic Usage

### Summary Modes
```bash
glance https://article.com                    # Standard summary
glance https://article.com --tldr             # One sentence
glance https://article.com --key-points       # Bullet points  
glance https://article.com --eli5             # Simple explanation
glance https://article.com --full             # Complete article (NEW!)
glance https://article.com --ask "question"   # Ask anything
```

### Languages
```bash
glance <url> -l fr    # French
glance <url> -l es    # Spanish
glance <url> -l ht    # Haitian Creole
```

Currently supports English, French, Spanish, and Haitian Creole. I can add more based on what people need.

### Export
```bash
glance <url> --export notes.md      # Save as Markdown
glance <url> --export data.json     # Save as JSON
```

### 🎤 Voice & Audio
```bash
glance <url> --read                    # Read aloud immediately
glance <url> --audio-output file.mp3  # Save as MP3
glance <url> --voice nova --read       # Choose specific voice
glance --list-voices                   # Show voices by language

# Language-specific voices
glance <url> --voice antoine -l fr --read    # French voice
glance <url> --voice isabella -l es --read   # Spanish voice
```

### 🛠️ Service Control
```bash
glance --check-services           # See what's available
glance <url> --free-only          # Never use paid APIs
glance <url> --prefer-quality     # Use premium when available

# Model selection
glance <url> --model llama3            # Force local Ollama
glance <url> --model gpt-4o-mini       # Force OpenAI
glance <url> --model gemini-2.0-flash-exp  # Force Gemini
```

### 📊 Advanced Features
```bash
glance <url> --screenshot page.png    # Capture screenshot
glance <url> --full-render            # Render JavaScript (SPAs)
glance <url> --stream                 # Live streaming output
glance <url> --metadata               # Show page metadata
glance <url> --links                  # Extract all links
```

---

## What People Are Saying

Since releasing v0.9.2, the response has been incredible. Here's what I'm hearing:

**"Finally, a tool that respects my privacy AND my wallet!"** - The 100% free local approach really resonates with developers who are tired of subscription fatigue.

**"The voice features are game-changing."** - Several users mentioned how audio output lets them consume content while coding, and the language-intelligent voice selection "just works."

**"Perfect for my multilingual workflow."** - Developers working across multiple languages love that it handles French, Spanish, and Haitian Creole content natively.

**"The caching makes this lightning fast."** - The smart caching system means repeated requests are nearly instant.

Of course, there's constructive feedback too—some want more languages, others want better handling of paywalled content. I'm actively working on improvements.

If you try it, I'd genuinely appreciate your feedback—both positive and critical.

---

## Latest Updates & Improvements in v0.9.2

This is version 0.9.2 with major improvements and critical fixes. Here's what's been resolved:

**✅ NEW: Full Content Mode with AI Formatting** (v0.9.1)
- Read entire articles without summarization using `--full` flag
- AI-powered smart formatting that organizes messy content intelligently
- Perfect for listening to complete blog posts, documentation, and complex articles
- Multilingual translation support for full content

**✅ MAJOR IMPROVEMENT: Reliability & Performance** (v0.10.2)
- Eliminated all corruption issues by removing problematic cache layer
- Fresh content generation ensures consistent, clean output every time
- Simplified architecture improves stability and development velocity
- Modular codebase enables programmatic API usage and better testing

**✅ PREVIOUS FIXES:**
- Text formatting issues completely resolved
- Voice reliability with proper language mapping
- `--prefer-quality` flag working correctly
- Smart text cleaning that preserves paragraph structure

**Still working on:**
- **Local AI quality**: Llama3 is good but not GPT-4 level for complex analysis
- **JavaScript-heavy sites**: Some SPAs need `--full-render` flag
- **Paywalled content**: Can't access content behind logins (by design)
- **More languages**: Currently supports 4 languages, working on expanding

**Latest stability improvements:**
- Eliminated corruption by removing complex caching layer
- Intelligent content formatting using AI
- Better memory management for large content  
- Enhanced error recovery and simplified validation

I'm actively addressing these based on real user feedback.

---

## What It's Good For (And What It's Not)

**Works well for:**
- Quick summaries of articles and documentation
- Terminal-first workflows
- Reading multilingual content
- Privacy-conscious users
- Cost-conscious developers

**Not the right tool for:**
- Deep research (use ChatGPT or Claude directly)
- Content behind logins
- Maximum quality on every request
- Videos or highly interactive content

It's a focused tool for a specific use case. If that use case matches yours, great. If not, that's totally fine too.

---

## What's Next

I'm building in public and prioritizing based on real user feedback. Here's what's on the roadmap:

### 🎯 Short-term (Next 1-2 months)
- **Local TTS integration** (working on Orpheus-3b-FT support for completely offline voice)
- **More languages** (Portuguese, German, Italian based on requests)
- **Better JavaScript handling** (improved SPA support)
- **Batch processing** for multiple URLs

### 🚀 Medium-term (3-6 months)  
- **Plugin system** for custom extractors and formats
- **Integration with popular note-taking apps** (Obsidian, Notion, etc.)
- **Advanced caching** with smart invalidation
- **Web interface** for teams who prefer browsers

### 🔮 Long-term Ideas
- **Browser extension** that works with the CLI
- **Team sharing features** for collaborative research
- **Custom AI model training** for domain-specific content

But honestly, I'm mostly focused on making the core experience rock-solid. The voice features in v0.8.8 were the most requested improvement, and the response has been fantastic.

If you have ideas or specific needs, I'm all ears!

---

## Try It Right Now

### 🚀 Quick Start (30 seconds)
```bash
# Install with Bun (recommended - faster!)
bun install -g glance-cli

# OR with npm
npm install -g glance-cli

# Works immediately!
glance https://nextjs.org/docs --tldr
```

### 🆓 Full Free Setup (2 minutes)
```bash
# Install local AI for 100% free operation
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# Now completely free forever
glance https://techcrunch.com --tldr --read
```

### 🎯 Test the Latest Features
```bash
# NEW: Full content with AI smart formatting (v0.9.1)
glance https://messy-blog.com --full --read

# Multilingual full content with translation
glance https://lemonde.fr/article --full -l en --read

# Voice output with language intelligence
glance https://lemonde.fr --voice antoine -l fr --read

# Smart service detection
glance --check-services

# Audio export for later
glance https://long-article.com --key-points --audio-output summary.mp3

# Advanced features with rock-solid caching (v0.9.2)
glance https://complex-site.com --full-render --screenshot page.png --stream
```

**Links:**
- 📦 **npm**: [npmjs.com/package/glance-cli](https://www.npmjs.com/package/glance-cli)
- 🐙 **GitHub**: [github.com/jkenley/glance-cli](https://github.com/jkenley/glance-cli)
- 📊 **Download stats**: 1000+ downloads/month and growing
- 📝 **License**: MIT (completely open source)

I actively respond to issues and pull requests. While I work on this in my spare time, I ship updates regularly based on user feedback.

---

## The Bottom Line

I built this tool to solve my own problem—I wanted to read and listen to web content from my terminal without constant context switching, expensive subscriptions, or privacy concerns.

**What started as a simple web reader has become something special:**
- 🆓 **100% free by default** (works entirely offline)
- 🔒 **Privacy-first** (your data never leaves your machine)
- 🎙️ **Intelligent voice output** (multilingual with native pronunciation)
- ⚡ **Lightning fast** (smart caching + local AI)
- 🌍 **Multilingual** (French, Spanish, Haitian Creole, English)

It's not perfect and it won't solve everyone's problems. But if you're someone who:
- Lives in the terminal
- Wants to consume web content efficiently
- Values privacy and cost control
- Works across multiple languages
- Likes to multitask with audio content

...then this might just transform your workflow like it did mine.

The v0.10.2 release represents months of refinement based on real user feedback. The full content mode with AI formatting and corruption-free reliability have completely transformed how I consume information daily.

**Try it for 30 seconds—it works immediately, no setup required.** Then decide if you want the full free setup with local AI.

---

Built by Kenley Jean-Louis in Montreal.  
Follow me on Twitter at @jkenley for updates.

---

## Quick Reference

```bash
# Installation
npm install -g glance-cli

# Free AI setup  
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# Basic commands
glance <url>                        # Summary
glance <url> --tldr                 # One sentence
glance <url> --key-points           # Bullet points
glance <url> --full                 # Complete article (NEW!)
glance <url> --ask "question"       # Ask anything
glance <url> --export notes.md      # Save output

# Languages
glance <url> -l fr                  # French
glance <url> -l es                  # Spanish

# Service management
glance --check-services             # See what's available
glance <url> --free-only            # Force free services
glance <url> --prefer-quality       # Use paid if available

# Help
glance --help
```

---

**Current version: 0.10.2** | Released: January 2026 | **Modular architecture with corruption-free reliability**

Have questions or found a bug? Open an issue on GitHub or reach out on Twitter.