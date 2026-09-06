# Team Builder (web)

One self-contained file: open `blee-team.html` by double-clicking it. No server, no node, no build step, no network
— the whole search runs in the page, and the preferences you paste never leave
your machine.

## Using it

Paste the preference CSV (one row per person: `name, 1st choice, 2nd choice, …`).
Prefix a choice with `-` when the person does not want that teammate; the
negative choice uses the same weight as its position, but subtracts from
their happiness when they are on the same team.
or press **Load sample class**, set the fields, and press **Build teams**.

| Field | Command line equivalent | Meaning |
| --- | --- | --- |
| Title | `-t` | Heading on the report |
| Weights per choice | `-w` | Points for 1st, 2nd, … choice. Off the list scores 0 |
| Team size | `-s` | People per team; the last team takes the remainder |
| Member cap | `-r` | Nobody more than this many times happier than anybody else. 0 turns it off |
| Team gap | `-d` | Largest point gap allowed between strongest and weakest team. Blank = no limit |
| Seed | `--seed` | Blank picks a random one, shown in the report |
| Exchanges | `-n` | Random swaps tried per start |
| Restarts | `-R` | Fresh random starts; the best result wins |

Output matches the command line tool: teams with per-member scores, the summary
lines, the plain roster (with a copy button), and the global swap count.

## Two things worth knowing

**Limits can be impossible.** On the sample class, a 3× member cap and a team gap
under 13 cannot both hold — no arrangement of those 12 students manages it. The
page says `NOT met` in red rather than quietly returning something that misses.


## Verifying the port

```
node tests/verify.mjs
```

Only this check needs node — never the page. It extracts the algorithm straight
out of `blee-team.html` and asserts it reaches the same totals a brute force over all
15,400 partitions of the sample class found: 184 unlimited, 108 / 116 / 157 at
team gaps of 2 / 4 / 6, and 71 under the 3× member cap.

