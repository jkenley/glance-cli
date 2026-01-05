/**
 * Compatibility layer for Bun and Node.js
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";

// Runtime detection
export const isBun = typeof Bun !== "undefined";

// Process arguments
export const argv = isBun ? Bun.argv : process.argv;

// Environment variables
export const env = isBun ? Bun.env : process.env;

// File operations
export async function writeFile(
	filePath: string,
	content: string | Buffer,
): Promise<void> {
	if (isBun) {
		await Bun.write(filePath, content);
	} else {
		await fs.writeFile(filePath, content);
	}
}

export async function readFile(filePath: string): Promise<string> {
	if (isBun) {
		const file = Bun.file(filePath);
		return (await file.exists()) ? await file.text() : "";
	} else {
		try {
			return await fs.readFile(filePath, "utf-8");
		} catch {
			return "";
		}
	}
}

export async function readFileBuffer(filePath: string): Promise<Buffer> {
	if (isBun) {
		const file = Bun.file(filePath);
		const buffer = await file.arrayBuffer();
		return Buffer.from(buffer);
	} else {
		return await fs.readFile(filePath);
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	if (isBun) {
		return Bun.file(filePath).exists();
	} else {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}
}

// Shell operations
export async function shell(command: string): Promise<void> {
	if (isBun) {
		await Bun.$`sh -c ${command}`.quiet();
	} else {
		execSync(command, { stdio: "ignore" });
	}
}

export async function mkdirp(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true });
}

export async function rm(filePath: string): Promise<void> {
	try {
		await fs.unlink(filePath);
	} catch {
		// Ignore if file doesn't exist
	}
}

export async function rmrf(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, { recursive: true, force: true });
	} catch {
		// Ignore if directory doesn't exist
	}
}

export async function mv(src: string, dest: string): Promise<void> {
	await fs.rename(src, dest);
}
