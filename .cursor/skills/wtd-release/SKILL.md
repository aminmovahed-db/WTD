---
name: wtd-release
description: >-
  Build and publish a new WTD release. Bumps the version in package.json,
  builds the macOS DMG, creates a GitHub Release with the DMG attached,
  and updates release notes. Use when the user says "release", "make a release",
  "new release", "publish a release", "ship it", or "cut a release".
---

# WTD Release

End-to-end release workflow for the WTD desktop app.

## Prerequisites

- Must be on the `dev` branch with a clean working tree
- `npm`, `git`, and `gh` (GitHub CLI) must be available
- GitHub CLI must be authenticated (`gh auth status`)

## Workflow

### Step 1: Pre-flight checks

Run these checks and stop if any fail:

```bash
# Must be on dev branch
git branch --show-current        # expect: dev

# Working tree must be clean
git status --porcelain            # expect: empty

# Tests must pass
npm test

# GitHub CLI must be authenticated
gh auth status
```

### Step 2: Ask bump level

Ask the user which version bump to apply:

| Option | When to use | Example |
|--------|-------------|---------|
| `patch` | Bug fixes, small tweaks | 0.1.0 → 0.1.1 |
| `minor` | New features, enhancements | 0.1.0 → 0.2.0 |
| `major` | Breaking changes | 0.1.0 → 1.0.0 |

Use the AskQuestion tool with these three options.

### Step 3: Generate changelog from commits

Gather all commits since the last release tag. This must run **before** the
version bump so the bump commit itself is not included.

```bash
# Find the most recent version tag (falls back to first commit if none exist)
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)

# List commits since that tag
git log "${LAST_TAG}..HEAD" --oneline --no-merges
```

Categorise each commit into one of these groups based on its message prefix.
If a commit has no recognised prefix, put it under **Other**.

| Prefix | Category |
|--------|----------|
| `feat` / `add` | **New Features** |
| `fix` | **Bug Fixes** |
| `refactor` / `perf` | **Improvements** |
| `docs` | **Documentation** |
| `test` | **Tests** |
| `style` / `chore` / `build` / `ci` | **Maintenance** |

Format the result as a markdown list grouped by category, e.g.:

```markdown
### New Features
- Add About modal showing app version and runtime info
- Add keyboard shortcuts for column navigation

### Bug Fixes
- Fix drag-drop into empty columns

### Improvements
- Compact archive cards into inline chip layout
```

Omit empty categories. Strip the prefix from each line so the notes read
naturally. Present the draft changelog to the user and let them edit, reorder,
or remove entries before proceeding.

### Step 4: Bump the version

```bash
npm version <patch|minor|major>
```

This updates `package.json`, creates a commit, and creates a git tag (e.g. `v0.2.0`).

Capture the new version string for later steps:

```bash
node -p "require('./package.json').version"
```

### Step 5: Merge into main and push

```bash
git checkout main
git pull origin main
git merge dev
git push origin main --tags
git checkout dev
git merge main   # keep dev in sync
git push origin dev
```

### Step 6: Build the DMG

```bash
npm run dist:mac
```

The DMG is written to `release/`. Find the exact filename:

```bash
ls release/*.dmg
```

### Step 7: Create a GitHub Release

Use the changelog from Step 3 (user-approved) as the release body.

```bash
gh release create "v<VERSION>" release/*.dmg \
  --title "v<VERSION>" \
  --notes "<formatted changelog from Step 3>"
```

### Step 8: Update README badge and release notes

Update the version badge in `README.md`:

- Find: `version-X.Y.Z-blue`
- Replace with: `version-<NEW_VERSION>-blue`

Append a new entry under the **Release Notes** section at the bottom of
`README.md` using the changelog from Step 3:

```markdown
### <NEW_VERSION>

<formatted changelog from Step 3>
```

Commit and push:

```bash
git checkout dev
git add README.md
git commit -m "docs: update release notes for v<VERSION>"
git push origin dev
git checkout main
git merge dev
git push origin main
git checkout dev
```

### Step 9: Confirm

Print a summary:

```
Release complete!
  Version:  v<VERSION>
  DMG:      release/<filename>.dmg
  GitHub:   <release URL from gh release create>
```

## Error handling

- If tests fail in step 1, stop and show the test output.
- If `npm run dist:mac` fails, stop and show the build error.
- If `gh release create` fails, check `gh auth status` and retry.
- Never force-push or use `--force` on any branch.
