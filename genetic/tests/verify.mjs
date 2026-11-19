// Copyright (c) 2026 Brent Neal Reeves
// SPDX-License-Identifier: MIT  (see LICENSE at the repository root)
// Verifies the algorithm inside genetic-team.html against the answers the Python tool and
// a brute force over all 15400 partitions produced for the sample class.
// Run: node tests/verify.mjs      (the page itself never needs node)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "genetic-team.html"), "utf8");

const code = html.split("ALGORITHM START")[1].split("ALGORITHM END")[0]
  .replace(/^[^]*?<script id="algorithm">/, "").replace(/<\/script>[^]*$/, "");
new Function(code)();
const TB = globalThis.TeamBuilder;

// the 12-person class (anonymized) the brute-force optima below were computed on
const sample = readFileSync(join(here, "..", "..", "prefs.csv"), "utf8").trim();

const WEIGHTS = [13, 8, 5, 3, 2, 1];
let failures = 0;

function check(name, condition, detail = "") {
  if (condition) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name} ${detail}`); }
}

// --- scoring ---
const ROWS = TB.parseCsv("a,b,c,d\nb,a,c,d\nc,d,a,b\nd,c,b,a");
const small = TB.preferenceMap(ROWS, WEIGHTS);
check("preference weights by position", small.get("a").get("b") === 13 && small.get("a").get("c") === 8);
check("duplicate choice keeps best weight",
  TB.preferenceMap(TB.parseCsv("a,b,b,c"), WEIGHTS).get("a").get("b") === 13);
check("duplicate: positive first stays positive",
  TB.preferenceMap(TB.parseCsv("a,b,c,-b"), WEIGHTS).get("a").get("b") === 13);
check("duplicate: negative first stays negative",
  TB.preferenceMap(TB.parseCsv("a,-b,c,b"), WEIGHTS).get("a").get("b") === -13);
check("duplicate keeps later choices at their own positions",
  TB.preferenceMap(TB.parseCsv("a,b,b,c"), WEIGHTS).get("a").get("c") === 5);
check("self and blanks ignored",
  TB.preferenceMap(TB.parseCsv("a,a,,b"), WEIGHTS).get("a").get("b") === 5);
check("negative preference uses the matching weight",
  TB.preferenceMap(TB.parseCsv("a,-b,c"), WEIGHTS).get("a").get("b") === -13);
check("negative preference removes the prefix from the member name",
  !TB.preferenceMap(TB.parseCsv("a,-b"), WEIGHTS).get("a").has("-b"));
check("member happiness counts only listed teammates",
  TB.memberHappiness("a", ["a", "b", "z"], small) === 13);
const negative = TB.preferenceMap(TB.parseCsv("a,-b,c\nb,a,-c"), WEIGHTS);
check("member happiness subtracts a negative preference",
  TB.memberHappiness("a", ["a", "b", "c"], negative) === -13 + 8);
check("team happiness includes negative preferences",
  TB.teamHappiness(["a", "b"], negative) === -13 + 13);
const incomplete = TB.preferenceMap(TB.parseCsv("a,b\nb,a\nc\nd"), WEIGHTS);
check("member cap ignores people with no preferences",
  TB.fairnessPenalty([["a", "b"], ["c", "d"]], incomplete, 6) === 0);
check("stranger scores zero", TB.memberHappiness("z", ["z", "a"], small) === 0);
check("team happiness sums members", TB.teamHappiness(["a", "b"], small) === 26);
check("quoted csv fields survive",
  TB.parseCsv('"Doe, Jane",b').length === 1 && TB.parseCsv('"Doe, Jane",b')[0][0] === "Doe, Jane");

// --- penalties ---
check("fairness penalty zero when even", TB.fairnessPenalty([["a", "b"], ["c", "d"]], small, 3) === 0);
check("fairness penalty positive when someone lags",
  TB.fairnessPenalty([["a", "b"], ["c", "z"]], small, 3) > 0);
check("team gap penalty counts points over the limit",
  TB.teamSpreadPenalty([["a", "b"], ["c", "z"]], small, 20) === 6);
check("null team gap means no limit",
  TB.teamSpreadPenalty([["a", "b"], ["c", "z"]], small, null) === 0);
check("zero team gap demands equal teams",
  TB.teamSpreadPenalty([["a", "b"], ["c", "z"]], small, 0) > 0);
check("scan agrees with the helpers", (() => {
  const teams = [["a", "b"], ["c", "d"]];
  const s = TB.scan(teams, small);
  return s.total === TB.totalHappiness(teams, small) &&
    JSON.stringify(s.teamScores) === JSON.stringify(teams.map((t) => TB.teamHappiness(t, small)));
})());

const supplied = TB.preferenceMap(TB.parseCsv(`aa,bb,cc,dd
bb,aa,cc,ii
cc,bb,ii,jj
dd,gg,jj,bb
ee,hh,kk,aa
ff,ii,aa,ee
gg
hh
ii
jj
kk`), WEIGHTS);
const suppliedRoster = [...supplied.keys()].sort();
const suppliedResult = TB.bestTeams(suppliedRoster, supplied, 3, 10000, TB.makeRng(1), 6, 50, null);
check("incomplete preference data still produces a positive result",
  TB.totalHappiness(suppliedResult.teams, supplied) > 0 &&
  TB.constraintPenalty(suppliedResult.teams, supplied, 6, null) === 0,
  `got ${TB.totalHappiness(suppliedResult.teams, supplied)}`);

// --- up to eight preferences count, a 9th does not ---
{
  const W8 = [13, 8, 5, 3, 2, 1, 1, 1];
  const NINE = ["b", "c", "d", "e", "f", "g", "h", "i", "j"];
  check("MAX_CHOICES is 8", TB.MAX_CHOICES === 8, `got ${TB.MAX_CHOICES}`);
  const eight = TB.preferenceMap(TB.parseCsv("a," + NINE.join(",") + "\nz," + NINE.map((n) => "-" + n).join(",")), [...W8, 9]);
  const got = NINE.slice(0, 8).map((n) => eight.get("a").get(n));
  check("1st through 8th choices score 13,8,5,3,2,1,1,1", JSON.stringify(got) === JSON.stringify(W8), `got ${got}`);
  check("a 9th choice scores nothing, even with a 9th weight", !eight.get("a").has("j"), `got ${eight.get("a").get("j")}`);
  const team = ["a", ...NINE];
  check("happiness with all eight choices on the team is 34", TB.memberHappiness("a", team, eight) === 34,
    `got ${TB.memberHappiness("a", team, eight)}`);
  check("happiness with all eight unwanted on the team is -34", TB.memberHappiness("z", [...team, "z"], eight) === -34,
    `got ${TB.memberHappiness("z", [...team, "z"], eight)}`);
  const six = TB.preferenceMap(TB.parseCsv("a," + NINE.join(",")), WEIGHTS);
  check("with only six weights, only six choices count", six.get("a").size === 6, `got ${six.get("a").size}`);
  const real = TB.preferenceMap(TB.parseCsv(sample), W8);
  const sums = [...real].map(([n, m]) => [n, [...m.values()].reduce((x, y) => x + y, 0)]);
  check("every prefs.csv row uses all six of its choices (32 points; ee lists gg twice, so 31)",
    sums.every(([n, s]) => s === (n === "ee" ? 31 : 32)), `got ${JSON.stringify(sums)}`);
}

// --- lines starting with "#" are comments ---
{
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check("comment lines are skipped",
    same(TB.parseCsv("# header\na,b\n   # indented\nb,a\n"), [["a", "b"], ["b", "a"]]));
  check('"#" partway through a line starts a comment', same(TB.parseCsv("a,b,gg # yo momma"), [["a", "b", "gg"]]),
    JSON.stringify(TB.parseCsv("a,b,gg # yo momma")));
  check("a comment right after a comma adds no choice",
    !TB.preferenceMap(TB.parseCsv("a,b, # note"), WEIGHTS).get("a").has(""));
  check('a "#" inside quotes is text', same(TB.parseCsv('a,"b#2",c'), [["a", "b#2", "c"]]));
  for (const f of ["prefs.csv", "prefs-negatives.csv", "prefs-varied.csv", "prefs-proposers.csv"]) {
    const text = readFileSync(join(here, "..", "..", f), "utf8");
    check(`${f} has comment lines`, /^\s*#/m.test(text));
    const stripped = text.split("\n").map((l) => l.replace(/#.*$/, "")).join("\n");
    check(`${f} reads the same with or without its comments`, same(TB.parseCsv(text), TB.parseCsv(stripped)));
    check(`${f} has 12 people`, TB.preferenceMap(TB.parseCsv(text), WEIGHTS).size === 12);
  }
}

// --- negative preferences: "-Name" costs the weight of its position ---
{
  const neg = TB.preferenceMap(TB.parseCsv("aa,-bb,cc,dd,ee,ff,-gg\naa2,- bb"), WEIGHTS);
  check("negative in 1st place costs the 1st-place weight", neg.get("aa").get("bb") === -13, `got ${neg.get("aa").get("bb")}`);
  check("negative in 6th place costs the 6th-place weight", neg.get("aa").get("gg") === -1, `got ${neg.get("aa").get("gg")}`);
  check("space after the dash is ignored", neg.get("aa2").get("bb") === -13, `got ${[...neg.get("aa2").keys()]}`);
  const team = ["aa", "bb", "cc"];
  check("happiness = chosen minus unwanted", TB.memberHappiness("aa", team, neg) === 8 - 13,
    `got ${TB.memberHappiness("aa", team, neg)}`);
  const d = TB.dislikedTeammates("aa", team, neg);
  check("unwanted teammate is reported", JSON.stringify(d) === JSON.stringify([{ name: "bb", points: -13 }]),
    `got ${JSON.stringify(d)}`);
  // the search should keep a 1st-place "-" apart when it can
  const apart = TB.preferenceMap(TB.parseCsv("aa,-bb,cc\nbb,aa,cc\ncc,aa,bb\ndd,aa,bb"), WEIGHTS);
  const out = TB.bestTeams(["aa", "bb", "cc", "dd"], apart, 2, 2000, TB.makeRng(3), 0, 10, null);
  check("search separates someone from a 1st-place negative",
    !out.teams.some((t) => t.includes("aa") && t.includes("bb")), `got ${JSON.stringify(out.teams)}`);
}

// --- the "Load sample with dislikes" button's data ---
{
  const grab = (id) => html.split(`<script id="${id}" type="text/plain">`)[1].split("</script>")[0].trim();
  const plainRows = TB.parseCsv(grab("sample-data"));
  const negRows = TB.parseCsv(grab("sample-neg-data"));
  const negCount = negRows.flat().filter((c) => c.startsWith("-")).length;
  check("dislikes sample has the same people as the plain sample",
    JSON.stringify(negRows.map((r) => r[0])) === JSON.stringify(plainRows.map((r) => r[0])));
  check("dislikes sample has exactly two '-' choices", negCount === 2, `got ${negCount}`);
  const negPrefs = TB.preferenceMap(negRows, WEIGHTS);
  check("aa -> cc and cc -> aa cost their 2nd-place weight",
    negPrefs.get("aa").get("cc") === -8 && negPrefs.get("cc").get("aa") === -8);
  const negRoster = [...negPrefs.keys()].sort();
  const out = TB.bestTeams(negRoster, negPrefs, 3, 10000, TB.makeRng(1), 0, 50, null);
  check("the search keeps aa and cc apart",
    !out.teams.some((t) => t.includes("aa") && t.includes("cc")), `got ${JSON.stringify(out.teams)}`);
}

// --- the class, against brute-forced optima ---
const prefs = TB.preferenceMap(TB.parseCsv(sample), WEIGHTS);
const roster = [...prefs.keys()].sort();
check("sample roster is 12 people", roster.length === 12, `got ${roster.length}`);

const CASES = [
  { label: "no limits", ratio: 0, diff: null, want: 184 },
  { label: "team gap 2", ratio: 0, diff: 2, want: 108 },
  { label: "team gap 4", ratio: 0, diff: 4, want: 116 },
  { label: "team gap 6", ratio: 0, diff: 6, want: 157 },
  { label: "member cap 3x", ratio: 3, diff: null, want: 71 },
  { label: "member cap 3x + gap 13", ratio: 3, diff: 13, want: 71 },
];

for (const c of CASES) {
  const totals = [];
  for (const seed of [1, 2, 3]) {
    const rng = TB.makeRng(seed);
    const out = TB.bestTeams(roster, prefs, 3, 10000, rng, c.ratio, 120, c.diff);
    const flat = out.teams.flat().sort();
    const intact = flat.length === 12 && new Set(flat).size === 12;
    const legal = TB.constraintPenalty(out.teams, prefs, c.ratio, c.diff) === 0;
    totals.push(intact && legal ? TB.totalHappiness(out.teams, prefs) : -1);
  }
  check(`${c.label} reaches the optimum ${c.want}`,
    totals.every((t) => t === c.want), `got ${totals.join(", ")}`);
}

// --- swap counting ---
const counted = TB.bestTeams(roster, prefs, 3, 40, TB.makeRng(9), 0, 5, null);
check("totals count every swap over every restart", counted.totals.tried === 5 * 40,
  `got ${counted.totals.tried}`);
check("winner's kept never exceeds the total", counted.winner.kept <= counted.totals.kept);

console.log(`\n${failures} failure(s)`);
process.exit(failures ? 1 : 0);
