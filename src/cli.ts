#!/usr/bin/env node

/**
 * Glance CLI - Main entry point
 * 
 * This file serves as a thin wrapper that imports and runs
 * the modularized CLI from the cli/ directory.
 * 
 */

import { runCli } from "./cli/index";

// Run the CLI
runCli().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});