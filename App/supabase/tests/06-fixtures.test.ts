// Fixtures and reminders: who sees what, saving in one go, and that send
// times are worked out correctly in Norwegian time (also across DST).

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('fixtures & reminders', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, coach: string, carl: string, aLag: string, g19: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x'); // A-lag
    bob = await t.addUser('bob@x'); // G19
    coach = await t.addUser('coach@x', 'coach');
    carl = await t.addUser('carl@x', 'admin');
    aLag = (await t.asOwner(`insert into teams (name) values ('A-lag') returning id`))[0].id;
    g19 = (await t.asOwner(`insert into teams (name) values ('G19') returning id`))[0].id;
    await t.asOwner('update profiles set team_id = $1 where id = $2', [aLag, anna]);
    await t.asOwner('update profiles set team_id = $1 where id = $2', [g19, bob]);
  });

  const save = (who: string, id: string | null, fixture: object, teams: string[], reminders: object[]) =>
    t.as(who, 'select save_fixture($1, $2::jsonb, $3::uuid[], $4::jsonb) as id', [
      id,
      JSON.stringify(fixture),
      teams,
      JSON.stringify(reminders),
    ]);

  // Saturday 7 March 2026, 18:00 Oslo (= 17:00 UTC, winter time).
  const match = { kind: 'match', opponent: 'Vålerenga', home_away: 'home', starts_at: '2026-03-07T17:00:00Z', ends_at: '2026-03-07T19:00:00Z' };
  const reminders = [
    { anchor: 'day_before', at_time: '19:00', body_nb: 'Kamp i morgen kl. {tid}' },
    { anchor: 'same_day', at_time: '09:00', body_nb: 'Kampdag!' },
    { anchor: 'before_start', offset_minutes: 180, body_nb: '3 timer igjen', body_en: '3 hours to go' },
    { anchor: 'after_end', offset_minutes: 30, body_nb: 'Godt jobbet!' },
  ];
  let fixtureId: string;

  test('the starting template library exists, for staff only', async () => {
    assert.ok((await t.as(coach, 'select * from reminder_templates')).rows.length >= 8);
    assert.equal((await t.as(anna, 'select * from reminder_templates')).rows.length, 0);
  });

  test('a coach saves a fixture with teams and reminders in one go', async () => {
    const r = await save(coach, null, match, [aLag], reminders);
    assert.ok(r.ok, r.error);
    fixtureId = r.rows[0].id;
    assert.equal((await t.as(coach, 'select count(*)::int as n from fixture_reminders where fixture_id = $1', [fixtureId])).rows[0].n, 4);
  });

  test('send times are Norwegian local times', async () => {
    const rows = (await t.as(coach, 'select anchor, send_at from fixture_reminders where fixture_id = $1', [fixtureId])).rows;
    const at = (a: string) => new Date(rows.find((r) => r.anchor === a)!.send_at).toISOString();
    assert.equal(at('day_before'), '2026-03-06T18:00:00.000Z'); // Fri 19:00 Oslo
    assert.equal(at('same_day'), '2026-03-07T08:00:00.000Z'); // Sat 09:00 Oslo
    assert.equal(at('before_start'), '2026-03-07T14:00:00.000Z'); // 3 h before
    assert.equal(at('after_end'), '2026-03-07T19:30:00.000Z'); // 30 min after the end
  });

  test('"the day before at 19:00" is right across the switch to summer time', async () => {
    // Sunday 29 March 2026 is the DST change; match at 15:00 Oslo (13:00 UTC, summer time).
    const r = await save(coach, null, { ...match, starts_at: '2026-03-29T13:00:00Z', ends_at: '2026-03-29T15:00:00Z' }, [aLag], [reminders[0]]);
    const row = (await t.as(coach, 'select send_at from fixture_reminders where fixture_id = $1', [r.rows[0].id])).rows[0];
    assert.equal(new Date(row.send_at).toISOString(), '2026-03-28T18:00:00.000Z'); // Sat 19:00 winter time
  });

  test('moving the fixture moves its reminders', async () => {
    await t.as(coach, `update fixtures set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day' where id = $1`, [fixtureId]);
    const row = (await t.as(coach, `select send_at from fixture_reminders where fixture_id = $1 and anchor = 'before_start'`, [fixtureId])).rows[0];
    assert.equal(new Date(row.send_at).toISOString(), '2026-03-08T14:00:00.000Z');
  });

  test("players see their own team's fixtures and reminders — not other teams'", async () => {
    assert.equal((await t.as(anna, 'select id from fixtures where id = $1', [fixtureId])).rows.length, 1);
    assert.equal((await t.as(anna, 'select id from fixture_reminders where fixture_id = $1', [fixtureId])).rows.length, 4);
    assert.equal((await t.as(bob, 'select id from fixtures where id = $1', [fixtureId])).rows.length, 0);
    assert.equal((await t.as(bob, 'select id from fixture_reminders where fixture_id = $1', [fixtureId])).rows.length, 0);
  });

  test('players cannot create or change fixtures or reminders', async () => {
    assert.equal((await save(anna, null, match, [aLag], reminders)).ok, false);
    const upd = await t.as(anna, `update fixture_reminders set body_nb = 'hacked' where fixture_id = $1 returning id`, [fixtureId]);
    assert.equal(upd.rows.length, 0);
  });

  test('saving again replaces teams and reminders', async () => {
    const r = await save(carl, fixtureId, match, [aLag, g19], [reminders[1]]);
    assert.ok(r.ok, r.error);
    assert.equal((await t.as(carl, 'select count(*)::int as n from fixture_reminders where fixture_id = $1', [fixtureId])).rows[0].n, 1);
    assert.equal((await t.as(bob, 'select id from fixtures where id = $1', [fixtureId])).rows.length, 1, 'G19 now sees it');
  });

  test('invalid input is refused', async () => {
    assert.equal((await save(coach, null, match, [], reminders)).ok, false, 'needs a team');
    assert.equal((await save(coach, null, { ...match, ends_at: match.starts_at }, [aLag], [])).ok, false, 'ends after it starts');
    assert.equal((await save(coach, null, match, [aLag], [{ anchor: 'day_before', body_nb: 'x' }])).ok, false, 'day_before needs a time');
    assert.equal((await save(coach, null, match, [aLag], [{ anchor: 'before_start', offset_minutes: 60, body_nb: ' ' }])).ok, false, 'needs text');
  });

  test('a player without a team sees no fixtures', async () => {
    const solo = await t.addUser('solo@x');
    assert.equal((await t.as(solo, 'select id from fixtures')).rows.length, 0);
  });
});
