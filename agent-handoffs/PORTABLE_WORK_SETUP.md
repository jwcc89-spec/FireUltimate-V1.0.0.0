# Portable Project Setup: Mac (Home) → Windows (Work) via External Drive

A step-by-step guide for running your project and Cursor from an external hard drive on a Windows work computer where you have **no admin rights** and **cannot install or download anything**. Everything must be prepared on your Mac at home.

---

## Part 1: Prepare the External Drive (on your Mac)

### Step 1: Format the Drive

1. Connect the external drive to your Mac.
2. Open **Disk Utility** (Applications → Utilities → Disk Utility).
3. Select the external drive in the sidebar.
4. Click **Erase**.
5. Choose **exFAT** (works on both Mac and Windows).
6. Name it (e.g. `WORK_PROJECTS`).
7. Click **Erase** and wait for it to finish.

### Step 2: Create the Folder Structure

On the external drive, create:

```
WORK_PROJECTS/
├── Cursor/              # Windows Cursor app
├── Projects/            # Your project(s)
├── Node/                # Portable Node.js for Windows
├── Git/                 # Portable Git for Windows
└── Scripts/             # Helper scripts
```

---

## Part 2: Get Cursor for Windows (all on your Mac)

### Option A: Portable/Zip Version (preferred)

1. On your Mac, go to [https://cursor.com](https://cursor.com).
2. Download the **Windows** version.
3. Check if there is a **zip** or **portable** download (e.g. "Windows x64 (zip)").
4. If yes: download it, unzip on your Mac, and copy the extracted folder into `WORK_PROJECTS/Cursor/` on the external drive.

### Option B: Extracting the Installer (if no zip is available)

1. Download the Windows installer (`.exe`) on your Mac.
2. On your Mac, install **The Unarchiver** (free) or use `unar` via Homebrew.
3. Try right-clicking the `.exe` → **Open With** → **The Unarchiver** (or similar) to extract.
4. If that fails, try **7-Zip** or **p7zip** on Mac to extract the installer.
5. Look for a folder with `Cursor.exe` and copy that folder to `WORK_PROJECTS/Cursor/` on the drive.

### Option C: One-Time Setup on Any Windows Machine

If you can't extract the installer on Mac:

1. Use any Windows machine (friend, library, etc.) once.
2. Connect the external drive.
3. Run the Cursor installer.
4. During install, choose a custom path on the external drive (e.g. `E:\WORK_PROJECTS\Cursor`).
5. After install, you can use that folder on your work computer without reinstalling.

---

## Part 3: Portable Node.js for Windows (on your Mac)

1. On your Mac, go to [https://nodejs.org/en/download](https://nodejs.org/en/download).
2. Under **Prebuilt Installer**, choose **Windows**.
3. Download the **Windows (x64)** `.zip` (not the `.msi` installer).
4. Unzip the downloaded file on your Mac.
5. Copy the entire extracted folder (e.g. `node-v20.x.x-win-x64`) to `WORK_PROJECTS/Node/` on the external drive.
6. Rename it to `node` so the path is `WORK_PROJECTS/Node/node/`.
7. The `node.exe` and `npm` should be in `WORK_PROJECTS/Node/node/`.

---

## Part 4: Portable Git for Windows (on your Mac)

1. On your Mac, go to [https://git-scm.com/download/win](https://git-scm.com/download/win).
2. Download **"64-bit Git for Windows Setup"**.
3. Go to [https://github.com/git-for-windows/git/releases](https://github.com/git-for-windows/git/releases).
4. Find the **Portable** release (e.g. `PortableGit-x.x.x-64-bit.7z.exe` or `.zip`).
5. Download the portable archive on your Mac.
6. Extract it (e.g. with The Unarchiver or Keka).
7. Copy the extracted folder to `WORK_PROJECTS/Git/` on the external drive.
8. Rename it so the path is `WORK_PROJECTS/Git/PortableGit/` and `git.exe` is in `WORK_PROJECTS/Git/PortableGit/bin/`.

---

## Part 5: Copy Your Project (on your Mac)

1. Connect the external drive to your Mac.
2. Copy your project folder (e.g. `FireUltimate-V1.0.0.0`) into `WORK_PROJECTS/Projects/`.
3. Do **not** copy `node_modules` (large and platform-specific).
4. Make sure the `.git` folder is copied so you keep version history.

---

## Part 6: Create a Launch Script for Windows (on your Mac)

Create a file on the drive so you can start Cursor with the correct PATH on the work computer.

1. On your Mac, create `WORK_PROJECTS/START_HERE.bat` with this content (adjust drive letter if needed):

```batch
@echo off
REM Set drive letter - change E: to your drive letter if different
set DRIVE=E:
set DRIVE_PATH=%DRIVE%\WORK_PROJECTS

REM Add Node and Git to PATH for this session
set PATH=%DRIVE_PATH%\Node\node;%DRIVE_PATH%\Git\PortableGit\bin;%PATH%

REM Launch Cursor from the drive
start "" "%DRIVE_PATH%\Cursor\Cursor.exe"

REM Keep this window open so PATH stays set - open a new terminal in Cursor for npm/git
cmd /k
```

2. Save the file. When you use it on the work computer, change `E:` to the actual drive letter of your external drive (e.g. `D:` or `F:`).

---

## Part 7: Using the Setup on the Work Computer (Windows)

### Step 1: Connect the Drive

1. Connect the external drive to the work computer.
2. Wait for it to appear (e.g. `E:` or `D:`).
3. Note the drive letter in File Explorer.

### Step 2: Update the Launch Script (if needed)

1. Open `WORK_PROJECTS/START_HERE.bat` in Notepad.
2. Replace `E:` with your actual drive letter.
3. Save and close.

### Step 3: Run Cursor

1. Double-click `WORK_PROJECTS/START_HERE.bat`.
2. A command window will open and Cursor should start from the drive.
3. Keep that command window open while you work (it sets PATH for Node and Git).

### Step 4: Open Your Project

1. In Cursor: **File** → **Open Folder**.
2. Browse to the drive → `WORK_PROJECTS/Projects/FireUltimate-V1.0.0.0`.
3. Click **Select Folder**.

### Step 5: Use the Integrated Terminal

1. In Cursor, open the terminal: **Ctrl+`** or **View** → **Terminal**.
2. Because you launched Cursor via `START_HERE.bat`, the terminal should inherit the PATH with Node and Git.
3. If not, close Cursor, run `START_HERE.bat` again, then open Cursor and the project.

### Step 6: Install Dependencies

In the Cursor terminal:

```bash
npm install
```

(or `yarn`, `pnpm`, etc., depending on your project).

---

## Part 8: Alternative – Terminal-Only PATH

If the batch script doesn't set PATH for Cursor's terminal, run this in the Cursor terminal each time you open the project (replace `E:` with your drive letter):

```batch
set PATH=E:\WORK_PROJECTS\Node\node;E:\WORK_PROJECTS\Git\PortableGit\bin;%PATH%
```

Then run `npm install` and other commands as usual.

---

## Part 9: Daily Workflow

### Leaving home (Mac)

1. Save all files.
2. Commit and push if you use Git and have internet.
3. Eject the drive safely.

### Arriving at work (Windows)

1. Connect the drive.
2. Run `START_HERE.bat` (or double-click Cursor in the Cursor folder).
3. Open the project folder in Cursor.
4. Run `npm install` if dependencies changed.
5. Work as usual.

### Leaving work

1. Save and commit.
2. Eject the drive safely.

### Back at home (Mac)

1. Connect the drive.
2. Open the project from the drive in Cursor on your Mac (or copy changes back to your main project folder if you prefer).

---

## Checklist Summary

- [ ] Format external drive as **exFAT** on Mac.
- [ ] Create `WORK_PROJECTS` folder structure on the drive.
- [ ] Download and extract **Windows Cursor** on Mac → copy to drive.
- [ ] Download **Node.js Windows zip** on Mac → extract to `Node/` on drive.
- [ ] Download **Portable Git for Windows** on Mac → extract to `Git/` on drive.
- [ ] Copy project (without `node_modules`) to `Projects/` on drive.
- [ ] Create `START_HERE.bat` and set the correct drive letter.
- [ ] Test on the work computer: run script, open project, run `npm install`.

---

## Important Notes

| Topic | Notes |
|-------|-------|
| **Drive letter** | May change between computers; update `START_HERE.bat` if needed. |
| **Cursor extraction** | If you can't extract the installer on Mac, use any Windows machine once to install to the drive. |
| **node_modules** | Don't copy; run `npm install` on the work computer each time dependencies change. |
| **Performance** | Prefer USB 3.0+ and an SSD for faster loading. |
| **IT policies** | Some workplaces block running apps from external drives; test first. |
| **Backups** | Keep a backup (e.g. cloud or second drive) in case the drive fails. |

---

## If Cursor Won't Run from the Drive

Some work environments block executables on removable drives. Options:

1. **VS Code Portable** – Download the Windows zip from [code.visualstudio.com](https://code.visualstudio.com) and use it as a fallback (no Cursor AI features).
2. **Ask IT** – Request an exception for running Cursor from your personal drive.
3. **Use only for files** – Use the drive for project files and edit with Notepad or another allowed editor, then sync back to your Mac for full Cursor use.
