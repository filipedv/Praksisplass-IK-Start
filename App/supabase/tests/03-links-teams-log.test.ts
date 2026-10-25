// Label links (food_aliases), teams + effective goals, the change log,
// and meal corrections (update_meal_item_amount / delete_meal_item).

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('food_aliases (the link list)', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, carl: string, chicken: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    carl = await t.addUser('carl@x', 'admin');
    chicken = await t.addFood('Kylling, filet, uten skinn, rå', { energy_kcal: 107 });
  });

  test('only admins create links; labels are normalised; created_by is stamped', async () => {
    assert.equal((await t.as(anna, `insert into food_aliases (label, food_id) values ('x', $1)`, [chicken])).ok, false);
    const r = await t.as(carl, `insert into food_aliases (label, food_id, created_by) values ('  Chicken Breast ', $1, $2) returning label, created_by`, [chicken, anna]);
    assert.equal(r.rows[0].label, 'chicken breast');
    assert.equal(r.rows[0].created_by, carl, 'the client cannot fake who made the link');
  });
  test('a label can only be linked once (any case)', async () => {
    assert.equal((await t.as(carl, `insert into food_aliases (label, food_id) values ('CHICKEN BREAST', $1)`, [chicken])).ok, false);
  });
  test('players can read links (needed for matching); visitors cannot', async () => {
    assert.equal((await t.as(anna, 'select * from food_aliases')).rows.length, 1);
    const anon = await t.as(null, 'select * from food_aliases');
    assert.ok(!anon.ok || anon.rows.length === 0);
  });
});

describe('teams, effective goals and the change log', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, carl: string, team: string, food: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    carl = await t.addUser('carl@x', 'admin');
    food = await t.addFood('Ris', { energy_kcal: 150, protein_g: 3 });
  });

  test('only admins create teams; players cannot move themselves to a team', async () => {
    assert.equal((await t.as(anna, `insert into teams (name) values ('x')`)).ok, false);
    team = (await t.as(carl, `insert into teams (name, goal_kcal, goal_water_ml) values ('A-lag', 3200, 3000) returning id`)).rows[0].id;
    assert.equal((await t.as(anna, 'update profiles set team_id = $1 where id = $2', [team, anna])).ok, false);
    assert.equal((await t.as(carl, 'update profiles set team_id = $1 where id = $2 returning id', [team, anna])).rows.length, 1);
  });
  test('effective goals: own → team → club', async () => {
    let g = (await t.as(anna, 'select * from effective_goals()')).rows[0];
    assert.deepEqual([g.goal_kcal, g.goal_water_ml, g.goal_protein_g], [3200, 3000, 130]); // team, team, club
    await t.as(carl, 'insert into player_goals (user_id, goal_kcal) values ($1, 3500)', [anna]);
    g = (await t.as(anna, 'select * from effective_goals()')).rows[0];
    assert.equal(g.goal_kcal, 3500, 'own goal beats the team');
    assert.equal((await t.as(bob, 'select goal_kcal from effective_goals($1)', [anna])).rows[0].goal_kcal, 2800, 'no leak to others');
  });
  test('the change log: admin-only reading, nobody can write it directly', async () => {
    assert.equal((await t.as(anna, 'select * from audit_log')).rows.length, 0);
    assert.equal((await t.as(carl, `insert into audit_log (action, table_name) values ('insert','fake')`)).ok, false);
    const log = (await t.as(carl, 'select table_name, changes from audit_log')).rows;
    assert.ok(log.some((l) => l.table_name === 'teams'));
    assert.ok(log.some((l) => l.table_name === 'profiles' && l.changes.team_id?.[1] === team));
  });
  test("players' own logging is not logged; an admin's correction is", async () => {
    const before = (await t.asOwner('select count(*)::int c from audit_log'))[0].c;
    const meal = (await t.as(anna, 'select log_meal($1::jsonb) as id', [JSON.stringify([{ food_id: food, amount_g: 1500 }, { food_id: food, amount_g: 100 }])])).rows[0].id;
    assert.equal((await t.asOwner('select count(*)::int c from audit_log'))[0].c, before);

    const items = (await t.as(carl, 'select id from meal_items where meal_id = $1 order by amount_g desc', [meal])).rows;
    assert.equal((await t.as(bob, 'select update_meal_item_amount($1, 150)', [items[0].id])).ok, false, 'other players cannot');
    assert.ok((await t.as(carl, 'select update_meal_item_amount($1, 150)', [items[0].id])).ok);
    const item = (await t.as(carl, 'select amount_g::float a, nutrition from meal_items where id = $1', [items[0].id])).rows[0];
    assert.equal(item.a, 150);
    assert.equal(Number(item.nutrition.energy_kcal), 225, 'nutrition scaled with the amount (2250 → 225)');
    const entry = (await t.as(carl, `select subject_user_id, changes from audit_log where table_name = 'meal_items' order by id desc limit 1`)).rows[0];
    assert.equal(entry.subject_user_id, anna);

    // Deleting the last item removes the empty meal.
    await t.as(carl, 'select delete_meal_item($1)', [items[1].id]);
    await t.as(carl, 'select delete_meal_item($1)', [items[0].id]);
    assert.equal((await t.as(carl, 'select count(*)::int c from meals where id = $1', [meal])).rows[0].c, 0);
  });
  test('deleting a team leaves its players without a team', async () => {
    await t.as(carl, 'delete from teams where id = $1', [team]);
    assert.equal((await t.as(carl, 'select team_id from profiles where id = $1', [anna])).rows[0].team_id, null);
  });
});
