/**
 * Security Hardening Tests
 *
 * Tests for path validation, safe JSON parsing, input clamping,
 * file locking, and atomic config writes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validatePathWithinRoot, safeJsonParse, clamp, FileLock } from '../src/utils';
import { saveConfig, loadConfig, getConfigPath } from '../src/config';
import { DEFAULT_CONFIG } from '../src/types';

// Create a temporary directory for each test
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-security-test-'));
}

// Clean up temporary directory
function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('Security Hardening', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  // ==========================================================================
  // Path Validation
  // ==========================================================================

  describe('validatePathWithinRoot', () => {
    it('should accept paths within the root', () => {
      const result = validatePathWithinRoot(tempDir, 'src/index.ts');
      expect(result).toBe(path.resolve(tempDir, 'src/index.ts'));
    });

    it('should accept nested paths within the root', () => {
      const result = validatePathWithinRoot(tempDir, 'src/db/queries.ts');
      expect(result).toBe(path.resolve(tempDir, 'src/db/queries.ts'));
    });

    it('should reject paths that traverse above the root', () => {
      const result = validatePathWithinRoot(tempDir, '../../etc/passwd');
      expect(result).toBeNull();
    });

    it('should reject paths with embedded traversal', () => {
      const result = validatePathWithinRoot(tempDir, 'src/../../etc/passwd');
      expect(result).toBeNull();
    });

    it('should accept the root directory itself', () => {
      const result = validatePathWithinRoot(tempDir, '.');
      expect(result).toBe(path.resolve(tempDir));
    });

    it('should reject absolute paths outside the root', () => {
      const outsidePath = path.resolve(tempDir, '..', 'outside-file.txt');
      const result = validatePathWithinRoot(tempDir, outsidePath);
      expect(result).toBeNull();
    });

    it('should accept absolute paths within the root', () => {
      const insidePath = path.join(tempDir, 'src', 'file.ts');
      const result = validatePathWithinRoot(tempDir, insidePath);
      expect(result).toBe(insidePath);
    });
  });

  // ==========================================================================
  // Safe JSON Parsing
  // ==========================================================================

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse valid JSON arrays', () => {
      const result = safeJsonParse('["a", "b", "c"]', []);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return fallback for invalid JSON', () => {
      const result = safeJsonParse('not valid json{{{', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('should return fallback for empty string', () => {
      const result = safeJsonParse('', []);
      expect(result).toEqual([]);
    });

    it('should return fallback for truncated JSON', () => {
      const result = safeJsonParse('{"key": "val', undefined);
      expect(result).toBeUndefined();
    });

    it('should parse valid primitives', () => {
      expect(safeJsonParse('42', 0)).toBe(42);
      expect(safeJsonParse('"hello"', '')).toBe('hello');
      expect(safeJsonParse('true', false)).toBe(true);
      expect(safeJsonParse('null', 'fallback')).toBeNull();
    });
  });

  // ==========================================================================
  // Input Clamping
  // ==========================================================================

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 1, 10)).toBe(5);
    });

    it('should clamp to minimum', () => {
      expect(clamp(-5, 1, 10)).toBe(1);
      expect(clamp(0, 1, 10)).toBe(1);
    });

    it('should clamp to maximum', () => {
      expect(clamp(100, 1, 10)).toBe(10);
      expect(clamp(11, 1, 10)).toBe(10);
    });

    it('should handle exact boundary values', () => {
      expect(clamp(1, 1, 10)).toBe(1);
      expect(clamp(10, 1, 10)).toBe(10);
    });

    it('should handle negative ranges', () => {
      expect(clamp(0, -10, -1)).toBe(-1);
      expect(clamp(-20, -10, -1)).toBe(-10);
      expect(clamp(-5, -10, -1)).toBe(-5);
    });
  });

  // ==========================================================================
  // File Lock
  // ==========================================================================

  describe('FileLock', () => {
    it('should acquire and release a lock', async () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lock = new FileLock(lockTarget);

      const acquired = await lock.acquire();
      expect(acquired).toBe(true);
      expect(fs.existsSync(lockTarget + '.lock')).toBe(true);

      lock.release();
      expect(fs.existsSync(lockTarget + '.lock')).toBe(false);
    });

    it('should fail to acquire when another lock is held', async () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lock1 = new FileLock(lockTarget);
      const lock2 = new FileLock(lockTarget);

      const acquired1 = await lock1.acquire();
      expect(acquired1).toBe(true);

      // Second lock should time out quickly
      const acquired2 = await lock2.acquire(300);
      expect(acquired2).toBe(false);

      lock1.release();
    });

    it('should allow re-acquiring after release', async () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lock = new FileLock(lockTarget);

      const acquired1 = await lock.acquire();
      expect(acquired1).toBe(true);
      lock.release();

      const acquired2 = await lock.acquire();
      expect(acquired2).toBe(true);
      lock.release();
    });

    it('should clean up stale locks', async () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lockPath = lockTarget + '.lock';

      // Create a stale lock file manually
      fs.writeFileSync(lockPath, '99999', { flag: 'wx' });
      // Set its mtime to 60 seconds ago
      const pastTime = new Date(Date.now() - 60000);
      fs.utimesSync(lockPath, pastTime, pastTime);

      const lock = new FileLock(lockTarget);
      // staleLockMs=1000 means locks older than 1s are considered stale
      const acquired = await lock.acquire(5000, 1000);
      expect(acquired).toBe(true);

      lock.release();
    });

    it('should be safe to call release when not acquired', () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lock = new FileLock(lockTarget);

      // Should not throw
      expect(() => lock.release()).not.toThrow();
    });

    it('should be safe to call release multiple times', async () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lock = new FileLock(lockTarget);

      await lock.acquire();
      lock.release();
      // Second release should not throw
      expect(() => lock.release()).not.toThrow();
    });

    it('should write PID to lock file', async () => {
      const lockTarget = path.join(tempDir, 'test.db');
      const lock = new FileLock(lockTarget);

      await lock.acquire();
      const content = fs.readFileSync(lockTarget + '.lock', 'utf-8');
      expect(content).toBe(String(process.pid));

      lock.release();
    });
  });

  // ==========================================================================
  // Atomic Config Writes
  // ==========================================================================

  describe('Atomic Config Writes', () => {
    it('should not leave .tmp files after save', () => {
      const configDir = path.join(tempDir, '.codegraph');
      fs.mkdirSync(configDir, { recursive: true });

      const config = { ...DEFAULT_CONFIG, rootDir: tempDir };
      saveConfig(tempDir, config);

      const configPath = getConfigPath(tempDir);
      expect(fs.existsSync(configPath)).toBe(true);
      expect(fs.existsSync(configPath + '.tmp')).toBe(false);
    });

    it('should produce valid JSON after atomic save', () => {
      const configDir = path.join(tempDir, '.codegraph');
      fs.mkdirSync(configDir, { recursive: true });

      const config = { ...DEFAULT_CONFIG, rootDir: tempDir };
      saveConfig(tempDir, config);

      const loaded = loadConfig(tempDir);
      expect(loaded.version).toBe(DEFAULT_CONFIG.version);
      expect(loaded.enableEmbeddings).toBe(DEFAULT_CONFIG.enableEmbeddings);
      expect(loaded.rootDir).toBe(tempDir);
    });

    it('should overwrite existing config atomically', () => {
      const configDir = path.join(tempDir, '.codegraph');
      fs.mkdirSync(configDir, { recursive: true });

      // Save initial config
      const config1 = { ...DEFAULT_CONFIG, rootDir: tempDir, maxFileSize: 100000 };
      saveConfig(tempDir, config1);

      // Overwrite with new config
      const config2 = { ...DEFAULT_CONFIG, rootDir: tempDir, maxFileSize: 200000 };
      saveConfig(tempDir, config2);

      const loaded = loadConfig(tempDir);
      expect(loaded.maxFileSize).toBe(200000);
      expect(fs.existsSync(getConfigPath(tempDir) + '.tmp')).toBe(false);
    });
  });
});
