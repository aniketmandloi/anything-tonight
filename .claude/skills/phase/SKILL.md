---
name: phase
description: Start or resume the next phase of the Anything Tonight build — rebuilds context from GitHub Issues, docs/PLAN.md and git, then works the phase's tickets one by one.
argument-hint: "[phase number]"
disable-model-invocation: true
---

# /phase: work one phase of the plan

Phase requested: `$ARGUMENTS` (empty = the lowest phase with open issues).

## 1. Rebuild context (read-only, in parallel)
- `CLAUDE.md` is already loaded; follow its Workflow rules exactly.
- `gh api repos/aniketmandloi/anything-tonight/milestones?state=all --jq '.[] | "\(.number) \(.title) \(.state) open=\(.open_issues) closed=\(.closed_issues)"'`
- `gh issue list --milestone "<phase milestone title>" --state all --limit 50 --json number,title,state,labels`, then read each open issue's body and comments (`gh issue view N --comments`). Comments hold "Waiting on" notes from earlier chats.
- `git status`, `git log --oneline -15`, and whether `main` is ahead of `origin/main`.
- The relevant section of `docs/PLAN.md` for this phase.
- Which `.env` keys are set, printing names only and never values:
  `awk -F= '/^[A-Z_]+=/{print $1": "(length(substr($0,index($0,"=")+1))>0?"set":"EMPTY")}' .env`

## 2. Report before coding
In about five lines: the phase, its open tickets in order, any `needs-user` blockers (missing env keys, provisioning), and uncommitted or unpushed work. If a blocker stops the first ticket, ask for it and stop. Otherwise start.

## 3. Work each open ticket in number order
For each ticket:
1. Check the latest versions or docs of any new dependency or API before using it.
2. Implement in small atomic commits ending with `(#N)`. Each commit passes `pnpm lint`, `pnpm typecheck` and `pnpm test`.
3. Verify against the ticket's acceptance criteria. Say plainly what could not be verified, e.g. anything that needs a running server or a push.
4. Close the issue with a comment listing the commits, what was verified, and anything deferred. If it needs the user, leave it open with a "Waiting on:" comment and move on to the next ticket that isn't blocked.
5. Add any non-obvious decision or gotcha to `CLAUDE.md` → "Decisions & gotchas", in the same commit as the change.

Give the user a one-line update between tickets. Don't go past the phase boundary.

## 4. Close the phase
- When every issue is closed, close the milestone:
  `gh api repos/aniketmandloi/anything-tonight/milestones/<n> -X PATCH -f state=closed`
- Ask before pushing. After a push, watch CI (`gh run watch`) and report the result.
- Finish with a summary: what shipped, what's still open and why, and exactly what the user needs to provide before the next phase (keys to add to `.env`, services to provision). Tell them it's safe to `/clear` and run `/phase` again.
