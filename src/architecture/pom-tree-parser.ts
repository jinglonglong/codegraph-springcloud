import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../db';

export interface ParsedPom {
  pomPath: string;           // Absolute path to pom.xml
  relativePath: string;      // Relative path from project root (e.g. "", "services/user-service")
  artifactId: string;
  groupId: string | null;
  version: string | null;
  parentArtifactId: string | null;
  parentGroupId: string | null;
  packaging: string;         // 'jar' | 'pom' | 'war'
  modules: string[];         // Child module directory names
  hasSpringBootPlugin: boolean;
}

/**
 * Extracts a tag content from XML source. Scopes to the first match.
 */
function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return match && typeof match[1] === 'string' ? match[1].trim() : null;
}

/**
 * Strips target blocks from XML source to isolate top-level elements.
 */
function stripTags(xml: string, tags: string[]): string {
  let cleaned = xml;
  for (const tag of tags) {
    cleaned = cleaned.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
  }
  return cleaned;
}

/**
 * Parse pom.xml content to extract project metadata and relationships.
 */
export function parsePomContent(pomPath: string, projectRoot: string, content: string): ParsedPom {
  const pomDir = path.dirname(pomPath);
  const relativePath = path.relative(projectRoot, pomDir).replace(/\\/g, '/');

  // Extract parent block
  const parentBlock = extractTag(content, 'parent');
  let parentArtifactId: string | null = null;
  let parentGroupId: string | null = null;
  if (parentBlock) {
    parentArtifactId = extractTag(parentBlock, 'artifactId');
    parentGroupId = extractTag(parentBlock, 'groupId');
  }

  // Strip sub-blocks that might contain nested artifactIds (dependencies, build, etc.)
  const stripped = stripTags(content, ['parent', 'dependencies', 'dependencyManagement', 'build', 'properties', 'profiles']);

  const artifactId = extractTag(stripped, 'artifactId') || path.basename(pomDir);
  const groupId = extractTag(stripped, 'groupId');
  const version = extractTag(stripped, 'version');
  const packaging = extractTag(stripped, 'packaging') || 'jar';

  // Extract modules list
  const modules: string[] = [];
  const modulesBlock = extractTag(content, 'modules');
  if (modulesBlock) {
    const moduleMatches = [...modulesBlock.matchAll(/<module\b[^>]*>([\s\S]*?)<\/module>/gi)];
    for (const match of moduleMatches) {
      if (match[1]) {
        modules.push(match[1].trim());
      }
    }
  }

  // Check for spring-boot-maven-plugin
  const hasSpringBootPlugin = /<artifactId\s*>\s*spring-boot-maven-plugin\s*<\s*\/artifactId\s*>/i.test(content) ||
    /spring-boot-maven-plugin/i.test(content);

  return {
    pomPath,
    relativePath,
    artifactId,
    groupId,
    version,
    parentArtifactId,
    parentGroupId,
    packaging: packaging.toLowerCase(),
    modules,
    hasSpringBootPlugin,
  };
}

/**
 * Simple parser for server.port and spring.application.name in properties or yml format.
 */
export function extractPortAndName(filePath: string): { port: number | null; serviceName: string | null } {
  let port: number | null = null;
  let serviceName: string | null = null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const isYml = /\.ya?ml$/i.test(filePath);

    if (isYml) {
      // Yaml simple parsing
      // Match port
      const portMatch = /(?:^|\n)\s*port\s*:\s*["']?(\d+)["']?/i.exec(content);
      if (portMatch && portMatch[1]) {
        port = parseInt(portMatch[1], 10);
      } else {
        // Fallback for nested server: port: 8080
        const serverPortMatch = /(?:^|\n)\s*server\s*:[\s\S]*?\n\s+port\s*:\s*["']?(\d+)["']?/i.exec(content);
        if (serverPortMatch && serverPortMatch[1]) {
          port = parseInt(serverPortMatch[1], 10);
        }
      }

      // Match application name
      const nameMatch = /(?:^|\n)\s*name\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/i.exec(content);
      if (nameMatch && nameMatch[1]) {
        serviceName = nameMatch[1];
      } else {
        const appNameMatch = /(?:^|\n)\s*spring\s*:[\s\S]*?\n\s+application\s*:[\s\S]*?\n\s+name\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/i.exec(content);
        if (appNameMatch && appNameMatch[1]) {
          serviceName = appNameMatch[1];
        }
      }
    } else {
      // Properties parsing
      const portMatch = /(?:^|\n)\s*server\.port\s*=\s*["']?(\d+)["']?/i.exec(content);
      if (portMatch && portMatch[1]) {
        port = parseInt(portMatch[1], 10);
      }
      const nameMatch = /(?:^|\n)\s*spring\.application\.name\s*=\s*["']?([a-zA-Z0-9_-]+)["']?/i.exec(content);
      if (nameMatch && nameMatch[1]) {
        serviceName = nameMatch[1];
      }
    }
  } catch {
    // Ignore read errors
  }

  return { port, serviceName };
}

/**
 * Scan a project and build the parsed module list.
 */
export function buildModuleTree(projectRoot: string, allFiles: string[]): ParsedPom[] {
  const pomFiles = allFiles.filter(f => path.basename(f).toLowerCase() === 'pom.xml');
  const poms = pomFiles.map(f => {
    const absPath = path.resolve(projectRoot, f);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      return parsePomContent(absPath, projectRoot, content);
    } catch {
      return null;
    }
  }).filter((p): p is ParsedPom => p !== null);

  return poms;
}

/**
 * Finds the closest module matching the given file path.
 */
export function findModuleForFile(filePath: string, sortedModules: ParsedPom[]): ParsedPom | null {
  const normalizedPath = filePath.replace(/\\/g, '/');
  for (const mod of sortedModules) {
    if (mod.relativePath === '') {
      continue; // Skip root temporarily; match submodules first
    }
    if (normalizedPath === mod.relativePath || normalizedPath.startsWith(mod.relativePath + '/')) {
      return mod;
    }
  }
  // Fallback to root pom if any
  return sortedModules.find(m => m.relativePath === '') || null;
}

/**
 * Queries database to identify Spring Boot main classes and ports for each module.
 */
export function detectServicesAndPorts(
  projectRoot: string,
  modules: ParsedPom[],
  db: DatabaseConnection,
  allFiles: string[]
): Map<string, { isService: boolean; mainClassNodeId?: string; port?: number }> {
  const resultMap = new Map<string, { isService: boolean; mainClassNodeId?: string; port?: number }>();
  const sqlite = db.getDb();

  // Find all classes annotated with SpringBootApplication from the DB
  let appClasses: Array<{ id: string; name: string; file_path: string; decorators: string }> = [];
  try {
    appClasses = sqlite
      .prepare(`SELECT id, name, file_path, decorators FROM nodes WHERE kind = 'class' AND decorators LIKE '%SpringBootApplication%'`)
      .all() as any[];
  } catch {
    // DB might not have nodes table ready or schema differs, fallback
  }

  // Helper to check if file has a main method
  const fileHasMainMethod = (filePath: string): boolean => {
    try {
      const rows = sqlite
        .prepare(`SELECT id FROM nodes WHERE kind = 'method' AND name = 'main' AND file_path = ?`)
        .all(filePath);
      return rows.length > 0;
    } catch {
      return false;
    }
  };

  // Sort modules by path length descending to do prefix matching
  const sortedPoms = [...modules].sort((a, b) => b.relativePath.length - a.relativePath.length);

  for (const mod of modules) {
    let isService = false;
    let mainClassNodeId: string | undefined;
    let port: number | null = null;

    // A module is a service if it contains a SpringBootApplication class with a main method
    const moduleAppClasses = appClasses.filter(c => {
      const matchMod = findModuleForFile(c.file_path, sortedPoms);
      return matchMod && matchMod.relativePath === mod.relativePath;
    });

    for (const appClass of moduleAppClasses) {
      if (fileHasMainMethod(appClass.file_path)) {
        isService = true;
        mainClassNodeId = appClass.id;
        break;
      }
    }

    // Fallback: check hasSpringBootPlugin as a hint
    if (!isService && mod.hasSpringBootPlugin) {
      // Scan Java files in the module directly if DB is empty or lacks nodes
      const javaFiles = allFiles.filter(f => {
        if (!f.endsWith('.java')) return false;
        const rel = mod.relativePath;
        return rel === '' ? !f.includes('/') : f.startsWith(rel + '/');
      });

      for (const jFile of javaFiles) {
        try {
          const content = fs.readFileSync(path.resolve(projectRoot, jFile), 'utf-8');
          if (content.includes('@SpringBootApplication') && content.includes('public static void main')) {
            isService = true;
            break;
          }
        } catch {}
      }
    }

    // Scan for application configuration in this module
    const configFiles = allFiles.filter(f => {
      const matchMod = findModuleForFile(f, sortedPoms);
      return matchMod && matchMod.relativePath === mod.relativePath && 
        (path.basename(f).startsWith('application.') || path.basename(f).startsWith('bootstrap.'));
    });

    for (const cfgFile of configFiles) {
      const cfgPath = path.resolve(projectRoot, cfgFile);
      const extracted = extractPortAndName(cfgPath);
      if (extracted.port !== null) {
        port = extracted.port;
        break;
      }
    }

    resultMap.set(mod.relativePath, {
      isService,
      mainClassNodeId,
      port: port ?? undefined,
    });
  }

  return resultMap;
}
