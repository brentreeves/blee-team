# Gale-Shapley Teams (web)

Single static page, `gale-shapley.html`. Markup, CSS and JS are all embedded, it works from `file://`,
it has no dependencies, and no data leaves the page. Siblings: `../blee-team-web` (hill-climbing for
total happiness) and `../pagerank-web` (PageRank + greedy). All three use the same CSV format,
`-` negative prefix, and happiness score. Keep them comparable.

## Model (decided; don't silently change)

- Roster = people with a row, in row order. Names with no row are reported in `ignored`, not seated.
- `value(a→b)` = +w[i] / −w[i] for a's i-th choice (last mention wins). Past the weights list it is 0.
- T = max(1, floor(n / size)) teams. Capacities differ by at most one; the first teams get the extras.
- Captains: by default the top T by points received (`popularity`), ties broken by row order. A manual
  list must name exactly T people from the roster.
- Lists are complete and strict:
  - member ranks captains by value(m→c), then value(c→m), then captain order
  - captain ranks members by value(c→m), then value(m→c), then popularity, then roster order
- Hospitals/residents deferred acceptance, in a members-propose or captains-propose variant. Both are
  deterministic: no randomness, no seed.
- `blockingPairs` is the stability check. The UI shows its result, it is not just assumed.

## Notes for future sessions

- The logic lives between `ALGORITHM START` / `ALGORITHM END`. `tests/verify.mjs` extracts it, so
  keep that block free of DOM code.
- After changing the algorithm, run `node tests/verify.mjs`. It brute-forces stable matchings to
  check the member-optimal and member-pessimal properties.
- The test reads the real class file from `../26F-CS374-prefs.txt`. The page embeds only an
  anonymized copy (same shape, fake names), like pagerank-web does.
- Members are matched to captains only. Making members care about each other (stable roommates,
  coalition stability) would be a new algorithm, not a bug fix.
