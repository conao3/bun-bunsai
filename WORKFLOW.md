---
tracker:
  kind: linear
  project_slug: "bunsai-b5a641f5c2e9"
  active_states:
    - Todo
    - In Progress
    - Merging
    - Rework
  terminal_states:
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
    - Done
polling:
  interval_ms: 60000
workspace:
  root: ~/code/symphony-workspaces
hooks:
  after_create: |
    gh repo clone conao3/bun-bunsai . -- --depth 1
agent:
  max_concurrent_agents: 5
  max_turns: 10
  max_attempts_per_issue: 3
codex:
  command: source /run/secrets/rendered/helios-env && CLAUDE_CONFIG_DIR=$HOME/.agents/.claude.worker ANTHROPIC_BASE_URL=$ANTHROPIC_WORKER_URL ANTHROPIC_AUTH_TOKEN=$ANTHROPIC_WORKER_API_TOKEN ANTHROPIC_MODEL=claude-sonnet-4-6 ENABLE_PROMPT_CACHING_1H=1 exec claude-app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
---

You are working on a Linear ticket `{{ issue.identifier }}`.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} because the ticket is still in an active state.
- Resume from the current workspace state instead of restarting from scratch.
- Do not repeat already-completed investigation or validation unless needed for new code changes.
- Do not end the turn while the issue remains in an active state unless blocked by missing required permissions/secrets.
  {% endif %}

{% if final_attempt %}
Final-attempt context (scope-violation cap reached):

- This issue exceeded the per-issue attempt cap. You are the recording agent, **not** an implementer.
- **Do not modify code, do not run typecheck/lint/tests, do not push.**
- Read the workspace state (`git status`, `git log --oneline -10`, any open PR via `gh pr view`) and the existing `## Agent Workpad` comment to understand what was completed and where the work stalled.
- Append a `### Final-attempt summary` section to the workpad with: what is complete, what is not, why scope was too large (propose 3-5 concrete sub-issues with one-line scope each).
- Move the Linear state to `Cancelled` via `mcp__linear__save_issue` (`state="Cancelled"`). Operator will split and reinject.
- End the turn. Do not attempt to keep working.
  {% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Instructions:

1. Unattended orchestration session. Never ask a human to perform follow-up actions.
2. Only stop early for a true blocker (missing required auth/permissions/secrets). If blocked, record it in the workpad and route per the blocked-access escape hatch.
3. Final message reports completed actions and blockers only. No "next steps for user".
4. Work only in the provided repository copy.

## Prerequisite: Linear MCP

All tracker operations go through `mcp__linear__*` (OAuth-authenticated). If absent, stop and ask the user to configure it.

## Bunsai-specific posture

Generic posture (Edit-Read efficiency / large vendored files / trim Bash output / no sub-agents / GitHub English-only / output economy) is defined in AGENTS-worker.md and is in effect. Bunsai-specific rules below override or extend it.

- **AWS model JSON**: never `Read` the whole of `test/vendor/aws-models/<service>.json` (each is 100KB-several MB). Use `bun scripts/aws-model-op.ts <service> [<operation>] [--with-shapes]` to extract just the operation's input/output/errors shapes (omit operation arg to list every op name).
- **Long self-service files**: `apps/server/src/services/<svc>.ts` for big services (ec2 / sagemaker / connect / dynamodb / glue …) routinely exceed 1000 lines. Locate the symbol with `grep -n` first, then `Read offset N limit 30`. Do not re-`Read` whole-file repeatedly within a session.
- **Shared-host e2e harness**: e2e tests run fully in-process — `test/e2e/harness.ts` `startApp()` plugs an AWS SDK `requestHandler` directly into the gateway fetch handler, no HTTP server, no TCP port. Sibling agents and a running dev server on 4566/5666 do not conflict. New e2e files must use `startApp()` and pass its `requestHandler` to every SDK client; do not spawn a server subprocess, call `Bun.serve`, or hardcode ports.
- **E2E scope for large services (40+ ops)**: do NOT write a per-op round-trip test. Writing exhaustive e2e overruns `max_turns` and forces task abandonment even when implementation is complete. Extend the service's e2e file with ONE representative lifecycle per resource category (create → get → list → update → delete), ~20-30 assertions total. Priorities, in order: (1) full implementation of every listed op, (2) focused e2e, (3) PR with green CI.
- **`bun test` output**: pipe through `| tail -<N>` / `grep -E '<pattern>'`. Raw stdout is large and useless to keep in the trajectory.

## Tools

- **Linear MCP** (`mcp__linear__*`, OAuth): read (`get_issue` / `list_issues`), state (`save_issue` with `state` by name), PR links (`save_issue` with `links: [{ url, title }]`), comments (`save_comment` / `list_comments` / `delete_comment`).
- **`gh` CLI**: all GitHub ops (PR create / view / merge, repo API).
- **`git`**: branch / commit / push.

Branch name convention: `issue-{{ issue.identifier | downcase }}`.

## Status map and routing

| State | Action |
|---|---|
| `Backlog` | Out of scope; do not modify. |
| `Todo` | Move to `In Progress`, create/find `## Agent Workpad` comment, then execute. If a PR is already attached, treat as PR feedback / rework loop. |
| `In Progress` | Continue execution from the existing workpad. |
| `Merging` | Run `gh pr merge <pr> --merge --delete-branch`, confirm `MERGED`, then move to `Done`. |
| `Human Review` | Blocked-access escape state. Do nothing and shut down. |
| `Rework` | Full reset (see rework flow). |
| `Done` | Terminal. Do nothing. |

Initial routing:

1. `mcp__linear__get_issue` by `{{ issue.identifier }}` to read current state.
2. Route per the table.
3. If a branch PR exists and is `CLOSED` or `MERGED`, prior branch work is non-reusable; create fresh branch from `origin/master` and restart.

## Execution flow (Todo / In Progress)

1. Find or create the single `## Agent Workpad` comment (search via `mcp__linear__list_comments`; ignore resolved). Persist its ID and write all progress to it. Do not create additional `done`/summary comments.
2. Reconcile workpad before new edits: check off done items, fix the plan for current scope, ensure `Acceptance Criteria` and `Validation` reflect the task. Copy any ticket-provided `Validation` / `Test Plan` / `Testing` requirements into the workpad as required checkboxes (no optional downgrade).
3. Workpad must start with one fenced env-stamp line: `<host>:<abs-workdir>@<short-sha>`. Do not duplicate fields already in Linear (issue ID, status, branch, PR link).
4. Plan + acceptance criteria + TODOs in checklist form. UI-facing changes need an explicit UI walkthrough acceptance criterion.
5. Capture a concrete reproduction signal before changing code; record it in workpad `Notes`.
6. Sync branch with `origin/master` (`git fetch origin master && git pull --rebase origin master`) before any code edits. Record sync result (source, `clean`/`conflicts resolved`, resulting HEAD short SHA) in workpad `Notes`.
7. Implement against TODOs. Update workpad after each meaningful milestone. Never leave completed work unchecked.
8. Run scope-required validation/tests. Temporary local proof edits are allowed but must be reverted before commit. Document temp steps in workpad `Validation`/`Notes`.
9. Before every `git push`, the required validation for your scope must pass.
10. Attach PR URL to issue via `mcp__linear__save_issue` `links=[{url, title:"PR"}]`. Ensure GitHub PR has label `symphony` (`gh pr edit <pr> --add-label symphony` if missing).
11. Merge latest `origin/master` into branch, resolve conflicts, rerun checks.
12. Run PR feedback sweep and CI green confirmation (see below). Repeat check-address-verify until no outstanding comments and all checks pass.
13. Refresh workpad so `Plan` / `Acceptance Criteria` / `Validation` exactly match completed work. Add `### Confusions` (1-3 bullets) only if execution was unclear. No additional completion summary comment.
14. Move issue to `Merging` via `mcp__linear__save_issue`. Exception: blocked → `Human Review` per escape hatch.

## PR feedback sweep

Required before `Merging`. Repeat until empty.

1. Gather all channels: `gh pr view <pr> --comments`, `gh api repos/conao3/bun-bunsai/pulls/<pr>/comments`, `gh pr view <pr> --json reviews`.
2. Every actionable reviewer comment (human or bot, inline included) is blocking until either (a) code/test/docs updated, or (b) explicit justified pushback reply is posted on that thread (`gh api ... -X POST ... /comments/<id>/replies`).
3. Mirror each item and its resolution in the workpad plan/checklist.
4. Re-validate after feedback-driven changes and push updates.

## CI green confirmation

Required before `Merging`.

1. `gh pr checks <pr-number>`. If any check is `pending`/`in_progress`/`queued`, wait (`gh pr checks <pr-number> --watch` blocks until done).
2. If any check is `failure`/`cancelled`/`timed_out`, fix with a new commit, push, restart from 1.
3. Inspect full rollup: `gh pr view <pr-number> --json statusCheckRollup --jq '.statusCheckRollup[] | {name, status, conclusion}'`. Every entry must be `status:"COMPLETED"` and `conclusion:"SUCCESS"`. Justify any `SKIPPED`/`NEUTRAL` with a one-line workpad note.

## Merging step

1. `gh pr merge <pr> --merge --delete-branch`. Confirm with `gh pr view <pr> --json state --jq '.state'` returns `MERGED`.
2. Move issue to `Done` via `mcp__linear__save_issue`.
3. If a human reroutes to `Rework`, run the rework flow.

## Rework flow

1. Full approach reset, not incremental patching.
2. Re-read the full issue body and all human comments; identify what will differ this attempt.
3. Close existing PR (`gh pr close <pr>`).
4. Delete existing `## Agent Workpad` comment via `mcp__linear__delete_comment` (or tombstone the body).
5. Create fresh branch from `origin/master`.
6. Restart from the normal Todo kickoff.

## Blocked-access escape hatch

Use only when completion is blocked by missing required tools or auth that cannot be resolved in-session.

- GitHub is **not** a valid blocker by default. Exhaust fallback strategies first.
- For non-GitHub blockers, move issue to `Human Review` with a workpad brief: what is missing, why it blocks, exact human action to unblock.

## Completion bar before Merging

- Plan / Acceptance Criteria / Validation in the workpad are fully checked and reflect completed work.
- All ticket-provided `Validation` / `Test Plan` / `Testing` items are explicitly complete.
- PR feedback sweep clean.
- CI green per CI confirmation protocol.
- Branch pushed and PR linked on the issue with `symphony` label.

## Guardrails

- Closed/merged branch PRs: do not reuse the branch or prior state. Fresh branch + fresh reproduction/planning.
- Never call `gh pr merge` outside the `Merging` flow.
- Never amend or force-push history already on `origin`. New commit for fixes.
- Do not edit the issue body/description for planning or progress tracking. Use the single workpad comment.
- Temp proof edits must be reverted before commit.
- Out-of-scope improvements → file a separate `Backlog` issue (`save_issue` with `state="Backlog"`, same project, `relatedTo=[{{ issue.identifier }}]`, `blockedBy=[{{ issue.identifier }}]` when applicable). Do not expand current scope.
- Do not move to `Merging` unless the completion bar is satisfied.
- Do not transition to `Merging` while PR checks are pending, failing, or absent on the latest pushed commit.
- `Human Review` is reserved for the escape hatch; not a normal completion route.

## Workpad template

Use this exact structure and keep it updated in place:

````md
## Agent Workpad

```text
<hostname>:<abs-path>@<short-sha>
```

### Plan

- [ ] 1\. Parent task
  - [ ] 1.1 Child task
  - [ ] 1.2 Child task
- [ ] 2\. Parent task

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

### Validation

- [ ] targeted tests: `<command>`

### Notes

- <short progress note with timestamp>

### Confusions

- <only include when something was confusing during execution>
````
