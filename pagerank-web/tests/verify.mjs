// Extracts the ALGORITHM block out of pagerank.html and exercises it in Node.
// Run:  node tests/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'pagerank.html'), 'utf8');

const m = html.match(/ALGORITHM START ={2,}\n([\s\S]*?)\n\/\/ ={2,} ALGORITHM END/);
if (!m) { console.error('Could not find the ALGORITHM block in pagerank.html'); process.exit(1); }
const algo = await import('data:text/javascript,' +
  encodeURIComponent(m[1] + '\nexport { run, parseCSV, parseChoice, buildModel, teamHappiness };'));
const { run, parseChoice, buildModel } = algo;

const W = [13, 8, 5, 3, 2, 1];
let pass = 0, fail = 0;
const group = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
function check(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { console.log('  \x1b[32mPASS\x1b[0m ' + label); pass++; }
  else { console.log('  \x1b[31mFAIL\x1b[0m ' + label + '\n       got:  ' + g + '\n       want: ' + w); fail++; }
}
function ok(label, cond) { check(label, !!cond, true); }
function throws(label, fn, re) {
  try { fn(); console.log('  \x1b[31mFAIL\x1b[0m ' + label + ' (no error thrown)'); fail++; }
  catch (e) {
    if (re.test(e.message)) { console.log('  \x1b[32mPASS\x1b[0m ' + label); pass++; }
    else { console.log('  \x1b[31mFAIL\x1b[0m ' + label + '\n       got: ' + e.message); fail++; }
  }
}
// happiness of one person on the team they were placed on
const hap = (r, name) => {
  for (const h of r.happiness) for (const mem of h.members) if (mem.name === name) return mem.score;
  return null;
};
const teamOf = (r, name) => r.teams.find(t => t.includes(name));

// ---------------------------------------------------------------- regression
// Negative-preference support must not change any all-positive result.
group('Regression: the CS374 class still matches pagerank-teams.py');
{
  const csv = fs.readFileSync(path.join(root, '26F-CS374-prefs.txt'), 'utf8');
  const r = run(csv, W, 3);
  check('ranking (4dp)', r.ranklist.map(([n, s]) => s.toFixed(4) + ' ' + n), [
    '0.1641 Musa_Blake', '0.1405 Trent_Festich', '0.1157 John_David_Schultz',
    '0.1037 Mya_Hargrave', '0.0967 Isaac_England', '0.0749 Sarah_Rawls',
    '0.0598 Akram_Idriss', '0.0545 Ben_Wilson', '0.0520 Zander_Ragsdale',
    '0.0500 Khiryn_Tillman_Johnson', '0.0479 Matthew_Aghassi', '0.0402 Roberto_Sugira']);
  check('teams', r.teams.map(t => t.join(', ')), [
    'Musa_Blake, Mya_Hargrave, Zander_Ragsdale',
    'Trent_Festich, John_David_Schultz, Sarah_Rawls',
    'Isaac_England, Matthew_Aghassi, Akram_Idriss',
    'Ben_Wilson, Roberto_Sugira, Khiryn_Tillman_Johnson']);
  ok('top score within 1e-9 of networkx', Math.abs(r.ranklist[0][1] - 0.1640969018) < 1e-9);
  check('duplicate edge collapsed (71 not 72)', r.edgeCount, 71);
  check('no negatives detected', r.negativeCount, 0);
  check('no conflicts', r.conflicts.length, 0);
  ok('scores sum to 1', Math.abs(r.ranklist.reduce((a, b) => a + b[1], 0) - 1) < 1e-12);
}

// ------------------------------------------------------------------- parsing
group('Parsing the "-" prefix');
{
  check('plain name', parseChoice('Dana'), { name: 'Dana', negative: false });
  check('negated name', parseChoice('-Dana'), { name: 'Dana', negative: true });
  check('space after the dash', parseChoice('- Dana'), { name: 'Dana', negative: true });
  check('underscores survive', parseChoice('-Mya_Hargrave'), { name: 'Mya_Hargrave', negative: true });
  throws('bare "-" is an error', () => run('A,-,C\nB,A,C\n', W, 2), /empty choice in position 1/);
}

// -------------------------------------------------------------- point values
group('A negative is worth the same magnitude as its position');
{
  // position:              1    2    3    4     -> weights 13, 8, 5, 3
  const rows = [['A', 'B', '-C', 'D', '-E']];
  const model = buildModel(rows, W);
  const v = model.value.get('A');
  check('1st choice B = +13', v.get('B'), 13);
  check('2nd choice -C = -8', v.get('C'), -8);
  check('3rd choice D = +5', v.get('D'), 5);
  check('4th choice -E = -3', v.get('E'), -3);
  check('magnitudes are equal, signs differ', [Math.abs(v.get('C')), W[1]], [8, 8]);
  check('negatives counted', model.negativeCount, 2);
}

// --------------------------------------------------------------------- graph
group('Negatives are withheld from the PageRank graph');
{
  const pos = buildModel([['A', 'B', 'C'], ['B', 'A', 'C'], ['C', 'A', 'B']], W);
  const neg = buildModel([['A', 'B', '-C'], ['B', 'A', 'C'], ['C', 'A', 'B']], W);
  check('positive graph has 6 edges', pos.edgeCount, 6);
  check('one negative removes one edge', neg.edgeCount, 5);
  ok('no A->C edge remains', !neg.adj.get('A').has('C'));
  ok('A->B edge survives', neg.adj.get('A').get('B') === 13);

  // The distribution must stay valid: no negative weight ever reaches normalization.
  const r = run('A,B,-C\nB,A,C\nC,A,B\n', W, 3);
  ok('scores still sum to 1', Math.abs(r.ranklist.reduce((a, b) => a + b[1], 0) - 1) < 1e-12);
  ok('every score is positive', r.ranklist.every(([, s]) => s > 0));

  // Someone named ONLY as a negative is still on the roster, not silently dropped.
  const solo = run('A,B,-Z\nB,A\n', W, 2);
  ok('negative-only person is still ranked', solo.ranklist.some(([n]) => n === 'Z'));
  ok('...and is reported unassigned rather than vanishing', solo.unassigned.includes('Z'));
}

// ------------------------------------------------------------- team building
group('You are never seated with someone from your own "-" list');
{
  const plain = run('A,B,C,D\nB,A,C,D\nC,A,B,D\nD,A,B,C\n', W, 3);
  check('without negatives A takes B and C', teamOf(plain, 'A'), ['A', 'B', 'C']);

  const withNeg = run('A,-B,C,D\nB,A,C,D\nC,A,B,D\nD,A,B,C\n', W, 3);
  check('A skips B and takes C and D', teamOf(withNeg, 'A'), ['A', 'C', 'D']);
  ok('B is not on A’s team', !teamOf(withNeg, 'A').includes('B'));

  // All-negative list: nothing to fill with, so the seed's team rolls back.
  // (B and C are mirror images here, so their relative order is float noise --
  // assert on the rollback itself, not on which of them ends up seeding.)
  const stuck = run('A,-B,-C\nB,C,A\nC,B,A\n', W, 3);
  check('A ranks first', stuck.ranklist[0][0], 'A');
  ok('but A never seeds a team, having nothing positive to fill with',
     stuck.teams.every(t => t[0] !== 'A'));
  check('a team still forms without A at its head', stuck.teams.length, 1);
  ok('and A is absorbed into it by someone else', teamOf(stuck, 'A').includes('A'));
  ok('rollback leaves nobody stranded silently', stuck.unassigned.length === 0);
}

// ----------------------------------------------------------------- happiness
group('Happiness drops when a disliked person is present');
{
  // C arrives on A's team through B's list, not A's. A never chose C.
  const before = run('A,B,C\nB,A,C\nC,B,A\n', W, 3);
  const after  = run('A,B,-C\nB,A,C\nC,B,A\n', W, 3);

  check('same team either way', [teamOf(before, 'A'), teamOf(after, 'A')],
        [['B', 'A', 'C'], ['B', 'A', 'C']]);
  check('A liked C at +8', hap(before, 'A'), 13 + 8);
  check('A now penalised by 8', hap(after, 'A'), 13 - 8);
  ok('A is strictly less happy', hap(after, 'A') < hap(before, 'A'));
  check('the drop equals 2x the position weight', hap(before, 'A') - hap(after, 'A'), 16);
  ok('teammates are unaffected', hap(before, 'B') === hap(after, 'B'));
  ok('team total falls too', after.happiness[0].total < before.happiness[0].total);

  check('the pairing is reported', after.conflicts,
        [{ team: 1, who: 'A', other: 'C', value: -8 }]);
  check('flagged on the member', after.happiness[0].members.find(x => x.name === 'A').disliked,
        [{ name: 'C', value: -8 }]);
}

group('Happiness can go negative outright');
{
  // A dislikes both teammates; neither of them chose A either.
  const r = run('A,-B,-C\nB,C,A\nC,B,A\n', W, 3);
  const t = teamOf(r, 'A');
  ok('A still landed on a team via B', t && t.includes('A'));
  check('A scores -13 + -8', hap(r, 'A'), -21);
  ok('A is unhappy', hap(r, 'A') < 0);
  check('two pairings reported', r.conflicts.length, 2);
}

group('Happiness bookkeeping');
{
  const r = run('A,B,-C\nB,A,C\nC,B,A\n', W, 3);
  const h = r.happiness[0];
  check('team total = sum of members', h.total, h.members.reduce((a, x) => a + x.score, 0));
  check('totalHappiness = sum of teams', r.totalHappiness,
        r.happiness.reduce((a, x) => a + x.total, 0));
  ok('nobody scores themselves', !r.value.get('A').has('A'));
  const unlisted = run('A,B,C\nB,A,C\nC,A,B\n', W, 3);
  check('an unlisted teammate is worth 0', unlisted.value.get('A').get('Z') ?? 0, 0);
}

group('Sign conflicts resolve to the last mention');
{
  const model = buildModel([['A', 'B', 'C', 'D', '-B']], W);
  check('"B ... -B" ends negative', model.value.get('A').get('B'), -3);
  const model2 = buildModel([['A', '-B', 'C', 'D', 'B']], W);
  check('"-B ... B" ends positive', model2.value.get('A').get('B'), 3);
  ok('but the graph keeps the positive edge it saw', model.adj.get('A').get('B') === 13);
}

group('Self-reference');
{
  const model = buildModel([['A', '-A', 'B']], W);
  ok('you cannot dislike yourself into a score', !model.value.get('A').has('A'));
  const r = run('A,-A,B\nB,A,C\nC,A,B\n', W, 2);
  ok('runs without error', r.teams.length > 0);
}

group('The built-in dislikes sample behaves as documented');
{
  const neg = html.match(/const SAMPLE_NEG = `([\s\S]*?)`;/);
  ok('SAMPLE_NEG is present in the page', !!neg);
  if (neg) {
    const plainSrc = html.match(/const SAMPLE = `([\s\S]*?)`;/)[1];
    const p = run(plainSrc, W, 3);
    const n = run(neg[1], W, 3);
    check('two negatives declared', n.negativeCount, 2);
    check('both land on the same team anyway', n.conflicts.length, 2);
    ok('total happiness is lower than the plain sample', n.totalHappiness < p.totalHappiness);
    ok('everyone is still placed', n.unassigned.length === 0);
  }
}

console.log('\n' + (fail ? '\x1b[31m' : '\x1b[32m') + pass + ' passed, ' + fail + ' failed\x1b[0m');
process.exit(fail ? 1 : 0);
