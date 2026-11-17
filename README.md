# The Blee Team 

Three ways to make teams from a list of preferences that looks like so:

name1,choice1,choice2,choice3,choice4,choice5,choice6,choice7,choice8  
name2,choice1,choice2,choice3,choice4,choice5,choice6,choice7,choice8
...

Up to 8 choices count in all three pages. Fewer is fine. Choices past the 8th are ignored, and so is
any choice past the end of the weights list.

Each algorithm is implemented by a stand-alone html file which has no server connections, doesn't call home.

## How to use

1. Open one of the html files in a browser: double-click it, or drag the html file onto a browser window.
   - `genetic/genetic-team.html`
   - `Gale-Shapley/gale-shapley.html`
   - `pagerank-web/pagerank.html`
2. With the page open, drag a prefs file from Finder (or Explorer) and drop it onto the page's
   **Preferences** section. In pagerank and Gale-Shapley that section is the **Input** panel. The
   section gets a dashed outline while you hover, and on release the file's text fills the CSV box,
   replacing whatever was there. Or press **Load file…** (next to the sample buttons) and pick the
   file, or paste the text into the box.
3. Adjust the settings if you like, then press **Build Teams**. Loading a file does not start the
   build by itself.

Dropping the prefs file onto the html file's icon in Finder does **not** work: the page has to be
open first. A file dropped on another part of the open page is ignored, rather than the browser
leaving the page to show the file.

### Sample prefs files

All use the same anonymized 12-person class (`aa` … `ll`):

| File | What it shows |
| --- | --- |
| `prefs.csv` | The plain class: six choices per person. Same content as `prefs.txt`, which the tests read |
| `prefs-negatives.csv` | The same class with three `-` choices (aa, ii and kk each mark someone they don't want) |
| `prefs-varied.csv` | Uneven lists: some people give six choices, some only one or two, some rows have trailing commas |

## genetic

Switch 2 random team members and see if the happiness increases.  Repeat a zillion times to achieve a... local maximum!

## Gayle-Shapley

The most-requested folks get to be team-captains and choose their team-members, one at a time.

## pagerank-web

Pretend that the preference list is a web of html pages.

Rank order them and then let the highest ranked players get their preferences.

## Negative Nancy

Prefixing a preference with "-" means "you prefer NOT to have this person on your team".
All three pages accept it.

A "-" choice costs the same weight its position would have earned. With the default weights
13,8,5,3,2,1,1,1, `-Nancy` in 1st place costs 13 points and `-Nancy` in 8th place costs 1.

So place them in the order of importance. If your most important goal is to NOT have Nancy on your team, then your preference list should be:  
`Me,-Nancy,Bubba,DipStick,LiverLips`

But if you merely slightly prefer they not be on your team, then place them at the end, like so:
`Me,Bubba,DipStick,LiverLips,-Nancy`

If you list someone more than once, only the **first** mention counts, whether it is positive or negative.
`Me,Bubba,DipStick,-Bubba` still wants Bubba (13 points).  
`Me,-Bubba,DipStick,Bubba` still does not (−13).  
Later mentions are ignored, and the choices after them keep their own positions.

What each page does with it:

- **genetic** subtracts the points from that person's happiness, so the search works to keep you apart.
  Any unwanted pairing that survives gets a ⚠ and is listed in the summary.
- **Gale-Shapley** ranks a disliked captain at the bottom of your list, and a captain ranks a
  disliked member at the bottom of theirs. Two *members* who dislike each other can still pick the
  same captain. That pairing is scored and flagged, not prevented.
- **pagerank-web** gives no PageRank endorsement for a "-" choice, and the greedy fill never seats
  you with someone from your own "-" list. Someone else's list can still bring them onto your team,
  and that is scored and flagged.

## Tests

Each folder has `tests/verify.mjs`. Run it with `node <folder>/tests/verify.mjs`. The tests use `prefs.txt`.

## License

MIT License, Copyright (c) 2026 Brent Neal Reeves. See [LICENSE](LICENSE). Each html file also carries
the full license text in a comment at the top, so a page copied on its own keeps its notice.
