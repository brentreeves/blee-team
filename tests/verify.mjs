// Verifies the algorithm inside blee-team.html against the answers the Python tool and
// a brute force over all 15400 partitions produced for the sample class.
// Run: node tests/verify.mjs      (the page itself never needs node)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "blee-team.html"), "utf8");

const code = html.split("ALGORITHM START")[1].split("ALGORITHM END")[0]
  .replace(/^[^]*?<script id="algorithm">/, "").replace(/<\/script>[^]*$/, "");
new Function(code)();
const TB = globalThis.TeamBuilder;

const sample = html.split('<script id="sample-data" type="text/plain">')[1]
  .split("</script>")[0].trim();

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
