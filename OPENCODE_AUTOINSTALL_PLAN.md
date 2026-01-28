# OpenCode Auto-Install Plan (UPDATED)

## Architecture Overview

**Key Change:** Plugin is loaded from npm package via OpenCode's Bun autoinstaller. Plugin autoinstalls superpowers repo and symlinks on startup (before first message).

**Important:** `.opencode/plugins/superpowers.js` is **exclusively** for OpenCode client. This file is not used by other clients (Claude Code, Codex, etc.). The plugin will only function when loaded by OpenCode.

## Installation Flow

### User Setup (One-time)
```bash
# 1. User adds to opencode.json (respects OPENCODE_CONFIG_DIR):
{
  "plugin": ["superpowers-opencode-fork-dev-test"]
}

# 2. User starts OpenCode
# 3. OpenCode Bun autoinstaller downloads npm package
# 4. Plugin loads and autoinstalls superpowers in background
```

### Plugin Startup Behavior
1. **Session Created Event** - Triggers before first message
2. **Client Detection** - Verify running in OpenCode (exit early for other clients)
3. **Check Installation** - Detect if superpowers directory exists in config dir
4. **If Not Installed**:
   - Clone repo from GitHub
   - Create symlinks in config directory:
     - `{configDir}/plugins/superpowers.js` → `{configDir}/superpowers/.opencode/plugins/superpowers.js`
     - `{configDir}/skills/superpowers` → `{configDir}/superpowers/skills`
   - Log progress: "Installing Superpowers..." → "✓ Superpowers installed successfully"
5. **If Already Installed**:
   - Check if it's a valid git repo
   - If manual install detected: skip (don't override)
   - If autoinstall detected: check for updates
6. **Update Check**:
   - Run `git fetch` with timeout
   - If behind: `git pull`
   - Log: "Updated Superpowers to version X.Y.Z"
7. **Continue** - Plugin injects bootstrap via `experimental.chat.system.transform`

### Config Directory Resolution

Plugin uses `OPENCODE_CONFIG_DIR` environment variable with fallback:
```javascript
const envConfigDir = process.env.OPENCODE_CONFIG_DIR;
const configDir = envConfigDir || path.join(os.homedir(), '.config/opencode');
```

This respects OpenCode's custom config directory configuration. All paths are resolved dynamically at runtime.

## Configuration

### Auto-Update Control
```json
{
  "plugin": ["superpowers-opencode-fork-dev-test"],
  "superpowers": {
    "autoupdate": true,
    "autoupdate_notify": true
  }
}
```

- `autoupdate` (default: true) - Enable/disable automatic git pulls
- `autoupdate_notify` (default: true) - Show update notifications

### Platform Support
- **Supported:** OpenCode + Linux/macOS only
- **Other clients:** Plugin detects client type and exits early (no-op for Claude Code, Codex, etc.)
- **Windows:** Plugin exits early (uses manual install guide)

## Idempotency

- Safe to run plugin multiple times
- Detects existing symlinks and recreates if broken
- Respects manual git clones (doesn't override)
- File lock prevents concurrent installations
- Stale lock cleanup after 10 minutes

## Error Handling

- Git not installed: Clear error with install instructions
- Network timeout: Silently fail update check (don't block)
- Permission errors: Specific message about config directory permissions
- Lock file stale: Notify user, explain situation and propose manuall fixes, stop
- Manual install detected: Log message and skip autoinstall

## File Structure Changes

### New Files
- none

### Modified Files
- `.opencode/plugins/superpowers.js` - Add autoinstall logic on `session.created`
- `package.json` - No changes needed (already exports plugin correctly)

### Deleted Files
- `scripts/opencode-autoinstall.js` - No longer needed (no postinstall)

### Plugin File Placement

`.opencode/plugins/superpowers.js` is packaged in the npm package and only used by OpenCode. This file:
- Contains OpenCode-specific plugin logic
- Uses OpenCode's SDK and hooks
- Exits gracefully on other clients
- Is loaded by OpenCode's Bun autoinstaller from npm

## Package Configuration

### package.json (Current - Minor update)
```json
{
  "name": "superpowers-opencode-fork-dev-test",
  "version": "1.0.0",
  "main": ".opencode/plugins/superpowers.js",
  "exports": {
    ".": {
      "types": "./.opencode/plugins/superpowers.js",
      "default": "./.opencode/plugins/superpowers.js"
    }
  },
  "files": [
    ".opencode/plugins/superpowers.js",
    "skills/" // remove this since we can't bundle skills via npm and use git instead
  ],
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.1.0"
  }
}
```

No `postinstall` script - plugin handles everything on startup.

## GitHub Action for Auto-Publish

### Trigger Conditions
- Push to `master` branch
- Tag push matching `v*.*.*` (version tags)

### Workflow Steps
1. Setup Node.js environment
2. Install dependencies
3. Run tests (if any)
4. Publish to npm using `npm publish`
5. Create GitHub release (optional)

### Workflow File
`.github/workflows/publish.yml`:
```yaml
name: Publish to npm

on:
  push:
    branches: [master]
    tags: ['v*.*.*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
      - run: npm test  # if tests exist
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Testing Strategy

### Test 1: Fresh Install
- Add plugin to config
- Start OpenCode
- Verify: repo cloned, symlinks created, skills discoverable, bootstrap injected

### Test 2: Manual Install Coexistence
- Create manual git clone and symlinks
- Install npm plugin
- Verify: Plugin detects manual install, doesn't override, updates work

### Test 3: Update Detection
- Initial install
- Mock upstream changes (advance HEAD in remote)
- Restart OpenCode
- Verify: Update detected, git pull executed, notification logged

### Test 4: Auto-Update Disabled
- Set `superpowers.autoupdate: false`
- Create initial install
- Mock upstream changes
- Restart OpenCode
- Verify: No update performed, no notifications

### Test 5: Platform Detection
- Test on Windows (should skip)
- Test on Linux/macOS (should install)
- Test on Claude Code/Codex (should skip - plugin exits early)

### Test 6: Custom Config Directory
- Set `OPENCODE_CONFIG_DIR=/tmp/test-config`
- Start OpenCode
- Verify: Installation uses custom config directory path

## Documentation Updates

### Quick Start (New section in docs/README.opencode.md)
```markdown
## Quick Install (npm)

Add to your opencode.json (location respects OPENCODE_CONFIG_DIR):
```json
{
  "plugin": ["superpowers-opencode-fork-dev-test"]
}
```

Start OpenCode. Superpowers autoinstalls in the background.

**Note:** This works only for Linux and Macos. For Windows, install manually
```

### Configuration (New section)
```markdown
## Configuration

Superpowers supports optional configuration in `opencode.json`:

```json
{
  "plugin": ["superpowers-opencode-fork-dev-test"],
  "superpowers": {
    "autoupdate": true,
    "autoupdate_notify": true
  }
}
```

- `autoupdate`: Enable automatic updates (default: true)
- `autoupdate_notify`: Show update notifications (default: true)

### Custom Config Directory

If you use a custom config directory via `OPENCODE_CONFIG_DIR`, the plugin automatically respects it. All installation files will be placed in your custom config directory.
```

### Manual Installation (Keep existing)
Keep existing manual installation guide for Windows or advanced users.

## Security Considerations

- Git clone from trusted repository (obra/superpowers)
- Git operations in subprocess (can't modify package.json)
- File lock prevents concurrent installations
- Symlinks removed before recreation (idempotent)
- Manual installations respected (no silent override)
- Config directory path resolved from env var (no hardcoded paths)

## Implementation Checklist

- [ ] Update plugin with autoinstall logic on `session.created` event
- [ ] Add platform detection (OpenCode + Linux/macOS only)
- [ ] Implement config dir resolution using OPENCODE_CONFIG_DIR env var
- [ ] Implement git clone if not exists
- [ ] Implement symlink creation/removal (idempotent, uses config dir)
- [ ] Implement update detection and pull
- [ ] Add progress logging via `client.app.log()`
- [ ] Add configuration support (`superpowers.autoupdate`, `superpowers.autoupdate_notify`)
- [ ] Add manual install detection and respect
- [ ] Remove postinstall script (no longer needed)
- [ ] Create GitHub Action workflow for publishing
- [ ] Update documentation (quick install, configuration, client-specific notes)
- [ ] Test all scenarios (fresh install, update, manual coexistence, platforms, clients, custom config dir)

## Client Compatibility Notes

### OpenCode (Primary Client)
- Plugin loads via Bun autoinstaller from npm
- Autoinstalls superpowers on startup
- Full autoinstall and update support

### Claude Code / Codex (Not Supported)
They have own installation processes and docs, should not be covered in this feature
