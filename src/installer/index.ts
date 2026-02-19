/**
 * CodeGraph Interactive Installer
 *
 * Provides a beautiful interactive CLI experience for setting up CodeGraph
 * with Claude Code.
 */

import { execSync } from 'child_process';
import { showBanner, showNextSteps, success, error, info, chalk } from './banner';
import { promptInstallLocation, promptAutoAllow, InstallLocation } from './prompts';
import { writeMcpConfig, writePermissions, writeClaudeMd, writeHooks, hasMcpConfig, hasPermissions, hasHooks } from './config-writer';

/**
 * Format a number with commas
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Run the interactive installer
 */
export async function runInstaller(): Promise<void> {
  // Show the banner
  showBanner();

  try {
    // Step 1: Try global install for bare `codegraph` command convenience.
    // This is best-effort — configs always use npx regardless.
    let codegraphAvailable = false;
    try {
      const checkCmd = process.platform === 'win32' ? 'where codegraph' : 'command -v codegraph';
      execSync(checkCmd, { stdio: 'pipe' });
      codegraphAvailable = true;
    } catch {
      // Not installed globally yet — try to install
      console.log(chalk.dim('  Installing codegraph globally...'));
      try {
        execSync('npm install -g @colbymchenry/codegraph', { stdio: 'pipe' });
        // Verify it actually worked (PATH may not include npm global bin)
        try {
          execSync(process.platform === 'win32' ? 'where codegraph' : 'command -v codegraph', { stdio: 'pipe' });
          codegraphAvailable = true;
          success('Installed codegraph command globally');
        } catch {
          // Install "succeeded" but command not in PATH — common with nvm/fnm
          info('Global install succeeded but codegraph is not in your PATH');
          info('You may need to add npm\'s global bin to your PATH, or use:');
          info('  npx @colbymchenry/codegraph <command>');
        }
      } catch {
        info('Could not install globally (permission denied)');
        info('You can install manually with: sudo npm install -g @colbymchenry/codegraph');
        info('Or use: npx @colbymchenry/codegraph <command>');
      }
      console.log();
    }

    // Step 2: Ask for installation location
    const location = await promptInstallLocation();
    console.log();

    // Step 3: Write MCP configuration (always uses npx for reliability)
    const alreadyHasMcp = hasMcpConfig(location);
    writeMcpConfig(location);

    if (alreadyHasMcp) {
      success(`Updated MCP server in ${location === 'global' ? '~/.claude.json' : './.claude.json'}`);
    } else {
      success(`Added MCP server to ${location === 'global' ? '~/.claude.json' : './.claude.json'}`);
    }

    // Step 4: Ask about auto-allow permissions
    const autoAllow = await promptAutoAllow();
    console.log();

    if (autoAllow) {
      const alreadyHasPerms = hasPermissions(location);
      writePermissions(location);

      if (alreadyHasPerms) {
        success(`Updated permissions in ${location === 'global' ? '~/.claude/settings.json' : './.claude/settings.json'}`);
      } else {
        success(`Added permissions to ${location === 'global' ? '~/.claude/settings.json' : './.claude/settings.json'}`);
      }
    }

    // Step 5: Write auto-sync hooks
    const alreadyHasHooks = hasHooks(location);
    writeHooks(location);

    if (alreadyHasHooks) {
      success(`Updated auto-sync hooks in ${location === 'global' ? '~/.claude/settings.json' : './.claude/settings.json'}`);
    } else {
      success(`Added auto-sync hooks to ${location === 'global' ? '~/.claude/settings.json' : './.claude/settings.json'}`);
    }

    // Step 6: Write CLAUDE.md instructions
    const claudeMdResult = writeClaudeMd(location);
    const claudeMdPath = location === 'global' ? '~/.claude/CLAUDE.md' : './.claude/CLAUDE.md';

    if (claudeMdResult.created) {
      success(`Created ${claudeMdPath} with CodeGraph instructions`);
    } else if (claudeMdResult.updated) {
      success(`Updated CodeGraph section in ${claudeMdPath}`);
    } else {
      success(`Added CodeGraph instructions to ${claudeMdPath}`);
    }

    // Step 7: For local install, initialize the project
    if (location === 'local') {
      await initializeLocalProject();
    }

    // Show next steps
    showNextSteps(location, codegraphAvailable);
  } catch (err) {
    console.log();
    if (err instanceof Error && err.message.includes('readline was closed')) {
      // User cancelled with Ctrl+C
      console.log(chalk.dim('  Installation cancelled.'));
    } else {
      error(`Installation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
  }
}

/**
 * Initialize CodeGraph in the current project (for local installs)
 */
async function initializeLocalProject(): Promise<void> {
  const projectPath = process.cwd();

  // Lazy-load CodeGraph (requires native modules)
  let CodeGraph: typeof import('../index').default;
  try {
    CodeGraph = (await import('../index')).default;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Could not load native modules: ${msg}`);
    info('Skipping project initialization. You can run "npx @colbymchenry/codegraph init -i" later.');
    info('If this persists, try a Node.js LTS version (20 or 22).');
    return;
  }

  // Check if already initialized
  if (CodeGraph.isInitialized(projectPath)) {
    info('CodeGraph already initialized in this project');
    return;
  }

  console.log();
  console.log(chalk.dim('  Initializing CodeGraph in current project...'));

  // Initialize CodeGraph
  const cg = await CodeGraph.init(projectPath);
  success('Created .codegraph/ directory');

  // Index the project
  const result = await cg.indexAll({
    onProgress: (progress) => {
      // Simple progress indicator
      const phaseNames: Record<string, string> = {
        scanning: 'Scanning files',
        parsing: 'Parsing code',
        storing: 'Storing data',
        resolving: 'Resolving refs',
      };
      const phaseName = phaseNames[progress.phase] || progress.phase;
      const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
      process.stdout.write(`\r  ${chalk.dim(phaseName)}... ${percent}%   `);
    },
  });

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(50) + '\r');

  if (result.success) {
    success(`Indexed ${formatNumber(result.filesIndexed)} files (${formatNumber(result.nodesCreated)} symbols)`);
  } else {
    success(`Indexed ${formatNumber(result.filesIndexed)} files with ${result.errors.length} warnings`);
  }

  cg.close();
}

// Export for use in CLI
export { InstallLocation };
