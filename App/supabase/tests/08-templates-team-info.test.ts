// Reminder templates: a coach changes only their own; the club's are the
// admins'. And my_team_info(): a player sees their team and its coaches.

import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { createTestDb } from './helpers.ts';

describe('template owners & my team info', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let anna: string, solo: string, kari: string, ola: string, gone: string, carl: string;

  before(async () => {
    t = await createTestDb();
    anna = await t.addUser('anna@x');
    solo = await t.addUser('solo@x');
    kari = await t.addUser('kari@x', 'coach');
    ola = await t.addUser('ola@x', 'coach');
    gone = await t.addUser('gone@x', 'coach');
    carl = await t.addUser('carl@x', 'admin');
    await t.asOwner(`update profiles set display_name = 'Kari' where id = $1`, [kari]);
    await t.asOwner(`update profiles set display_name = 'Ola' where id = $1`, [ola]);
    const team = (await t.asOwner(`insert into teams (name) values ('A-lag') returning id`))[0].id;
    await t.asOwner('update profiles set team_id = $1 where id = $2', [team, anna]);
    await t.asOwner('insert into coach_teams (coach_id, team_id) values ($1, $4), ($2, $4), ($3, $4)', [kari, ola, gone, team]);
    await t.asOwner('update profiles set is_active = false where id = $1', [gone]);
  });

  const addTemplate = (who: string) =>
    t.as(
      who,
      `insert into reminder_templates (kind, name, anchor, offset_minutes, body_nb, created_by)
       values ('training', 'Min mal', 'before_start', 60, 'Husk vann!', $1) returning id, created_by`,
      [carl],
    );

  test("a coach adds a template; it is theirs (can't be made in someone else's name)", async () => {
    const r = await addTemplate(kari);
    assert.ok(r.ok, r.error);
    assert.equal(r.rows[0].created_by, kari);
  });

  test('a coach changes and deletes only their own templates', async () => {
    const own = (await t.as(kari, 'select id from reminder_templates where created_by = $1', [kari])).rows[0].id;
    assert.equal((await t.as(kari, `update reminder_templates set name = 'Ny' where id = $1 returning id`, [own])).rows.length, 1);
    assert.equal((await t.as(ola, `update reminder_templates set name = 'Hack' where id = $1 returning id`, [own])).rows.length, 0, "not another coach's");
    assert.equal((await t.as(kari, `update reminder_templates set name = 'Hack' where created_by is null returning id`)).rows.length, 0, "not the club's");
    assert.equal((await t.as(kari, 'delete from reminder_templates where created_by is null returning id')).rows.length, 0);
    assert.equal((await t.as(kari, 'delete from reminder_templates where id = $1 returning id', [own])).rows.length, 1);
  });

  test("ownership can't be changed, and admins change everything", async () => {
    const id = (await addTemplate(kari)).rows[0].id;
    await t.as(kari, 'update reminder_templates set created_by = $2 where id = $1', [id, ola]);
    assert.equal((await t.asOwner('select created_by from reminder_templates where id = $1', [id]))[0].created_by, kari);
    assert.ok((await t.as(carl, `update reminder_templates set name = 'Klubb' where created_by is null returning id`)).rows.length >= 8);
  });

  test('every coach still sees the whole library; players see none', async () => {
    assert.ok((await t.as(ola, 'select id from reminder_templates')).rows.length >= 9);
    assert.equal((await t.as(anna, 'select id from reminder_templates')).rows.length, 0);
  });

  test("my_team_info(): the player's team and active coaches, sorted", async () => {
    const row = (await t.as(anna, 'select * from my_team_info()')).rows[0];
    assert.equal(row.team_name, 'A-lag');
    assert.deepEqual(row.coach_names, ['Kari', 'Ola'], 'the deactivated coach is left out');
  });

  test('my_team_info(): no team → no team name, no coaches; logged out → nothing', async () => {
    const row = (await t.as(solo, 'select * from my_team_info()')).rows[0];
    assert.equal(row.team_name, null);
    assert.deepEqual(row.coach_names, []);
    assert.equal((await t.as(null, 'select * from my_team_info()')).rows.length, 0);
  });
});
