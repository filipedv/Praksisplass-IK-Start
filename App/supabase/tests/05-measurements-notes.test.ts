// Weight/height measurements and private staff notes: who may see and
// change what.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('measurements & notes', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, coach: string, carl: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    coach = await t.addUser('coach@x', 'coach');
    carl = await t.addUser('carl@x', 'admin');
  });

  const addMeasurement = (who: string, userId: string, weight: number | null, height: number | null) =>
    t.as(who, 'insert into body_measurements (user_id, weight_kg, height_cm) values ($1, $2, $3) returning id, entered_by', [userId, weight, height]);

  test('a player can add their own weight and height; entered_by is them', async () => {
    const r = await addMeasurement(anna, anna, 72.4, 178);
    assert.ok(r.ok, r.error);
    assert.equal(r.rows[0].entered_by, anna);
  });

  test("a player cannot add measurements for someone else", async () => {
    assert.equal((await addMeasurement(bob, anna, 70, null)).ok, false);
  });

  test('entered_by cannot be faked', async () => {
    const r = await t.as(anna, 'insert into body_measurements (user_id, weight_kg, entered_by) values ($1, 72, $2) returning entered_by', [anna, coach]);
    assert.ok(r.ok, r.error);
    assert.equal(r.rows[0].entered_by, anna);
  });

  test('empty and absurd values are refused', async () => {
    assert.equal((await addMeasurement(anna, anna, null, null)).ok, false);
    assert.equal((await addMeasurement(anna, anna, 900, null)).ok, false);
    assert.equal((await addMeasurement(anna, anna, null, 20)).ok, false);
  });

  test('a coach and an admin can add for a player and read everyone', async () => {
    assert.ok((await addMeasurement(coach, anna, 71.8, null)).ok);
    assert.ok((await addMeasurement(carl, bob, 80, 185)).ok);
    const seen = await t.as(coach, 'select user_id from body_measurements');
    assert.ok(seen.rows.some((r) => r.user_id === bob) && seen.rows.some((r) => r.user_id === anna));
  });

  test("players see only their own measurements, including a coach's weigh-in", async () => {
    const rows = (await t.as(anna, 'select user_id, entered_by from body_measurements')).rows;
    assert.ok(rows.length >= 2);
    assert.ok(rows.every((r) => r.user_id === anna));
    assert.ok(rows.some((r) => r.entered_by === coach));
  });

  test("a player can change their own entries but not a coach's weigh-in", async () => {
    const own = await t.as(anna, 'update body_measurements set weight_kg = 72.0 where entered_by = $1 returning id', [anna]);
    assert.ok(own.rows.length >= 1);
    const coachs = await t.as(anna, 'update body_measurements set weight_kg = 60 where entered_by = $1 returning id', [coach]);
    assert.equal(coachs.rows.length, 0, 'RLS filters it out');
    const del = await t.as(anna, 'delete from body_measurements where entered_by = $1 returning id', [coach]);
    assert.equal(del.rows.length, 0);
  });

  test('a deactivated coach loses access', async () => {
    const ex = await t.addUser('excoach@x', 'coach');
    await t.asOwner('update profiles set is_active = false where id = $1', [ex]);
    assert.equal((await t.as(ex, 'select * from body_measurements')).rows.length, 0);
    assert.equal((await addMeasurement(ex, anna, 70, null)).ok, false);
  });

  // ---- notes ----

  test('staff can write notes; the author is set automatically', async () => {
    const r = await t.as(coach, 'insert into player_notes (user_id, body, author_id) values ($1, $2, $3) returning author_id', [anna, 'Nevnte lett kneplage.', carl]);
    assert.ok(r.ok, r.error);
    assert.equal(r.rows[0].author_id, coach, 'cannot sign as someone else');
    assert.ok((await t.as(carl, 'insert into player_notes (user_id, body) values ($1, $2)', [anna, 'Snakket om rutiner.'])).ok);
  });

  test('players cannot read or write notes — not even about themselves', async () => {
    assert.equal((await t.as(anna, 'select * from player_notes')).rows.length, 0);
    assert.equal((await t.as(anna, 'insert into player_notes (user_id, body) values ($1, $2)', [anna, 'hei'])).ok, false);
  });

  test('empty notes are refused', async () => {
    assert.equal((await t.as(coach, 'insert into player_notes (user_id, body) values ($1, $2)', [anna, '   '])).ok, false);
  });

  test('only the author edits a note; the author or an admin deletes it', async () => {
    const carlsNote = (await t.as(carl, 'select id from player_notes where author_id = $1', [carl])).rows[0].id;
    const edit = await t.as(coach, 'update player_notes set body = $2 where id = $1 returning id', [carlsNote, 'endret']);
    assert.equal(edit.rows.length, 0, "a coach can't edit someone else's note");
    const coachsNote = (await t.as(coach, 'select id from player_notes where author_id = $1', [coach])).rows[0].id;
    const own = await t.as(coach, 'update player_notes set body = $2 where id = $1 returning updated_at > created_at as bumped', [coachsNote, 'Kneplage — følg opp med fysio.']);
    assert.equal(own.rows.length, 1);
    assert.equal((await t.as(coach, 'delete from player_notes where id = $1 returning id', [carlsNote])).rows.length, 0);
    assert.equal((await t.as(carl, 'delete from player_notes where id = $1 returning id', [coachsNote])).rows.length, 1, 'admins may delete');
  });

  test('deleting the player deletes their measurements and notes', async () => {
    await t.asOwner('delete from auth.users where id = $1', [anna]); // like the admin-users "delete" action
    assert.equal((await t.asOwner('select count(*)::int as n from body_measurements where user_id = $1', [anna]))[0].n, 0);
    assert.equal((await t.asOwner('select count(*)::int as n from player_notes where user_id = $1', [anna]))[0].n, 0);
  });
});
