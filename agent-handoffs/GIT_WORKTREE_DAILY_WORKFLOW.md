# Git Daily Workflow

Step-by-step guide for keeping your local repo in sync with GitHub. Use one folder and one branch at a time; worktree setup is optional (see **§7 Reference: Worktrees**).

> **Paths:** Commands use `/path/to/FireUltimate-V1.0.0.0` as a placeholder. Replace with your actual repo path (e.g. `~/Desktop/Projects/FireUltimate-V1.0.0.0`).

---

## 1. Quick Reference: Current Setup

**Typical setup:** One Cursor window, one project folder (e.g. `FireUltimate-V1.0.0.0`), one branch at a time (e.g. `submenu/neris-golive-cifpd` or `main`).

Before work: confirm branch → `git fetch` → `git pull --rebase`.  
After work: `git status` → `git add .` → `git commit -m "..."` → `git push`.

---

## 2. After Cloning (or New Machine): Get All Branches from GitHub

When you **clone** a repo, Git only checks out the default branch (usually `main`). Other branches exist on the remote but don’t exist as local branches yet. Use this when you see only `main` locally but need another branch (e.g. `submenu/neris-golive-cifpd`).

### Step 1 — Fetch from GitHub

From your project folder:

```bash
cd /path/to/FireUltimate-V1.0.0.0   # or your repo path
git fetch origin
```

This updates your local list of remote branches; it does not change your working files.

### Step 2 — See what’s on the remote

```bash
git branch -a
```

Branches listed under `remotes/origin/` are on GitHub. The one with `*` is your current local branch.

### Step 3 — Switch to the branch you want

To work on a specific branch (creates a local branch that tracks the remote):

```bash
git checkout submenu/neris-golive-cifpd   # replace with your branch name
```

Confirm:

```bash
git branch --show-current
git branch -a
```

You should see that branch checked out and listed locally.

### Optional: Create local branches for every remote branch

If you want a local branch for **every** remote branch (so you can switch to any of them later without typing the full name):

```bash
git branch -r | grep -v HEAD | sed 's|origin/||' | while read b; do git branch --track "$b" "origin/$b" 2>/dev/null || true; done
```

Then you can `git checkout <branch-name>` for any of them.

---

## 3. Start of Day: Open Project and Confirm Branch

1. Open Cursor.
2. **File → Open Folder…** and select your repo (e.g. `FireUltimate-V1.0.0.0`).
3. Open integrated terminal (`Ctrl+`` or View → Terminal).
4. Confirm you’re on the right branch:

```bash
pwd
git branch --show-current
```

If you’re on the wrong branch, run `git checkout <correct-branch>` (and stash any uncommitted changes if needed; see **§8 Common Situations**).

---

## 4. Before Work: Sync from GitHub

From your project folder:

```bash
cd /path/to/FireUltimate-V1.0.0.0   # your repo path
git status
git fetch origin
git pull --rebase
```

If you use cursaves:

```bash
cursaves pull
cd /path/to/FireUltimate-V1.0.0.0   # cursaves pull changes cwd; cd back to repo
```

- **`git status`** — Shows uncommitted changes.
- **`git fetch origin`** — Downloads latest from GitHub.
- **`git pull --rebase`** — Updates your current branch with remote changes.

> **Note:** `cursaves pull` changes the terminal's working directory to `~/.cursaves`. The final `cd` brings you back to the project folder so you're ready to work.

---

## 5. During Work

- Commit often so work is saved locally.
- Push when you finish a logical chunk so GitHub stays up to date.

---

## 6. End of Session: Sync to GitHub

Do this **before** closing Cursor or switching to Cloud/Codespaces.

### Step 1 — Confirm branch and status

```bash
cd /path/to/FireUltimate-V1.0.0.0   # your repo path
git branch --show-current
git status
```

### Step 2 — If there are changes: add, commit, push

```bash
git add .
git commit -m "Brief description of what you did"
git push
```

If Git says the branch has no upstream (first time pushing this branch from this machine):

```bash
git push -u origin <your-branch-name>
```

Example: `git push -u origin submenu/neris-golive-cifpd`

### Step 3 — Optional: verify on GitHub

```bash
git fetch origin
git log origin/<your-branch-name> -1 --oneline
```

You should see your latest commit. Cloud agents and Codespaces will pull it when they sync.

If you use cursaves: `cursaves push` before closing.

---

## 7. Reference: Worktrees (Optional / Future Use)

When you need to work on **multiple branches at once** in separate folders (e.g. one Cursor window per branch), you can use git worktrees. Day-to-day you can ignore this section.

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

## 8. Common Situations

### "I just cloned and only see main / I don’t see my branch"

Follow **§2 After Cloning (or New Machine)** above: `git fetch origin` → `git branch -a` → `git checkout <branch-name>`.

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

## 9. End-of-Day Checklist

- [ ] Confirm branch: `git branch --show-current`
- [ ] `git status` → if changes: `git add .` → `git commit -m "..."` → `git push`
- [ ] Optional: `git fetch origin` and confirm your branch shows latest commit
- [ ] Close Cursor or leave window open for next session

---

## 10. Cloud / Codespaces Sync

After you push from local:

1. In Cloud agent or Codespaces, run: `git fetch origin` then `git pull` (or `git pull --rebase`).
2. Or open the project in Cloud/Codespaces; it will use the remote branches you just pushed.

Your local commits are on GitHub, so remote environments will see them.
