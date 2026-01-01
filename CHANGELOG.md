# Changelog

All notable changes to glance-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.7.0]: https://github.com/jkenley/glance-cli/releases/tag/v0.7.0
[0.6.0]: https://github.com/jkenley/glance-cli/releases/tag/v0.6.0