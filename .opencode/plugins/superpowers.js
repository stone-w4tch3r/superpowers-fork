/**
 * Superpowers plugin for OpenCode.ai
 *
 * Injects superpowers bootstrap context via system prompt transform.
 * Skills are discovered via OpenCode's native skill tool from symlinked directory.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple frontmatter extraction (avoid dependency on skills-core for bootstrap)
const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: body };
};

// Normalize a path: trim whitespace, expand ~, resolve to absolute
const normalizePath = (p, homeDir) => {
  if (!p || typeof p !== 'string') return null;
  let normalized = p.trim();
  if (!normalized) return null;
  if (normalized.startsWith('~/')) {
    normalized = path.join(homeDir, normalized.slice(2));
  } else if (normalized === '~') {
    normalized = homeDir;
  }
  return path.resolve(normalized);
};

export const SuperpowersPlugin = async ({ client, directory }) => {
  const homeDir = os.homedir();
  const superpowersSkillsDir = path.resolve(__dirname, '../../skills');
  const envConfigDir = normalizePath(process.env.OPENCODE_CONFIG_DIR, homeDir);
  const configDir = envConfigDir || path.join(homeDir, '.config/opencode');

  // Helper to generate bootstrap content
  const getBootstrapContent = () => {
    // Try to load using-superpowers skill
    const skillPath = path.join(superpowersSkillsDir, 'using-superpowers', 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;

    const fullContent = fs.readFileSync(skillPath, 'utf8');
    const { content } = extractAndStripFrontmatter(fullContent);

    const toolMapping = `**Tool Mapping for OpenCode:**
When skills reference tools you don't have, substitute OpenCode equivalents:
- \`TodoWrite\` → \`update_plan\`
- \`Task\` tool with subagents → Use OpenCode's subagent system (@mention)
- \`Skill\` tool → OpenCode's native \`skill\` tool
- \`Read\`, \`Write\`, \`Edit\`, \`Bash\` → Your native tools

**Skills location:**
Superpowers skills are in \`${configDir}/skills/superpowers/\`
Use OpenCode's native \`skill\` tool to list and load skills.`;

    return `<EXTREMELY_IMPORTANT>
You have superpowers.

**IMPORTANT: The using-superpowers skill content is included below. It is ALREADY LOADED - you are currently following it. Do NOT use the skill tool to load "using-superpowers" again - that would be redundant.**

${content}

${toolMapping}
</EXTREMELY_IMPORTANT>`;
  };

  // Platform detection: only run on Linux or macOS
  const platform = os.platform();
  const isLinux = platform === 'linux';
  const isMacOS = platform === 'darwin';
  const isSupportedPlatform = isLinux || isMacOS;

  // Client detection: only run in OpenCode
  const isOpencode = client?.app?.name === 'opencode';

  // Helper to read configuration from directory/opencode.json
  const readConfig = () => {
    const configPath = path.join(directory, 'opencode.json');
    
    if (!fs.existsSync(configPath)) {
      return {
        superpowers: {
          autoupdate: true,
          autoupdate_notify: true
        }
      };
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      return {
        superpowers: {
          autoupdate: config.superpowers?.autoupdate ?? true,
          autoupdate_notify: config.superpowers?.autoupdate_notify ?? true
        }
      };
    } catch (error) {
      client.app.log('superpowers: Failed to parse opencode.json, using defaults');
      return {
        superpowers: {
          autoupdate: true,
          autoupdate_notify: true
        }
      };
    }
  };

  // Helper to check if superpowers was manually installed
  const isManualInstall = (superpowersDir) => {
    const gitConfigPath = path.join(superpowersDir, '.git', 'config');
    
    if (!fs.existsSync(gitConfigPath)) {
      return false;
    }

    try {
      const gitConfig = fs.readFileSync(gitConfigPath, 'utf8');
      const expectedUrls = [
        'https://github.com/obra/superpowers.git',
        'git+https://github.com/obra/superpowers.git'
      ];

      const isExpectedUrl = expectedUrls.some(url => gitConfig.includes(url));
      return !isExpectedUrl;
    } catch (error) {
      return false;
    }
  };

  // Autoinstall handler - entry point for all autoinstall logic
  const handleAutoinstall = async () => {
    // Exit early on unsupported platforms
    if (!isSupportedPlatform) {
      client.app.log('superpowers: Skipping autoinstall - unsupported platform:', platform);
      return;
    }

    // Exit early if not running in OpenCode
    if (!isOpencode) {
      client.app.log('superpowers: Skipping autoinstall - not running in OpenCode');
      return;
    }

    // Read configuration from directory/opencode.json
    const config = readConfig();

    client.app.log('superpowers: Autoinstall starting...');
    client.app.log('superpowers: Config directory:', configDir);

    const superpowersDir = path.join(configDir, 'superpowers');
    const pluginSymlinkPath = path.join(configDir, 'plugins/superpowers.js');
    const skillsSymlinkPath = path.join(configDir, 'skills/superpowers');
    const targetPluginPath = path.join(superpowersDir, '.opencode/plugins/superpowers.js');
    const targetSkillsPath = path.join(superpowersDir, 'skills');

    // Task 4: Implement git clone if not exists
    if (!fs.existsSync(superpowersDir)) {
      client.app.log('superpowers: Superpowers directory not found, cloning repository...');
      try {
        await $`git clone git+https://github.com/obra/superpowers.git ${superpowersDir}`;
        client.app.log('superpowers: Successfully cloned superpowers repository');
      } catch (error) {
        if (error.message.includes('git')) {
          client.app.log('superpowers: Error: Git is not installed. Please install git to continue.');
        } else {
          client.app.log('superpowers: Failed to clone repository:', error.message);
        }
        return;
      }
    } else {
      client.app.log('superpowers: Superpowers directory exists at', superpowersDir);
    }

    // Task 5: Implement symlink creation/removal (idempotent)
    const createSymlink = (source, target) => {
      try {
        // Remove existing symlink or file if it exists
        if (fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) {
          client.app.log('superpowers: Removing existing symlink at', target);
          fs.unlinkSync(target);
        }
      } catch (error) {
        // Ignore errors if target doesn't exist
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(target);
      if (!fs.existsSync(parentDir)) {
        client.app.log('superpowers: Creating parent directory', parentDir);
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Create symlink
      try {
        fs.symlinkSync(source, target);
        client.app.log('superpowers: Created symlink', target, '→', source);
      } catch (error) {
        client.app.log('superpowers: Failed to create symlink', target, '→', source, ':', error.message);
      }
    };

    createSymlink(targetPluginPath, pluginSymlinkPath);
    createSymlink(targetSkillsPath, skillsSymlinkPath);

    // Task 6: Implement update detection and pull
    const checkForUpdates = async () => {
      const gitDir = path.join(superpowersDir, '.git');
      
      if (!fs.existsSync(gitDir)) {
        client.app.log('superpowers: Not a git repository, skipping update check');
        return;
      }

      // Check for manual install
      if (isManualInstall(superpowersDir)) {
        client.app.log('superpowers: Manual installation detected, skipping auto-update');
        return;
      }

      // Check autoupdate config
      if (!config.superpowers.autoupdate) {
        return;
      }

      if (config.superpowers.autoupdate_notify) {
        client.app.log('superpowers: Checking for updates...');
      }

      try {
        // Git fetch with timeout
        await Promise.race([
          $`git -C ${superpowersDir} fetch origin`,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 30000)
          )
        ]);

        // Check if local branch is behind remote
        const localRev = await $`git -C ${superpowersDir} rev-parse HEAD`;
        const remoteRev = await $`git -C ${superpowersDir} rev-parse @{u}`;

        if (localRev.stdout.trim() !== remoteRev.stdout.trim()) {
          if (config.superpowers.autoupdate_notify) {
            client.app.log('superpowers: Updates available, pulling changes...');
          }
          await $`git -C ${superpowersDir} pull`;
          
          // Get the current version/tag
          try {
            const tag = await $`git -C ${superpowersDir} describe --tags --abbrev=0 2>/dev/null`;
            if (config.superpowers.autoupdate_notify) {
              client.app.log('superpowers: Updated to version:', tag.stdout.trim());
            }
          } catch {
            if (config.superpowers.autoupdate_notify) {
              client.app.log('superpowers: Updated successfully (no tag available)');
            }
          }
        } else {
          if (config.superpowers.autoupdate_notify) {
            client.app.log('superpowers: Already up to date');
          }
        }
      } catch (error) {
        if (error.message === 'Timeout') {
          client.app.log('superpowers: Update check timed out, continuing...');
        } else {
          client.app.log('superpowers: Update check failed:', error.message);
        }
      }
    };

    // Run update check in background (non-blocking)
    setImmediate(() => {
      checkForUpdates();
    });
  };

  return {
    // Autoinstall entry point - triggers on new sessions
    'session.created': async () => {
      await handleAutoinstall();
    },

    // Use system prompt transform to inject bootstrap (fixes #226 agent reset bug)
    'experimental.chat.system.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (bootstrap) {
        (output.system ||= []).push(bootstrap);
      }
    }
  };
};
