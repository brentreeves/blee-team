# Gale-Shapley Teams

One self-contained file: open `gale-shapley.html` by double-clicking it.
No server, no node, no build step, no network. The preferences you paste never leave your machine.

This is the third take on the CS374 team problem, next to `../blee-team-web` (random-swap search
for the most total happiness) and `../pagerank-web` (PageRank, then greedy fill).
It uses the same CSV and the same weights, so you can compare the three outputs directly.

## Use

Paste the preference CSV (one row per person: `name, 1st choice, 2nd choice, ...`).
Prefix a choice with `-` when the person does not want that teammate.
Or press **Load sample class**, then **Build teams**.

| Field | Meaning |
| --- | --- |
| Title | Heading on the report |
| Team size | People per team. Leftover people are spread one per team, so team sizes differ by at most one |
| Weights | Points for 1st, 2nd, … choice. Off the list scores 0, a `-` choice scores minus that weight |
| Who proposes | Members propose (the default) or captains propose. See below |
| Captains | Optional: name one captain per team. Blank picks the most-wanted people |

## How it works

Gale-Shapley matches two groups, so the page splits the class into two:

1. **Captains.** There is one captain per team. By default these are the people with the most
   preference points from everyone else's lists. That spreads the class favorites across different teams.
2. **Members.** Everyone else. Each team has (team size − 1) member seats.

Each member ranks every captain by the points they gave that captain. Ties go to whichever captain
gave the member more points. Each captain ranks every member the same way. Then deferred acceptance runs:

- **Members propose:** each unplaced member asks their next captain. The captain holds the best
  offers that fit in their seats and turns down the rest. This repeats until everyone is held.
- **Captains propose:** each captain with an open seat asks their next member. The member keeps the
  best captain who has asked so far.

The result is **stable**: no member and captain would both rather be together than with what they got.
When members propose, every member gets the best captain they can have in any stable matching.
When captains propose, every captain does best and every member does worst.
The page checks stability itself and says `NOT stable` in red if the check fails.

## What it does not do

Gale-Shapley only sees member-to-captain preferences. It does not consider how two members of the
same team feel about each other. So:

- The **happiness** score is the same one the other two apps use: points for every teammate,
  not just the captain. It shows how good the teams are overall, and it is usually lower than
  blee-team's optimized total. That gap is the price of stability.
- Two members who dislike each other can still pick the same captain. When that happens the page
  lists it under *Negative pairings*. It does not prevent it.
- People named in a list but with no row of their own are reported and not seated.

The page also has a step-by-step **proposal log** and the exact **preference lists** it used, for
showing the algorithm to a class.

## Verifying

```
node tests/verify.mjs
```

Only the test needs node, not the page. It pulls the `ALGORITHM` block out of `gale-shapley.html`
and checks that:

- everyone is placed exactly once
- team sizes are balanced
- there are no blocking pairs
- the textbook two-by-two cases come out right

It also brute-forces every stable matching for the CS374 class and for 150 random classes. That
confirms members-propose is best for every member and captains-propose is worst for every member.
