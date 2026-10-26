# Lockfile merge conflict

Use this when git reports a conflict in `pakku-lock.json`. Pakku has no command that regenerates the lock from a conflict (Pakku issue #142), so resolve by choosing one side and re-applying the other side's changes.

## Steps

1. Take the **target branch's** lock (correct for both merge and rebase):

    ```sh
    git checkout origin/main -- pakku-lock.json
    ```

    Do not use `git checkout --ours`: in a `git merge main` on a feature branch "ours" is the feature branch, so main's lock changes (such as the weekly bot updates) would be dropped. Only in a rebase is "ours" the branch you are rebasing onto.

2. Re-apply your changes with the tasks, never by editing the JSON:

    ```sh
    task mods:add -- <slug>
    task mods:rm -- <slug>
    ```

3. For the weekly update PR, just close it and re-run the "Mod updates" workflow: the bot is the only automated writer of the lock.
4. Mark resolved: `git add pakku-lock.json pakku.json`, then continue the merge or rebase.

## Verify it worked

`git diff origin/main -- pakku-lock.json` shows only your intended mod changes, `task doctor` is green and `task build` succeeds.
