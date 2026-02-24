# Git Worktree Daily Workflow

Step-by-step guide for running parallel agents safely and keeping GitHub in sync with local work.

---

## 1. Quick Reference: Your Current Setup

| Agent | Cursor Window | Folder | Branch |
|-------|---------------|--------|--------|
| Agent A | Main window | `FireUltimate-V1.0.0.0` | `submenu/neris-all` |
| Agent B | 2nd window | `wt-departmentdetails-ui` | `submenu/departmentdetails-ui` |

**Full paths:**
- Agent A: `/Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`
- Agent B: `/Users/jeremywichtner/CursorProjects/wt-departmentdetails-ui`

---

## 2. Start of Day: Open Cursor Windows

### Step 1 — Open Agent A (main repo)
1. Open Cursor.
2. **File → Open Folder…**
3. Select: `/Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0`
4. Open integrated terminal (`Ctrl+`` or View → Terminal).

### Step 2 — Open Agent B (worktree)
1. **File → New Window** (or `Cmd+Shift+N`).
2. In the new window: **File → Open Folder…**
3. Select: `/Users/jeremywichtner/CursorProjects/wt-departmentdetails-ui`
4. Open integrated terminal.

### Step 3 — Confirm you're in the right place
In each window's terminal, run:

```bash
pwd
git branch --show-current
```

| Window | Expected `pwd` | Expected branch |
|--------|----------------|-----------------|
| Agent A | `.../FireUltimate-V1.0.0.0` | `submenu/neris-all` |
| Agent B | `.../wt-departmentdetails-ui` | `submenu/departmentdetails-ui` |

---

## 3. Before Work: Sync from GitHub

Run in **each** window's terminal (in that window's folder):

```bash
git status
git fetch origin
git pull --rebase
```

- **`git status`** — Shows uncommitted changes.
- **`git fetch origin`** — Downloads latest from GitHub.
- **`git pull --rebase`** — Updates your branch with remote changes.

---

## 4. During Work

- **One agent per window.** Do not run two agents in the same folder.
- Commit often so work is saved locally.
- Push when you finish a logical chunk so GitHub stays up to date.

---

## 5. End of Session: Sync to GitHub

Do this in **each** window before closing or switching to Cloud/Codespaces.

### In Agent A window (main repo)

```bash
cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0
git status
```

If there are changes:

```bash
git add .
git commit -m "Brief description of what you did"
git push origin submenu/neris-all
```

### In Agent B window (worktree)

```bash
cd /Users/jeremywichtner/CursorProjects/wt-departmentdetails-ui
git status
```

If there are changes:

```bash
git add .
git commit -m "Brief description of what you did"
git push origin submenu/departmentdetails-ui
```

### Verify both branches are on GitHub

```bash
git fetch origin
git log origin/submenu/neris-all -1 --oneline
git log origin/submenu/departmentdetails-ui -1 --oneline
```

You should see your latest commits. Cloud agents and Codespaces will pull these when they sync.

---

## 6. Worktree Management Commands

### List all worktrees

```bash
cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0
git worktree list
```

### Create a new worktree (when adding another branch)

From the main repo folder:

```bash
cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0
git fetch origin
git worktree add ../wt-<branch-slug> <branch-name>
```

Example for a branch `feature/new-thing`:

```bash
git worktree add ../wt-feature-new-thing feature/new-thing
```

**Rule:** The branch must not already be checked out elsewhere. Switch the main repo to another branch first if needed.

### Remove a worktree (when done with that branch)

```bash
cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0
git worktree remove ../wt-departmentdetails-ui
```

If it has uncommitted changes, commit or stash first, or use `--force` only if you're sure.

---

## 7. Common Situations

### "I have uncommitted changes and need to switch branches"

```bash
git stash push -u -m "WIP before switch"
git switch <target-branch>
# ... do work ...
git stash pop   # when you want changes back
```

### "I'm on the wrong branch in this window"

```bash
git status   # check for uncommitted changes
git stash push -u -m "temp"   # if needed
git switch <correct-branch>
```

### "I want to create a worktree but the branch is already checked out"

Switch the main repo to a different branch first:

```bash
cd /Users/jeremywichtner/CursorProjects/FireUltimate-V1.0.0.0
git switch main   # or any other branch
git worktree add ../wt-departmentdetails-ui submenu/departmentdetails-ui
```

---

## 8. End-of-Day Checklist

- [ ] Agent A: `git status` → commit → `git push origin submenu/neris-all`
- [ ] Agent B: `git status` → commit → `git push origin submenu/departmentdetails-ui`
- [ ] `git fetch origin` and confirm both branches show latest commits
- [ ] Close Cursor or leave windows open for next session

---

## 9. Cloud / Codespaces Sync

After you push from local:

1. In Cloud agent or Codespaces, run: `git fetch origin` then `git pull` (or `git pull --rebase`).
2. Or open the project in Cloud/Codespaces; it will use the remote branches you just pushed.

Your local commits are on GitHub, so remote environments will see them.
