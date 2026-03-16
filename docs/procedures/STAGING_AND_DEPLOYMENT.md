# Staging and deployment (source of truth)

**Purpose:** So agents and developers don’t have to ask which branch staging uses or what “push” vs “redeploy” means. Use this as the single reference.

---

## Staging branch and Render

- **Staging** is **\*.staging.fireultimate.app** (any tenant subdomain, e.g. **cifpdil.staging.fireultimate.app**). Staging is built from the branch **`submenu/neris-golive-cifpd`**.
- **Deployment** is done via **Render**. The staging API and/or web service(s) on Render are configured to deploy from that branch.
- When Render’s dashboard shows the **latest commit `462f6e2`** (or a later commit on that branch) as **deployed**, that is the version currently running on staging. No need to ask whether staging “has” the latest code—check Render’s deploy status for that commit.

---

## Commit before push

Whenever **git push** is used, **git commit** must be used first. Push only sends already-committed changes to the remote. So the usual sequence is: make changes → **`git add ...`** → **`git commit -m "..."`** → **`git push origin <branch>`**.

---

## “Push the branch” vs “Redeploy on Render”

- **Push the branch** means running **`git push origin submenu/neris-golive-cifpd`** (or the relevant branch). That only updates the **remote repository** (e.g. GitHub). It does **not** by itself change what is running on Render.
- **Redeploy on Render** means triggering a **new deployment** of the staging (or production) service **on Render**. That is what actually updates the running app/API.
  - If Render is set to **auto-deploy** from `submenu/neris-golive-cifpd`, then a **push** to that branch will trigger a new deploy. In that case, “push the branch” effectively leads to a redeploy.
  - If you want the running app to change **without** pushing new commits (e.g. to re-run the same commit), you must use Render’s **Manual Deploy** or “Clear build cache & deploy” (or equivalent) in the Render dashboard. That is a **redeploy on Render** only.
- **Summary:** “Push” = update Git remote; “Redeploy on Render” = run a new build/deploy on Render so the live service uses the latest code (from the last push, or the same commit again). For staging to show the latest fixes, the commit (e.g. 462f6e2) must be **deployed on Render**; pushing is only the way to get that commit to the branch Render builds from.
