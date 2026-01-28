# Auto-Install Test Checklist

This checklist covers all scenarios specified in the OPENCODE_AUTOINSTALL_PLAN.md.

## Prerequisites

- OpenCode installed and working
- Git installed
- Test environment on Linux or macOS
- Clean config directory for fresh install tests

## Test 1: Fresh Install (Linux/macOS)

**Setup:**
- Clean config directory: remove `~/.config/opencode/superpowers` if exists
- Remove symlinks: `~/.config/opencode/plugins/superpowers.js`, `~/.config/opencode/skills/superpowers`
- Add plugin to `opencode.json`:
  ```json
  {
    "plugin": ["superpowers-opencode-fork-dev-test"]
  }
  ```

**Verification:**
- [ ] OpenCode starts without errors
- [ ] Plugin loads successfully (check logs)
- [ ] Repository cloned to `~/.config/opencode/superpowers`
- [ ] Symlink created: `~/.config/opencode/plugins/superpowers.js` → `~/.config/opencode/superpowers/.opencode/plugins/superpowers.js`
- [ ] Symlink created: `~/.config/opencode/skills/superpowers` → `~/.config/opencode/superpowers/skills`
- [ ] Skills are discoverable via OpenCode's `skill` tool
- [ ] Bootstrap is injected (agent mentions superpowers)

**Commands:**
```bash
# Check plugin
ls -l ~/.config/opencode/plugins/superpowers.js

# Check skills symlink
ls -l ~/.config/opencode/skills/superpowers

# Verify skills discoverable
# (in OpenCode) use skill tool to list skills
```

## Test 2: Manual Install Coexistence

**Setup:**
- Manually clone superpowers:
  ```bash
  cd ~/.config/opencode
  git clone https://github.com/your-fork/superpowers.git superpowers
  ```
- Manually create symlinks
- Add plugin to `opencode.json`

**Verification:**
- [ ] Plugin detects manual installation
- [ ] Logs: "Manual installation detected, skipping auto-update"
- [ ] Update check does NOT run
- [ ] Symlinks are still maintained (plugin doesn't touch them)
- [ ] Plugin continues to function normally

**Commands:**
```bash
# Check git config to verify it's a manual install
cat ~/.config/opencode/superpowers/.git/config | grep -i url

# Verify no update attempts in logs
opencode run "test" --print-logs 2>&1 | grep -i "update"
# Should show: "Manual installation detected, skipping auto-update"
```

## Test 3: Update Detection

**Setup:**
- Fresh install completed
- Manually advance HEAD in remote:
  ```bash
  cd ~/.config/opencode/superpowers
  git fetch origin
  git reset --hard origin/master~1  # Move behind remote
  ```

**Verification:**
- [ ] Plugin detects updates on startup
- [ ] Logs: "Checking for updates..."
- [ ] Logs: "Updates available, pulling changes..."
- [ ] Logs: "Updated to version: X.Y.Z" (or "Updated successfully")
- [ ] Git pull executed successfully
- [ ] Skills directory updated

**Commands:**
```bash
# Verify updated
cd ~/.config/opencode/superpowers
git log -1 --oneline

# Check update logs
opencode run "test" --print-logs 2>&1 | grep -A 5 "superpowers: Updates available"
```

## Test 4: Auto-Update Disabled

**Setup:**
- Fresh install completed
- Update `opencode.json`:
  ```json
  {
    "plugin": ["superpowers-opencode-fork-dev-test"],
    "superpowers": {
      "autoupdate": false
    }
  }
  ```

**Verification:**
- [ ] Plugin starts without errors
- [ ] Update check does NOT run
- [ ] No "Checking for updates..." message in logs
- [ ] Plugin continues to function normally

**Commands:**
```bash
# Verify no update check
opencode run "test" --print-logs 2>&1 | grep -i "update"
# Should not show "Checking for updates..."
```

## Test 5: Auto-Update Notify Disabled

**Setup:**
- Fresh install completed
- Update `opencode.json`:
  ```json
  {
    "plugin": ["superpowers-opencode-fork-dev-test"],
    "superpowers": {
      "autoupdate_notify": false
    }
  }
  ```
- Create scenario where updates are available (as in Test 3)

**Verification:**
- [ ] Updates are pulled (git pull happens)
- [ ] No progress logs shown (no "Checking for updates..." or "Updated to version...")
- [ ] Only error messages are logged (if any)

**Commands:**
```bash
# Verify pull happened but no logs
cd ~/.config/opencode/superpowers
git log -1 --oneline  # Should show updated

opencode run "test" --print-logs 2>&1 | grep -i "superpowers: Checking"
# Should NOT show "Checking for updates..."
```

## Test 6: Platform Detection - Windows

**Setup:**
- Run on Windows
- Add plugin to `opencode.json`

**Verification:**
- [ ] Plugin detects Windows platform
- [ ] Logs: "Skipping autoinstall - unsupported platform: win32"
- [ ] No clone attempts
- [ ] No symlink creation attempts
- [ ] Plugin exits early without errors

## Test 7: Platform Detection - Linux/macOS

**Setup:**
- Run on Linux or macOS
- Add plugin to `opencode.json`

**Verification:**
- [ ] Platform detection passes
- [ ] Autoinstall proceeds normally
- [ ] Logs show platform is supported

## Test 8: Client Detection - Non-OpenCode

**Setup:**
- Run plugin in Claude Code or Codex
- Add plugin to configuration

**Verification:**
- [ ] Plugin detects non-OpenCode client
- [ ] Logs: "Skipping autoinstall - not running in OpenCode"
- [ ] No autoinstall operations
- [ ] Plugin exits early gracefully

## Test 9: Client Detection - OpenCode

**Setup:**
- Run in OpenCode
- Add plugin to `opencode.json`

**Verification:**
- [ ] Client detection passes
- [ ] Autoinstall proceeds normally
- [ ] All hooks fire correctly

## Test 10: Custom Config Directory

**Setup:**
- Set custom config directory:
  ```bash
  export OPENCODE_CONFIG_DIR=/tmp/test-config
  ```
- Start OpenCode with custom config
- Add plugin to `opencode.json` in custom directory

**Verification:**
- [ ] Installation uses custom config directory path
- [ ] Repo cloned to `/tmp/test-config/superpowers`
- [ ] Symlinks created in `/tmp/test-config/plugins/` and `/tmp/test-config/skills/`
- [ ] Logs show: "Config directory: /tmp/test-config"

**Commands:**
```bash
# Verify paths
ls -l /tmp/test-config/plugins/superpowers.js
ls -l /tmp/test-config/skills/superpowers
```

## Test 11: Network Timeout

**Setup:**
- Disable network or simulate timeout
- Start OpenCode

**Verification:**
- [ ] Update check times out after 30 seconds
- [ ] Logs: "Update check timed out, continuing..."
- [ ] OpenCode continues to function (not blocked)
- [ ] No crashes or errors

## Test 12: Git Not Installed

**Setup:**
- Uninstall git temporarily
- Start OpenCode with fresh config

**Verification:**
- [ ] Plugin attempts to clone
- [ ] Error caught: "Git is not installed. Please install git to continue."
- [ ] Logs clear error message
- [ ] Plugin exits gracefully without crashing

## Test 13: Idempotency - Multiple Runs

**Setup:**
- Complete fresh install
- Restart OpenCode multiple times (3+ times)

**Verification:**
- [ ] Each run detects existing installation
- [ ] Logs: "Superpowers directory exists at <path>"
- [ ] No duplicate clones
- [ ] Symlinks removed and recreated (idempotent)
- [ ] No errors or conflicts

## Test 14: Broken Symlinks

**Setup:**
- Complete fresh install
- Break symlinks (delete target files):
  ```bash
  rm -f ~/.config/opencode/superpowers/.opencode/plugins/superpowers.js
  ```

**Verification:**
- [ ] Plugin detects broken symlinks on next run
- [ ] Removes broken symlinks
- [ ] Recreates symlinks correctly
- [ ] Logs: "Removing existing symlink at <path>" and "Created symlink <path> → <target>"

## Test 15: Permission Errors

**Setup:**
- Make config directory read-only (simulate permission issues)
- Start OpenCode

**Verification:**
- [ ] Permission error is caught
- [ ] Specific error message about config directory permissions
- [ ] Plugin exits gracefully

## Test 16: Missing opencode.json

**Setup:**
- No `opencode.json` file in project
- Add plugin via global config

**Verification:**
- [ ] Plugin uses default configuration
- [ ] `autoupdate`: true
- [ ] `autoupdate_notify`: true
- [ ] No errors

## Test 17: Invalid opencode.json

**Setup:**
- Create invalid JSON in `opencode.json`:
  ```json
  {
    "plugin": ["superpowers-opencode-fork-dev-test"],
    "superpowers": { INVALID }
  }
  ```

**Verification:**
- [ ] Parse error caught
- [ ] Logs: "Failed to parse opencode.json, using defaults"
- [ ] Default configuration used
- [ ] Plugin continues to function

## Test 18: Bootstrap Injection

**Setup:**
- Fresh install completed

**Verification:**
- [ ] `experimental.chat.system.transform` hook fires
- [ ] Bootstrap content is injected
- [ ] Agent has superpowers context
- [ ] Tool mapping is present in bootstrap

## Test 19: Skills Discovery

**Setup:**
- Fresh install completed
- Symlinks created

**Verification:**
- [ ] Use OpenCode's `skill` tool
- [ ] All superpowers skills are listed
- [ ] Each skill can be loaded
- [ ] Skills from `~/.config/opencode/skills/superpowers/` are accessible

## Test 20: GitHub Action Workflow

**Setup:**
- Push to `master` branch
- Create tag `v1.0.0`

**Verification:**
- [ ] GitHub Action triggers
- [ ] Node.js 20 environment set up
- [ Dependencies installed
- [ ] Tests run (if exist)
- [ ] npm publish executes
- [ ] Package published to npm

---

## Test Summary

After completing all tests, verify:
- [ ] All 20 test scenarios pass
- [ ] No regressions in existing functionality
- [ ] Documentation is accurate
- [ ] Error handling is robust
- [ ] Idempotency is maintained

## Known Limitations

- Autoinstall only works on Linux and macOS
- Windows users must use manual installation
- Non-OpenCode clients (Claude Code, Codex) cannot use this plugin
- Network timeout may fail to update (but doesn't block startup)
- Manual installs are never auto-updated (by design)

## Troubleshooting

If tests fail:

1. **Check OpenCode logs:** `opencode run --print-logs --log-level DEBUG`
2. **Verify git is installed:** `git --version`
3. **Check permissions:** `ls -ld ~/.config/opencode`
4. **Verify symlinks:** `ls -l ~/.config/opencode/plugins/superpowers.js`
5. **Check config file:** `cat opencode.json | jq .`
6. **Test with clean config:** Remove `~/.config/opencode/superpowers` and restart

## Next Steps

After all tests pass:
1. Tag release: `git tag v1.0.0`
2. Push to GitHub: `git push origin master --tags`
3. Verify GitHub Action publishes to npm
4. Install from npm in clean environment: `npm install superpowers-opencode-fork-dev-test`
5. Test production package
