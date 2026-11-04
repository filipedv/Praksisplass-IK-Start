// Core security model (first migration): profiles, meals, foods, club
// settings, log_meal() and search_foods() ranking.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('core RLS and functions', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, carl: string, banana: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    carl = await t.addUser('carl@x', 'admin');
    banana = await t.addFood('Banan, rå', { energy_kcal: 88, protein_g: 1.1 }, { name_en: 'Banana, raw' });
  });

  test('a player sees only their own profile', async () => {
    const r = await t.as(anna, 'select id from profiles');
    assert.deepEqual(r.rows.map((x) => x.id), [anna]);
  });

  test('a player cannot make themselves admin', async () => {
    const r = await t.as(anna, `update profiles set role = 'admin' where id = $1`, [anna]);
    assert.equal(r.ok, false);
    assert.match(r.error!, /Only an admin/);
  });

  test("a player cannot edit someone else's profile", async () => {
    const r = await t.as(anna, `update profiles set display_name = 'hacked' where id = $1 returning id`, [bob]);
    assert.equal(r.rows.length, 0);
  });

  test('log_meal computes nutrition in the database and is all-or-nothing', async () => {
    const ok = await t.as(anna, 'select log_meal($1::jsonb) as id', [JSON.stringify([{ food_id: banana, amount_g: 150 }])]);
    assert.ok(ok.ok, ok.error);
    const item = await t.as(anna, 'select nutrition from meal_items');
    assert.equal(Number(item.rows[0].nutrition.energy_kcal), 132); // 88 × 1.5

    const bad = await t.as(anna, 'select log_meal($1::jsonb)', [
      JSON.stringify([{ food_id: '11111111-1111-1111-1111-111111111111', amount_g: 1 }]),
    ]);
    assert.equal(bad.ok, false);
    const meals = await t.as(anna, 'select count(*)::int c from meals');
    assert.equal(meals.rows[0].c, 1, 'the failed call must not leave a meal behind');
  });

  test("other players can't see a player's meals; admins can", async () => {
    assert.equal((await t.as(bob, 'select * from meals')).rows.length, 0);
    assert.equal((await t.as(bob, 'select * from meal_items')).rows.length, 0);
    assert.equal((await t.as(carl, 'select * from meals')).rows.length, 1);
  });

  test('a player cannot create a meal for someone else', async () => {
    const r = await t.as(anna, 'insert into meals (user_id) values ($1)', [bob]);
    assert.equal(r.ok, false);
  });

  test('foods: only admins write, and only custom foods', async () => {
    assert.equal((await t.as(anna, `insert into foods (source, name_nb, nutrition) values ('custom','x','{}')`)).ok, false);
    assert.ok((await t.as(carl, `insert into foods (source, name_nb, nutrition) values ('custom','Startburger','{}')`)).ok);
    assert.equal(
      (await t.as(carl, `insert into foods (source, source_id, name_nb, nutrition) values ('matvaretabellen','99','x','{}')`)).ok,
      false,
    );
    const edit = await t.as(carl, `update foods set name_nb = 'x' where id = $1 returning id`, [banana]);
    assert.equal(edit.rows.length, 0, 'admins must not edit seeded Matvaretabellen rows');
  });

  test('club settings: readable by players, writable by admins only', async () => {
    assert.equal((await t.as(anna, 'select club_name from club_settings')).rows[0].club_name, 'IK Start');
    assert.equal((await t.as(anna, `update club_settings set club_name = 'x' returning id`)).rows.length, 0);
    assert.equal((await t.as(carl, `update club_settings set default_goal_kcal = 3000 returning id`)).rows.length, 1);
  });

  test('deactivated users lose all access — including admins', async () => {
    await t.as(carl, 'update profiles set is_active = false where id = $1', [anna]);
    assert.equal((await t.as(anna, 'select * from meals')).rows.length, 0);
    assert.equal((await t.as(anna, 'select log_meal($1::jsonb)', [JSON.stringify([{ food_id: banana, amount_g: 1 }])])).ok, false);
    await t.as(carl, 'update profiles set is_active = true where id = $1', [anna]);

    await t.asOwner('update profiles set is_active = false where id = $1', [carl]);
    assert.equal((await t.as(carl, 'select * from profiles')).rows.length, 0);
    await t.asOwner('update profiles set is_active = true where id = $1', [carl]);
  });
});

describe('search_foods ranking (Matvaretabellen naming: "<base>, <details>")', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    // Pairs where the WRONG one used to win before the tie-breakers.
    await t.addFood('Eplemos', { energy_kcal: 80 }, { name_en: 'Apple jam' });
    await t.addFood('Eple, rå', { energy_kcal: 50 }, { name_en: 'Apple, raw' });
    await t.addFood('Potetchips', { energy_kcal: 530 }, { name_en: 'Potato crisps' });
    await t.addFood('Potet, høstpotet, rå', { energy_kcal: 70 }, { name_en: 'Potatoes, autumn, raw' });
    await t.addFood('Melk, uspesifisert', { energy_kcal: 46 }, { name_en: 'Milk, unspecified' });
    await t.addFood('Melkesjokolade', { energy_kcal: 540 }, { name_en: 'Milk chocolate' });
  });

  const top = async (label: string) => (await t.as(anna, 'select name_nb, score from search_foods($1, 1)', [label])).rows[0];

  test('"apple" → the raw apple, not apple jam', async () => {
    assert.equal((await top('apple')).name_nb, 'Eple, rå');
  });
  test('"potato" → raw potatoes (English plural), not crisps', async () => {
    assert.equal((await top('potato')).name_nb, 'Potet, høstpotet, rå');
  });
  test('"milk" → plain milk (generic first), not milk chocolate', async () => {
    assert.equal((await top('milk')).name_nb, 'Melk, uspesifisert');
  });
  test('Norwegian search works too', async () => {
    assert.equal((await top('eple')).name_nb, 'Eple, rå');
  });
});
