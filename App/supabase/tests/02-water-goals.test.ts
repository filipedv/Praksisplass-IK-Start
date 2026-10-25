// Water logs, per-player goals (goals_for), daily_summary() and last_activity().

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('water_logs', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, carl: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    carl = await t.addUser('carl@x', 'admin');
  });

  test('a player logs water (user_id defaults to themselves)', async () => {
    const r = await t.as(anna, 'insert into water_logs (amount_ml) values (330) returning user_id');
    assert.equal(r.rows[0].user_id, anna);
  });
  test('cannot log water for someone else, nor 0 ml or over 2000 ml', async () => {
    assert.equal((await t.as(anna, 'insert into water_logs (user_id, amount_ml) values ($1, 200)', [bob])).ok, false);
    assert.equal((await t.as(anna, 'insert into water_logs (amount_ml) values (0)')).ok, false);
    assert.equal((await t.as(anna, 'insert into water_logs (amount_ml) values (5000)')).ok, false);
  });
  test("others can't see or delete it; admins can see it", async () => {
    assert.equal((await t.as(bob, 'select * from water_logs')).rows.length, 0);
    assert.equal((await t.as(bob, 'delete from water_logs returning id')).rows.length, 0);
    assert.equal((await t.as(carl, 'select * from water_logs')).rows.length, 1);
  });
});

describe('goals and summaries', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, carl: string, food: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    carl = await t.addUser('carl@x', 'admin');
    food = await t.addFood('Testmat', { energy_kcal: 200, protein_g: 10 });
  });

  test('no own goals → club defaults', async () => {
    const r = await t.as(anna, 'select * from goals_for()');
    assert.equal(r.rows[0].goal_kcal, 2800);
    assert.equal(r.rows[0].has_custom, false);
  });
  test('only admins set goals; updated_by is stamped by the database', async () => {
    assert.equal((await t.as(anna, 'insert into player_goals (user_id, goal_kcal) values ($1, 9999)', [anna])).ok, false);
    const r = await t.as(carl, 'insert into player_goals (user_id, goal_kcal, goal_water_ml) values ($1, 3200, 3000) returning updated_by', [anna]);
    assert.equal(r.rows[0].updated_by, carl);
  });
  test("goals don't leak to other players", async () => {
    assert.equal((await t.as(bob, 'select * from player_goals')).rows.length, 0);
    const r = await t.as(bob, 'select goal_kcal from goals_for($1)', [anna]);
    assert.equal(r.rows[0].goal_kcal, 2800, 'another player only gets the club default');
  });
  test('daily_summary groups by NORWEGIAN day (00:30 Oslo belongs to the new day)', async () => {
    // 21:30 UTC on 14 Oct = 23:30 Oslo (14th); 22:30 UTC = 00:30 Oslo (15th)
    await t.as(anna, `select log_meal($1::jsonb, '2026-10-14 21:30:00+00')`, [JSON.stringify([{ food_id: food, amount_g: 100 }])]);
    await t.as(anna, `select log_meal($1::jsonb, '2026-10-14 22:30:00+00')`, [JSON.stringify([{ food_id: food, amount_g: 100 }])]);
    await t.as(anna, `insert into water_logs (amount_ml, logged_at) values (330, '2026-10-16 10:00:00+00')`);
    const r = await t.as(carl, `select day::text, meals, kcal::float, water_ml from daily_summary('2026-10-14','2026-10-16', $1) order by day`, [anna]);
    assert.deepEqual(
      r.rows.map((x) => [x.day, x.meals, x.kcal, x.water_ml]),
      [
        ['2026-10-14', 1, 200, 0],
        ['2026-10-15', 1, 200, 0],
        ['2026-10-16', 0, 0, 330], // water-only day
      ],
    );
  });
  test('a player sees only themselves in daily_summary and last_activity', async () => {
    await t.as(bob, `select log_meal($1::jsonb, '2026-10-15 12:00:00+00')`, [JSON.stringify([{ food_id: food, amount_g: 50 }])]);
    const sum = await t.as(anna, `select distinct user_id from daily_summary('2026-10-01','2026-10-31')`);
    assert.deepEqual(sum.rows.map((x) => x.user_id), [anna]);
    assert.equal((await t.as(anna, 'select * from last_activity()')).rows.length, 1);
    assert.equal((await t.as(carl, 'select * from last_activity()')).rows.length, 3);
  });
});
