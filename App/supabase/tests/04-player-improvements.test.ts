// Player & admin improvements: "Endret av administrator" marker,
// add_meal_item(), recent_foods() and follow-up dismissals.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('player & admin improvements', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, bob: string, carl: string, rice: string, egg: string, meal: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    carl = await t.addUser('carl@x', 'admin');
    rice = await t.addFood('Ris, kokt', { energy_kcal: 130, protein_g: 2.5 });
    egg = await t.addFood('Egg, kokt', { energy_kcal: 150, protein_g: 13 });
    meal = (await t.as(anna, 'select log_meal($1::jsonb) as id', [JSON.stringify([{ food_id: rice, amount_g: 200 }])])).rows[0].id;
  });

  const changedAt = async () => (await t.as(anna, 'select admin_changed_at from meals where id = $1', [meal])).rows[0].admin_changed_at;

  test("a player's own edits do NOT mark the meal as changed by an admin", async () => {
    const item = (await t.as(anna, 'select id from meal_items where meal_id = $1', [meal])).rows[0].id;
    assert.ok((await t.as(anna, 'select update_meal_item_amount($1, 180)', [item])).ok, 'players may correct their own items');
    assert.equal(await changedAt(), null);
  });

  test('a player can add a food to their own meal; nutrition is computed in the DB', async () => {
    const r = await t.as(anna, 'select add_meal_item($1, $2, 120) as id', [meal, egg]);
    assert.ok(r.ok, r.error);
    const item = (await t.as(anna, 'select food_name, nutrition, detected_label from meal_items where id = $1', [r.rows[0].id])).rows[0];
    assert.equal(item.food_name, 'Egg, kokt');
    assert.equal(Number(item.nutrition.energy_kcal), 180); // 150 × 1.2
    assert.equal(item.detected_label, null);
    assert.equal(await changedAt(), null);
  });

  test("another player cannot add to someone else's meal", async () => {
    assert.equal((await t.as(bob, 'select add_meal_item($1, $2, 100)', [meal, egg])).ok, false);
  });

  test('invalid amounts and unknown foods are refused', async () => {
    assert.equal((await t.as(anna, 'select add_meal_item($1, $2, 0)', [meal, egg])).ok, false);
    assert.equal((await t.as(anna, 'select add_meal_item($1, $2, 100)', [meal, '11111111-1111-1111-1111-111111111111'])).ok, false);
  });

  test('an ADMIN adding to the meal marks it "changed by administrator" (visible to the player)', async () => {
    assert.ok((await t.as(carl, 'select add_meal_item($1, $2, 60)', [meal, egg])).ok);
    assert.notEqual(await changedAt(), null, 'the player can read the marker on their own meal');
  });

  test('an admin changing the meal time also marks it', async () => {
    const meal2 = (await t.as(anna, 'select log_meal($1::jsonb) as id', [JSON.stringify([{ food_id: rice, amount_g: 100 }])])).rows[0].id;
    await t.as(carl, `update meals set eaten_at = now() - interval '1 hour' where id = $1`, [meal2]);
    assert.notEqual((await t.as(anna, 'select admin_changed_at from meals where id = $1', [meal2])).rows[0].admin_changed_at, null);
  });

  test("an admin's additions are in the change log; the player's own are not", async () => {
    const entries = (
      await t.as(carl, `select actor_id, action from audit_log where table_name = 'meal_items' and subject_user_id = $1`, [anna])
    ).rows;
    assert.ok(entries.some((e) => e.action === 'insert' && e.actor_id === carl), 'admin addition logged');
    assert.ok(!entries.some((e) => e.actor_id === anna), "the player's own edits/additions are not logged");
  });

  test('recent_foods returns the CALLER\'s own most-used foods with a typical amount', async () => {
    await t.as(anna, 'select log_meal($1::jsonb)', [JSON.stringify([{ food_id: egg, amount_g: 100 }])]);
    await t.as(anna, 'select log_meal($1::jsonb)', [JSON.stringify([{ food_id: egg, amount_g: 140 }])]);
    const r = await t.as(anna, 'select name_nb, times_used, typical_amount_g::float g from recent_foods(5)');
    assert.equal(r.rows[0].name_nb, 'Egg, kokt', 'most used first');
    assert.equal(r.rows[0].times_used, 4); // 120 (own) + 60 (admin) + 100 + 140
    assert.ok(r.rows[0].g > 0);
    // An admin calling it gets THEIR OWN list (empty), not the players'.
    assert.equal((await t.as(carl, 'select * from recent_foods(5)')).rows.length, 0);
    assert.equal((await t.as(bob, 'select * from recent_foods(5)')).rows.length, 0);
  });

  test('follow-up dismissals are admin-only', async () => {
    assert.equal((await t.as(anna, `insert into followup_dismissals (item_key) values ('logging:x')`)).ok, false);
    const r = await t.as(carl, `insert into followup_dismissals (item_key, expires_at) values ('logging:x', now() + interval '7 days') returning dismissed_by`);
    assert.equal(r.rows[0].dismissed_by, carl);
    assert.equal((await t.as(anna, 'select * from followup_dismissals')).rows.length, 0);
    assert.equal((await t.as(carl, 'select * from followup_dismissals')).rows.length, 1);
  });
});
