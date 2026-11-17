// Extracts the ALGORITHM block out of gale-shapley.html and exercises it in Node.
// Run:  node tests/verify.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'gale-shapley.html'), 'utf8');

const m = html.match(/ALGORITHM START ={2,}\n([\s\S]*?)\n\/\/ ={2,} ALGORITHM END/);
if (!m) { console.error('Could not find the ALGORITHM block in gale-shapley.html'); process.exit(1); }
const { run, blockingPairs, rankMaps } = await import('data:text/javascript,' +
  encodeURIComponent(m[1] + '\nexport { run, blockingPairs, rankMaps };'));

const W = [13, 8, 5, 3, 2, 1];
let pass = 0, fail = 0;
const group = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
function check(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { console.log('  \x1b[32mPASS\x1b[0m ' + label); pass++; }
  else { console.log('  \x1b[31mFAIL\x1b[0m ' + label + '\n       got:  ' + g + '\n       want: ' + w); fail++; }
}
const ok = (label, cond) => check(label, !!cond, true);
function throws(label, fn, re) {
  try { fn(); console.log('  \x1b[31mFAIL\x1b[0m ' + label + ' (no error thrown)'); fail++; }
  catch (e) {
    if (re.test(e.message)) { console.log('  \x1b[32mPASS\x1b[0m ' + label); pass++; }
    else { console.log('  \x1b[31mFAIL\x1b[0m ' + label + '\n       got: ' + e.message); fail++; }
  }
}

// Every way to fill the captains' seats with the members, keeping the stable ones.
function allStable(r) {
  const out = [];
  const held = new Map(r.captains.map(c => [c, []]));
  const go = i => {
    if (i === r.members.length) {
      if (blockingPairs(r.members, r.captains, r.memberPrefs, r.captainPrefs, r.seats, held).length === 0) {
        out.push(new Map([...held].map(([c, h]) => [c, h.slice()])));
      }
      return;
    }
    for (const c of r.captains) {
      const h = held.get(c);
      if (h.length < r.seats.get(c)) { h.push(r.members[i]); go(i + 1); h.pop(); }
    }
  };
  go(0);
  return out;
}
const capOfIn = held => { const o = new Map(); for (const [c, h] of held) for (const x of h) o.set(x, c); return o; };
const heldOf = r => new Map(r.teams.map(t => [t[0], t.slice(1)]));

function structural(label, r, n) {
  const all = r.teams.flat();
  check(label + ': everyone placed once', [all.length, new Set(all).size, r.unassigned.length], [n, n, 0]);
  const sizes = r.teams.map(t => t.length);
  ok(label + ': team sizes differ by at most one', Math.max(...sizes) - Math.min(...sizes) <= 1);
  check(label + ': stable (no blocking pairs)', r.blocking, []);
}

// Lattice property: members-propose is the best stable matching for every member,
// captains-propose the worst for every member, and they bracket every stable one.
function optimality(label, csv, size) {
  const rm = run(csv, { weights: W, size, proposer: 'members' });
  const rc = run(csv, { weights: W, size, proposer: 'captains' });
  const stable = allStable(rm);
  const mRank = rankMaps(rm.memberPrefs);
  const capM = capOfIn(heldOf(rm)), capC = capOfIn(heldOf(rc));
  let best = true, worst = true;
  for (const s of stable) {
    const cap = capOfIn(s);
    for (const x of rm.members) {
      const rs = mRank.get(x).get(cap.get(x));
      if (mRank.get(x).get(capM.get(x)) > rs) best = false;
      if (mRank.get(x).get(capC.get(x)) < rs) worst = false;
    }
  }
  console.log('     (' + stable.length + ' stable matchings found by brute force)');
  ok(label + ': members-propose is member-optimal', best);
  ok(label + ': captains-propose is member-pessimal', worst);
  const key = held => JSON.stringify([...held].map(([c, h]) => [c, h.slice().sort()]));
  const keys = new Set(stable.map(key));
  ok(label + ': both results are among the stable matchings', keys.has(key(heldOf(rm))) && keys.has(key(heldOf(rc))));
  return { rm, rc, count: stable.length };
}

// ---------------------------------------------------------------- CS374 class
group('CS374 class (12 people, teams of 3)');
const cs374 = fs.readFileSync(path.join(root, '..', 'prefs.txt'), 'utf8');
{
  const rm = run(cs374, { weights: W, size: 3, proposer: 'members' });
  const rc = run(cs374, { weights: W, size: 3, proposer: 'captains' });
  structural('members propose', rm, 12);
  structural('captains propose', rc, 12);
  check('captains are the four most-wanted', rm.captains,
    ['bb', 'dd', 'ii', 'ee']);
  console.log('     members propose:  ' + rm.teams.map(t => t.join(', ')).join(' | ') + '  (happiness ' + rm.totalHappiness + ')');
  console.log('     captains propose: ' + rc.teams.map(t => t.join(', ')).join(' | ') + '  (happiness ' + rc.totalHappiness + ')');
  optimality('CS374', cs374, 3);
}

group('CS374 class, teams of 4 and 5 (uneven remainder)');
for (const size of [4, 5]) {
  const r = run(cs374, { weights: W, size, proposer: 'members' });
  structural('size ' + size, r, 12);
  check('size ' + size + ': team sizes', r.teams.map(t => t.length), size === 4 ? [4, 4, 4] : [6, 6]);
}
optimality('size 4', cs374, 4);

// ---------------------------------------------------------------- sample in page
group('Embedded samples');
{
  const sample = html.match(/const SAMPLE = `([\s\S]*?)`/)[1];
  const neg = html.match(/const SAMPLE_NEG = `([\s\S]*?)`/)[1];
  const a = run(sample, { weights: W, size: 3, proposer: 'members' });
  const b = run(cs374, { weights: W, size: 3, proposer: 'members' });
  check('anonymized sample gives the same team shapes as CS374',
    a.teams.map(t => t.map(n => a.roster.indexOf(n))), b.teams.map(t => t.map(n => b.roster.indexOf(n))));
  const rn = run(neg, { weights: W, size: 3, proposer: 'members' });
  structural('sample with dislikes', rn, 12);
  check('negatives counted', rn.negativeCount, 3);
  ok('a disliked captain is ranked last by the member who dislikes them',
    rn.members.every(x => rn.captains.every(c => (rn.value.get(x).get(c) || 0) >= 0 ||
      rn.memberPrefs.get(x).at(-1) === c)));
}

// ---------------------------------------------------------------- eight choices
group('Up to eight preferences count; a 9th does not');
{
  const W8 = [13, 8, 5, 3, 2, 1, 1, 1];
  const NINE = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const csv = 'A,' + NINE.join(',') + '\n' + NINE.map(n => n + ',A').join('\n');
  const r = run(csv, { weights: [...W8, 9], size: 10, proposer: 'members' });
  check('1st through 8th choices score 13,8,5,3,2,1,1,1', NINE.slice(0, 8).map(n => r.value.get('A').get(n)), W8);
  check('a 9th choice scores 0, even with a 9th weight', r.value.get('A').get('J') ?? 0, 0);
  check('one team of ten', r.teams.map(t => t.length), [10]);
  check('happiness with all eight choices on the team is 34',
    r.happiness[0].members.find(x => x.name === 'A').score, 34);
  const n = run(csv.replace('A,' + NINE.join(','), 'A,' + NINE.map(x => '-' + x).join(',')), { weights: W8, size: 10 });
  check('happiness with all eight unwanted on the team is -34',
    n.happiness[0].members.find(x => x.name === 'A').score, -34);
  // the 8th choice still decides a ranking: X is a's 8th choice, Y is unlisted
  const r8 = run('X,a\nY,a\na,p,q,r,s,t,u,v,X\nb,X', { weights: W8, size: 2, captains: ['X', 'Y'] });
  check('an 8th-place captain outranks an unlisted one', r8.memberPrefs.get('a'), ['X', 'Y']);
  const real = run(fs.readFileSync(path.join(root, '..', 'prefs.txt'), 'utf8'), { weights: W8, size: 3 });
  const sums = [...real.value].map(([n, v]) => [n, [...v.values()].reduce((x, y) => x + y, 0)]);
  ok('every prefs.txt row uses all six of its choices (32 points; ee lists gg twice, so 31)',
    sums.every(([n, s]) => s === (n === 'ee' ? 31 : 32)));
}

// ---------------------------------------------------------------- negatives
group('Negative preferences are weighted by position');
{
  // m dislikes X in 1st place (-13) and Y in 6th place (-1): X must rank below Y.
  const csv = 'X,m\nY,m\nm,-X,a,b,c,d,-Y\na,X\nb,X\nc,X';
  const r = run(csv, { weights: W, size: 3, proposer: 'members', captains: ['X', 'Y'] });
  check('values are minus the position weight', [r.value.get('m').get('X'), r.value.get('m').get('Y')], [-13, -1]);
  check('worse dislike ranks last', r.memberPrefs.get('m'), ['Y', 'X']);
  check('m avoids the captain they most dislike', r.teams.find(t => t.includes('m'))[0], 'Y');
  // a captain who marks a member '-' ranks them last
  const r2 = run('X,-m,a\nY,a\nm,X\na,X', { weights: W, size: 2, proposer: 'captains', captains: ['X', 'Y'] });
  check('captain ranks a disliked member last', r2.captainPrefs.get('X'), ['a', 'm']);
  check('duplicates: only the first mention counts',
    [run('X,m,-m\nY,m\nm,X\na,X', { weights: W, size: 2, captains: ['X', 'Y'] }).value.get('X').get('m'),
     run('X,-m,m\nY,m\nm,X\na,X', { weights: W, size: 2, captains: ['X', 'Y'] }).value.get('X').get('m')], [13, -13]);
  check('"- Name" with a space is the same as "-Name"',
    run('X,- m\nY,m\nm,X\na,X', { weights: W, size: 2, captains: ['X', 'Y'] }).value.get('X').get('m'), -13);
}

// ---------------------------------------------------------------- textbook case
group('Classic stable marriage (size 2) — the textbook instance');
{
  // Two captains, two members. Members both want X; X wants b; Y wants a.
  // Members-propose: a->X, b->X, X keeps b, a->Y.  Unique stable matching here.
  const csv = 'X,b,a,Y\nY,a,b,X\na,X,Y\nb,X,Y';
  const r = run(csv, { weights: W, size: 2, proposer: 'members', captains: ['X', 'Y'] });
  check('teams', r.teams, [['X', 'b'], ['Y', 'a']]);
  check('log', r.log, ['a -> X: held', 'b -> X: held, bumps a', 'a -> Y: held']);

  // Opposed preferences: two stable matchings, proposer side decides.
  const csv2 = 'X,a,b\nY,b,a\na,Y,X\nb,X,Y';
  const m2 = run(csv2, { weights: W, size: 2, proposer: 'members', captains: ['X', 'Y'] });
  const c2 = run(csv2, { weights: W, size: 2, proposer: 'captains', captains: ['X', 'Y'] });
  check('members propose: members get their first choice', m2.teams, [['X', 'b'], ['Y', 'a']]);
  check('captains propose: captains get their first choice', c2.teams, [['X', 'a'], ['Y', 'b']]);
  check('both stable', [m2.blocking.length, c2.blocking.length], [0, 0]);
}

// ---------------------------------------------------------------- random classes
// CS374 happens to have exactly one stable matching, so the lattice test above
// is weak there. Random classes usually have several.
group('Random classes (seeded): optimality against brute force');
{
  let seed = 374;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let trials = 0, multi = 0, bad = 0;
  for (let t = 0; t < 150; t++) {
    const n = 6 + Math.floor(rnd() * 7);           // 6..12 people
    const size = 2 + Math.floor(rnd() * 2);        // 2 or 3
    const names = Array.from({ length: n }, (_, i) => 'p' + i);
    const csv = names.map(a => {
      const others = names.filter(b => b !== a).sort(() => rnd() - 0.5).slice(0, 6);
      return [a, ...others.map(b => (rnd() < 0.1 ? '-' : '') + b)].join(',');
    }).join('\n');
    const quiet = console.log; console.log = () => {};
    const before = fail;
    const { count } = optimality('random', csv, size);
    console.log = quiet;
    trials++; if (count > 1) multi++; if (fail > before) bad++;
    pass -= 3; fail -= (fail - before);           // count the batch as one check below
  }
  console.log('     (' + trials + ' classes, ' + multi + ' with more than one stable matching)');
  ok('lattice property holds on every random class', bad === 0);
  ok('the random set actually exercises multiple stable matchings', multi >= 20);
}

// ---------------------------------------------------------------- errors & edges
group('Errors and edge cases');
throws('wrong number of captains', () => run(cs374, { weights: W, size: 3, captains: ['bb'] }), /exactly 4/);
throws('unknown captain', () => run(cs374, { weights: W, size: 3, captains: ['Nobody', 'a', 'b', 'c'] }), /no row/);
throws('empty CSV', () => run('\n\n', { weights: W, size: 3 }), /No usable rows/);
throws('bare dash', () => run('a,-\nb,a', { weights: W, size: 2 }), /empty choice/);
{
  const r = run('a,b,zz\nb,a\nc,a\nd,c', { weights: W, size: 2, proposer: 'members' });
  check('name with no row is reported, not seated', r.ignored, ['zz']);
  structural('small class', r, 4);
  const one = run('a,b\nb,a\nc,a', { weights: W, size: 5, proposer: 'members' });
  check('class smaller than team size makes one team', one.teams.length, 1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
