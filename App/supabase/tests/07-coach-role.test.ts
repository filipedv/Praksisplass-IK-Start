// The coach role: a coach sees and helps only the players on THEIR teams,
// and everything club-wide stays admin-only.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('coach role', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  // anna + bob on A-lag, gina on G19. Coach Kari coaches A-lag, Gunnar G19.
  let anna: string, bob: string, gina: string, kari: string, gunnar: string, carl: string;
  let aLag: string, g19: string, annaMeal: string, ginaMeal: string, annaItem: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    bob = await t.addUser('bob@x');
    gina = await t.addUser('gina@x');
    kari = await t.addUser('kari@x', 'coach');
    gunnar = await t.addUser('gunnar@x', 'coach');
    carl = await t.addUser('carl@x', 'admin');
    aLag = (await t.asOwner(`insert into teams (name) values ('A-lag') returning id`))[0].id;
    g19 = (await t.asOwner(`insert into teams (name) values ('G19') returning id`))[0].id;
    await t.asOwner('update profiles set team_id = $1 where id = any($2)', [aLag, [anna, bob]]);
    await t.asOwner('update profiles set team_id = $1 where id = $2', [g19, gina]);
    // Assigned by an admin, as in the admin panel.
    assert.ok((await t.as(carl, 'insert into coach_teams (coach_id, team_id) values ($1, $2), ($3, $4)', [kari, aLag, gunnar, g19])).ok);

    const food = await t.addFood('Ris, kokt', { energy_kcal: 130, protein_g: 2.7 });
    const log = async (who: string) =>
      (await t.as(who, 'select log_meal($1::jsonb) as id', [JSON.stringify([{ food_id: food, amount_g: 200 }])])).rows[0].id as string;
    annaMeal = await log(anna);
    ginaMeal = await log(gina);
    annaItem = (await t.asOwner('select id from meal_items where meal_id = $1', [annaMeal]))[0].id;
    await t.as(anna, 'insert into water_logs (amount_ml) values (500)');
    await t.as(gina, 'insert into water_logs (amount_ml) values (300)');
  });

  // ---- assignments ----

  test('only admins assign coaches; a coach sees their own assignments', async () => {
    assert.equal((await t.as(kari, 'insert into coach_teams (coach_id, team_id) values ($1, $2)', [kari, g19])).ok, false);
    const mine = await t.as(kari, 'select team_id from coach_teams');
    assert.deepEqual(mine.rows.map((r) => r.team_id), [aLag], "not Gunnar's");
  });

  test('only users with the coach role can be assigned', async () => {
    const r = await t.as(carl, 'insert into coach_teams (coach_id, team_id) values ($1, $2)', [anna, aLag]);
    assert.equal(r.ok, false);
  });

  test('assignments are written to the change log', async () => {
    const rows = await t.asOwner(`select actor_id, subject_user_id from audit_log where table_name = 'coach_teams'`);
    assert.ok(rows.some((r) => r.actor_id === carl && r.subject_user_id === kari));
  });

  // ---- who a coach sees ----

  test("a coach sees their own players' profiles (and other staff) — not other teams' players", async () => {
    const ids = (await t.as(kari, 'select id from profiles')).rows.map((r) => r.id);
    assert.ok(ids.includes(anna) && ids.includes(bob), 'own players');
    assert.ok(!ids.includes(gina), "not G19's player");
    assert.ok(ids.includes(gunnar) && ids.includes(carl), 'staff names (for notes and weigh-ins)');
  });

  test("a coach reads their players' meals, water and daily summary — nobody else's", async () => {
    assert.equal((await t.as(kari, 'select id from meals where id = $1', [annaMeal])).rows.length, 1);
    assert.equal((await t.as(kari, 'select id from meals where id = $1', [ginaMeal])).rows.length, 0);
    const water = (await t.as(kari, 'select user_id from water_logs')).rows.map((r) => r.user_id);
    assert.ok(water.includes(anna) && !water.includes(gina));
    const summary = (await t.as(kari, `select user_id from daily_summary(current_date - 1, current_date + 1)`)).rows.map((r) => r.user_id);
    assert.ok(summary.includes(anna) && !summary.includes(gina));
  });

  test('a coach cannot add or change water (read only)', async () => {
    assert.equal((await t.as(kari, 'insert into water_logs (user_id, amount_ml) values ($1, 200)', [anna])).ok, false);
    assert.equal((await t.as(kari, 'update water_logs set amount_ml = 2000 where user_id = $1 returning id', [anna])).rows.length, 0);
  });

  test('a coach without teams sees no players', async () => {
    const solo = await t.addUser('solo-coach@x', 'coach');
    const ids = (await t.as(solo, `select id from profiles where role = 'player'`)).rows;
    assert.equal(ids.length, 0);
    assert.equal((await t.as(solo, 'select id from meals')).rows.length, 0);
  });

  test('a deactivated player is not shown to their coach', async () => {
    const away = await t.addUser('away@x');
    await t.asOwner('update profiles set team_id = $1, is_active = false where id = $2', [aLag, away]);
    assert.equal((await t.as(kari, 'select id from profiles where id = $1', [away])).rows.length, 0);
  });

  // ---- what a coach may change ----

  test("a coach corrects their player's meal; the player sees it was changed; it's logged", async () => {
    const r = await t.as(kari, 'select update_meal_item_amount($1, 150)', [annaItem]);
    assert.ok(r.ok, r.error);
    const meal = (await t.as(anna, 'select admin_changed_at from meals where id = $1', [annaMeal])).rows[0];
    assert.ok(meal.admin_changed_at, '"Endret av trener eller admin"');
    const log = await t.asOwner(`select actor_id from audit_log where table_name = 'meal_items' and subject_user_id = $1`, [anna]);
    assert.ok(log.some((e) => e.actor_id === kari));
  });

  test("a coach cannot touch another team's meals", async () => {
    const item = (await t.asOwner('select id from meal_items where meal_id = $1', [ginaMeal]))[0].id;
    assert.equal((await t.as(kari, 'select update_meal_item_amount($1, 10)', [item])).ok, false);
    assert.equal((await t.as(kari, 'select delete_meal_item($1)', [item])).ok, false);
  });

  test("a coach sets their player's goals, not other teams'", async () => {
    assert.ok((await t.as(kari, 'insert into player_goals (user_id, goal_kcal) values ($1, 3200)', [anna])).ok);
    assert.equal((await t.as(anna, 'select goal_kcal from effective_goals()')).rows[0].goal_kcal, 3200);
    assert.equal((await t.as(kari, 'insert into player_goals (user_id, goal_kcal) values ($1, 3200)', [gina])).ok, false);
  });

  test("a coach changes their team's goals — not its name, and not other teams", async () => {
    const goals = await t.as(kari, 'update teams set goal_water_ml = 3000 where id = $1 returning id', [aLag]);
    assert.equal(goals.rows.length, 1);
    assert.equal((await t.as(kari, `update teams set name = 'Kari FC' where id = $1`, [aLag])).ok, false);
    assert.equal((await t.as(kari, 'update teams set goal_water_ml = 1 where id = $1 returning id', [g19])).rows.length, 0);
    assert.equal((await t.as(kari, `insert into teams (name) values ('Nytt lag')`)).ok, false);
    assert.equal((await t.as(kari, 'delete from teams where id = $1 returning id', [aLag])).rows.length, 0);
  });

  test("a coach cannot change a player's team or role", async () => {
    assert.equal((await t.as(kari, 'update profiles set team_id = $1 where id = $2 returning id', [g19, anna])).rows.length, 0);
    assert.equal((await t.as(kari, `update profiles set role = 'admin' where id = $1 returning id`, [anna])).rows.length, 0);
  });

  test('weigh-ins and notes: only the player\'s own coaches', async () => {
    assert.ok((await t.as(kari, 'insert into body_measurements (user_id, weight_kg) values ($1, 72)', [anna])).ok);
    assert.equal((await t.as(gunnar, 'insert into body_measurements (user_id, weight_kg) values ($1, 72)', [anna])).ok, false);
    assert.equal((await t.as(gunnar, 'select id from body_measurements where user_id = $1', [anna])).rows.length, 0);
    assert.ok((await t.as(kari, 'insert into player_notes (user_id, body) values ($1, $2)', [anna, 'Bra uke.'])).ok);
    assert.equal((await t.as(gunnar, 'select id from player_notes where user_id = $1', [anna])).rows.length, 0);
    assert.equal((await t.as(gunnar, 'insert into player_notes (user_id, body) values ($1, $2)', [anna, 'x'])).ok, false);
  });

  test('"Fulgt opp" is shared by admins and the player\'s coach', async () => {
    assert.ok((await t.as(kari, 'insert into followup_dismissals (item_key, subject_user_id) values ($1, $2)', [`logging:${anna}`, anna])).ok);
    assert.equal((await t.as(carl, 'select item_key from followup_dismissals where subject_user_id = $1', [anna])).rows.length, 1, 'the admin sees it');
    assert.equal((await t.as(gunnar, 'select item_key from followup_dismissals')).rows.length, 0, "another team's coach doesn't");
    assert.equal((await t.as(kari, 'insert into followup_dismissals (item_key, subject_user_id) values ($1, $2)', [`logging:${gina}`, gina])).ok, false);
    assert.equal((await t.as(kari, 'insert into followup_dismissals (item_key) values ($1)', ['logging:x'])).ok, false, 'needs a player');
  });

  test('club-wide things stay admin-only', async () => {
    assert.equal((await t.as(kari, 'update club_settings set default_goal_kcal = 1 where id = 1 returning id')).rows.length, 0);
    assert.equal((await t.as(kari, 'select id from audit_log')).rows.length, 0);
    assert.equal((await t.as(kari, `insert into foods (source, name_nb) values ('custom', 'x')`)).ok, false);
    assert.equal((await t.as(kari, 'select id from recognition_events')).rows.length, 0);
  });

  test('a coach who is deactivated or changed to another role loses access at once', async () => {
    const ex = await t.addUser('ex-coach@x', 'coach');
    await t.asOwner('insert into coach_teams (coach_id, team_id) values ($1, $2)', [ex, aLag]);
    assert.equal((await t.as(ex, 'select id from meals where id = $1', [annaMeal])).rows.length, 1);
    await t.asOwner(`update profiles set role = 'player' where id = $1`, [ex]);
    assert.equal((await t.as(ex, 'select id from meals where id = $1', [annaMeal])).rows.length, 0, 'role changed');
    await t.asOwner(`update profiles set role = 'coach', is_active = false where id = $1`, [ex]);
    assert.equal((await t.as(ex, 'select id from meals where id = $1', [annaMeal])).rows.length, 0, 'deactivated');
  });

  // ---- fixtures ----

  const save = (who: string, id: string | null, teams: string[]) =>
    t.as(who, 'select save_fixture($1, $2::jsonb, $3::uuid[], $4::jsonb) as id', [
      id,
      JSON.stringify({ kind: 'training', starts_at: '2026-12-01T16:00:00Z', ends_at: '2026-12-01T17:30:00Z' }),
      teams,
      JSON.stringify([{ anchor: 'after_end', offset_minutes: 0, body_nb: 'Bra økt!' }]),
    ]);

  test('a coach adds, changes and deletes fixtures for their own team', async () => {
    const r = await save(kari, null, [aLag]);
    assert.ok(r.ok, r.error);
    const id = r.rows[0].id;
    assert.ok((await save(kari, id, [aLag])).ok, 'edit');
    assert.equal((await t.as(gunnar, 'select id from fixtures where id = $1', [id])).rows.length, 0, "G19's coach doesn't see it");
    assert.equal((await t.as(kari, 'delete from fixtures where id = $1 returning id', [id])).rows.length, 1);
  });

  test("a coach cannot add a fixture for a team they don't coach", async () => {
    const r = await save(kari, null, [aLag, g19]);
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /own teams/);
  });

  test("an admin's fixture for the coach's team can be edited by the coach", async () => {
    const id = (await save(carl, null, [aLag])).rows[0].id;
    assert.ok((await save(kari, id, [aLag])).ok);
  });

  test('a fixture shared with another team: the coach sees it but only an admin changes it', async () => {
    const id = (await save(carl, null, [aLag, g19])).rows[0].id;
    assert.equal((await t.as(kari, 'select id from fixtures where id = $1', [id])).rows.length, 1, 'sees it');
    assert.equal((await t.as(kari, 'select team_id from fixture_teams where fixture_id = $1', [id])).rows.length, 2, 'sees both teams');
    const edit = await save(kari, id, [aLag]);
    assert.equal(edit.ok, false, "can't take it away from G19");
    assert.equal((await t.as(kari, 'delete from fixtures where id = $1 returning id', [id])).rows.length, 0);
    assert.equal((await t.as(kari, `update fixture_reminders set body_nb = 'x' where fixture_id = $1 returning id`, [id])).rows.length, 0);
    assert.equal((await t.as(kari, 'delete from fixture_teams where fixture_id = $1 returning team_id', [id])).rows.length, 0);
  });

  test("a G19-only fixture is invisible to A-lag's coach", async () => {
    const id = (await save(gunnar, null, [g19])).rows[0].id;
    assert.equal((await t.as(kari, 'select id from fixtures where id = $1', [id])).rows.length, 0);
    assert.equal((await t.as(kari, 'select id from fixture_reminders where fixture_id = $1', [id])).rows.length, 0);
    assert.equal((await t.as(gina, 'select id from fixtures where id = $1', [id])).rows.length, 1, 'the G19 player sees it');
  });
});
