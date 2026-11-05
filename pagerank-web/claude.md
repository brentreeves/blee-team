# PageRank Teams (web)

Single-page browser app that reproduces [pagerank-teams.py](pagerank-teams.py): read a CSV of ranked student
preferences, treat it as a weighted directed graph, rank people by PageRank, then greedily form teams by
walking down that ranking. Everything runs locally in the browser — no server, no upload, no network calls.

## Deliverable

- **One file:** `index.html`. Markup, CSS, and JavaScript are all embedded in it. Opening it from `file://`
  with a double-click must fully work.
- **No dependencies.** No CDN links, no `<script src>` to anything external, no build step, no npm install,
  no framework. PageRank is reimplemented in plain JavaScript — `networkx` is not available in the browser.
- **No data leaves the page.** No fetch/XHR/beacon, no analytics. Student names are the input.

## Purpose

The page replaces this shell pipeline:

```bash
python3 pagerank-teams.py -s 3 -w "[13,8,5,3,2,1]" -t "CS374 F26" < 26F-CS374-prefs.txt
```

with a form: paste the CSV, set size/weights/title, press a button, read the same three reports.

## Input format

One row per person, no header:

```csv
name,first_choice,second_choice,third_choice,fourth_choice,fifth_choice,sixth_choice
```

Parsing rules, matching Python's `csv.reader` closely enough for this data:

- Split on commas; honor double-quoted fields (so a quoted name may contain a comma).
- Trim surrounding whitespace from each cell.
- Skip blank lines and rows whose first cell is empty.
- Names are opaque strings and are matched **exactly** (the sample data uses `First_Last` with underscores).
  Do not lowercase, fuzzy-match, or normalize them.
- A person named as someone's choice does not need a row of their own.
- **A choice may be prefixed with `-`** (`-Dana`) meaning "do not put me on a team with this person."
  Whitespace after the dash is tolerated (`- Dana`). A bare `-` is an error.

[26F-CS374-prefs.txt](26F-CS374-prefs.txt) is the reference input and must be embedded in the page as a
"Load sample class" button.

## Controls

Each CLI flag becomes a form field, with the same defaults:

| CLI | Control | Default |
| --- | --- | --- |
| `-s/--size` | Team size, integer ≥ 2 | `3` |
| `-w/--weights` | Weights, comma-separated | `13,8,5,3,2,1` (reverse Fibonacci) |
| `-t/--title` | Title, free text | `Preferences` |
| stdin | CSV textarea | empty, with sample-load button |

The weights field accepts a bare list (`13,8,5,3,2,1`) and also tolerates surrounding brackets, since the
Python default is the string `"[13,8,5,3,2,1]"`. Reject non-numeric entries with an inline error rather than
silently substituting defaults. Offer the two commented-out alternates from the script as one-click presets:
linear `6,5,4,3,2,1` and reverse Fibonacci from 21 `21,13,8,5,3,2`.

## Negative preferences

A `-` prefix inverts the sign of a choice while keeping its magnitude: a negative name in position *i* is
worth `-weights[i]`, exactly the points that position would otherwise have earned. Three consequences, in
three different places:

1. **The graph.** A negative entry never becomes an edge. PageRank normalizes each node's out-edge weights
   into a probability distribution, and a negative weight breaks that — a row sum can reach zero or go
   negative, and the scores stop summing to 1. A `-` entry is simply not an endorsement, so it is withheld
   from the graph and carried in a separate scoring map. It still costs the target the endorsement they
   would otherwise have received, so disliked people do drift down the ranking.
2. **Team filling.** The greedy fill skips `-` entries outright. You are never seated with someone from
   your own negative list.
3. **Happiness.** The penalty lands here — see below.

A negative preference is a **penalty, not a constraint**. The greedy fill only ever consults the seed's own
preference list, so a person you marked `-` can still arrive on your team through a *third party's* list.
That is the case the happiness score exists to expose: it is reported, flagged, and subtracted, but not
prevented.

People named only negatively (never positively, and with no row of their own) still join the roster as
nodes, so they appear in the ranking and in the unassigned list rather than vanishing.

## Happiness

`value(A → X)` is `+weights[i]` if X is A's *i*-th choice, `-weights[i]` if X appears there as `-X`, and `0`
if A never listed X. Then:

- `memberHappiness(A, team)` = Σ `value(A → X)` over teammates X ≠ A
- `teamHappiness(team)` = Σ `memberHappiness` over its members

A name mentioned twice by the same person keeps its **last** mention, matching the last-duplicate-wins edge
rule — so `B, C, D, -B` ends negative. Self-references score nothing. Positions beyond the end of the
weights list are worth 0.

## Algorithm

Reproduce these three stages in order. Getting the details right matters more than getting them elegant —
the page must agree with the Python script digit for digit.

### 1. Weighted edges

For each row, emit a directed edge from `row[0]` to each of **at most the first six** choices (`row[1:7]`),
weighted by position: choice *i* gets `weights[i]`.

- Negative (`-`) choices are skipped entirely — no edge, at any position.
- Only the first six choices become edges, even if a row has more.
- If a row has fewer than six choices, only that many edges are emitted.
- If `weights` is shorter than the number of choices present in a row, that is an error — Python raises
  `IndexError` here. Report it in the UI instead of crashing.
- **Duplicate edges collapse, last one wins.** `add_weighted_edges_from` overwrites, so a row that names the
  same person twice keeps only the *later*, lower weight. The sample data relies on this: `Mya_Hargrave`
  lists `Zander_Ragsdale` first (13) and again sixth (1), and the surviving edge weight is **1**. The
  resulting graph has 12 nodes and **71** edges, not 72. Implement the edge store as a map keyed by
  `(source, target)` so this falls out naturally.
- Self-loops (a person listing themselves) are kept, not dropped.
- Node insertion order is the order nodes are first seen while scanning edges — source, then target, edge by
  edge. Preserve it; it decides tie-breaks later.

### 2. PageRank

Match `nx.pagerank(G, alpha=0.85)` exactly. That means the full NetworkX contract, not a hand-waved version:

- Row-normalize out-edge weights: each node's out-edges are divided by the sum of its out-edge weights.
- `N` = node count. Initial vector `x[n] = 1/N`. Personalization and dangling vectors are both uniform
  `1/N`.
- Iterate up to `max_iter = 100`:

  ```text
  danglesum = alpha * Σ x[i]  for every i with no out-edges
  x_new[j]  = alpha * Σ_(i→j) x[i] * W[i][j]  +  danglesum * (1/N)  +  (1 - alpha) * (1/N)
  ```

- Convergence test is the **L1 sum, scaled by N**: stop when `Σ_n |x_new[n] - x[n]| < N * 1e-6`.
- If 100 iterations pass without converging, NetworkX raises `PowerIterationFailedConvergence`. Surface that
  as a visible error rather than showing unconverged numbers as if they were final.
- Dangling nodes (named as a choice but having no row of their own) redistribute their mass uniformly. The
  sample data has none, but the code path must exist.

Sort descending by score. Use a **stable** sort so equal scores stay in node-insertion order, matching
Python's `sorted(..., reverse=True)`.

### 3. Team formation

Greedy, seeded by rank — port `preference_teams` faithfully, including its quirks:

1. Build `preferences[name] = row[1:]` — here **all** remaining cells count, not just the first six. This
   differs deliberately from the six-choice cap used for edges.
2. Walk the PageRank ranking from highest to lowest. Skip anyone already assigned or with no row of their own.
3. Seed a team with that person, then walk their preference list in order, **skipping any `-` entry**, and
   adding each unassigned name until the team reaches `size`.
4. **If the team cannot be filled, roll the whole thing back** — including the seed. Those people return to
   the unassigned pool. The seed is not retried as a seed (the outer loop has moved past them), but they
   remain eligible to be picked up as someone else's choice further down the ranking.
5. Duplicate names within one preference list are harmless: the second occurrence is already assigned and is
   skipped.

Anyone left unassigned when the walk ends is simply not on a team. The Python script silently drops them
(its own `# Todo: handle case where person gets none of their prefs`). **The web app must not drop them
silently** — show a clearly labeled "Unassigned" section listing them. Do not invent an extra rule to place
them; the assignment logic itself stays identical to the Python.


## UI requirements

- Single column, readable at laptop and projector sizes; this gets shown to a class.
- Controls at the top, results below; results appear without a page reload.
- Monospace for score and team output so columns line up.
- Validation errors appear inline next to the offending control, and never wipe the user's pasted CSV.
- Keep the page's own state in the DOM. No `localStorage` requirement — a reload starting empty is fine.

## Out of scope

- The script's `teams()` function (naive chunking of the sorted list into groups of `size`) is dead code —
  `main` never calls it. Do not implement it.
- Negative preferences are deliberately **not** a hard constraint — no re-seating, no conflict-avoiding
  candidate search, no re-optimization to separate people who dislike each other. If that changes, it is a
  new requirement, not a bug fix.
- No optimization or hill-climbing search. That is the sibling [team-builder-web](../team-builder-web)
  project, which solves a different problem (maximize total happiness) and should not be conflated with this
  one. This app is deterministic: same input, same output, every time. No randomness, no seed.
- No editing of preferences in a grid, no CSV upload dialog, no export beyond copy-to-clipboard.

## Notes for future Claude sessions

- Do not "fix" the quirks documented above (six-choice edge cap vs. full-list team fill, last-duplicate-wins
  edge weights, whole-team rollback). They are the behavior being reproduced, and changing any of them
  changes the sample output.
- Keep the ranking/team logic in one clearly marked block in the script (`ALGORITHM START` / `ALGORITHM END`)
  so it can be extracted and tested by Node, as the sibling project does.
- If you change the algorithm, re-run the acceptance test above before reporting it works.
