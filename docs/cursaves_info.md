# cursaves Info

Quick reference for managing Cursor conversation sync with [cursaves](https://github.com/Callum-Ward/cursaves).

---

## Snapshot vs Conversation

| Term | Meaning |
|------|---------|
| **Conversation** | The live chat in Cursor — stored in Cursor's local SQLite DB. What you see in the chat sidebar. |
| **Snapshot** | A saved copy of a conversation — exported as JSON to `~/.cursaves/snapshots/`. Used for syncing between machines. |

---

## Deleting Snapshots

Deleting snapshots removes them from the sync repo so they won't be pulled again on other machines. Run from your project directory.

### Step 1: See what's stored

```bash
cursaves list
```

### Step 2: Delete using one of these options

| Option | Command | Use when |
|--------|---------|----------|
| **Interactive select** | `cursaves delete --select` | You want to pick which conversations to remove |
| **Delete all (project)** | `cursaves delete --all --yes` | You want to remove all snapshots for this project |
| **Delete by ID** | `cursaves delete --id <partial-id>` | You know the conversation ID and want to remove one |
| **Delete all projects** | `cursaves delete --all-projects --yes` | You want to remove snapshots across every project |

### Step 3: Push the deletions to remote

```bash
cursaves push
```

This commits the deletions and pushes to your cursaves repo. Future `cursaves pull` on any machine won't bring those conversations back.

---

## Deleting Conversations from Cursor (to speed up Cursor)

`cursaves delete` only affects the sync repo — it does **not** remove chats from Cursor's local database. To reduce Cursor's load:

1. Open the chat sidebar in Cursor
2. Right-click a conversation
3. Choose **Delete**

Repeat for conversations you no longer need. This shrinks Cursor's SQLite DB and can improve performance.

---

## Full Delete Workflow

1. **Clean up sync repo** (stop old conversations from syncing):
   ```bash
   cursaves delete --select    # or --all --yes
   cursaves push
   ```

2. **Clean up Cursor** (speed up the app):
   - Delete old conversations from the chat sidebar in Cursor

3. **On other Macs**:
   - Run `cursaves pull` to get the updated state without the deleted snapshots
