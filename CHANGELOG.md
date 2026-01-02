# Changelog

All notable changes to glance-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-01-02

### Changed
- Streamlined README for better npm presentation
- Minor documentation improvements

## [0.8.0] - 2026-01-02

### Added
- 🎙️ **Multilingual voice output** with ElevenLabs integration and local TTS fallback
- 🧠 **Intelligent language-specific voice selection** (French voices for French content, etc.)
- 🔍 **Smart service detection** with automatic free-first fallback (Ollama → OpenAI → Gemini)
- 🆓 **Cost-conscious architecture** - uses 100% free services by default
- 📊 **Service status reporting** with `--check-services` command
- 🎯 **Voice management** with `--list-voices` and language-aware selection
- 💰 **Cost control flags**: `--free-only`, `--prefer-quality`
- 🔊 **Audio export** to MP3/WAV files with `--audio-output`
- 🌍 **Enhanced multilingual support** with native pronunciation

### Changed
- Service priority now favors free options (Ollama first, then premium APIs)
- Voice synthesis automatically adapts to content language
- CLI help updated with multilingual examples and cost-conscious workflows

### Fixed
- @google/genai dependency version corrected to ^1.34.0
- Voice synthesis error handling and graceful fallbacks

## [0.7.0] - 2026-01-01

### Added
- Expert-level prompt engineering for 10x better AI results
- Production-grade error handling with retry logic
- Intelligent caching with TTL, compression, and LRU eviction
- Rich content extraction with 20+ metadata fields
- Multiple output formats (HTML, plain text, Markdown, JSON)
- Cache statistics and management commands
- Comprehensive input validation
- Timeout protection for all network operations

### Changed
- Improved content selection algorithm with scoring
- Enhanced metadata extraction (author, dates, reading time)
- Better text formatting preservation
- Optimized cache key generation (deterministic, SHA-256)

### Fixed
- Memory leaks in Puppeteer cleanup
- Resource exhaustion from unbounded cache growth
- Non-atomic writes causing corruption
- Generic error messages replaced with actionable hints

## [0.6.0] - 2025-12-15

### Added
- Initial release
- Basic web fetching and summarization
- Support for OpenAI, Gemini, and Ollama
- Simple caching
- Screenshot capability
- Export to Markdown and JSON

[0.8.0]: https://github.com/jkenley/glance-cli/releases/tag/v0.8.0
[0.7.0]: https://github.com/jkenley/glance-cli/releases/tag/v0.7.0
[0.6.0]: https://github.com/jkenley/glance-cli/releases/tag/v0.6.0