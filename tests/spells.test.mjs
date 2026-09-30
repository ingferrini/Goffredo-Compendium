import assert from 'node:assert/strict';
import test from 'node:test';

import * as breath from '../scripts/spells/dragons-breath.mjs';
import * as meteors from '../scripts/spells/melfs-minute-meteors.mjs';

const MODULE_ID = 'goffredo-compendium';

function effectStore() {
  const created = [];
  const deleted = [];
  const updated = [];
  return {
    created, deleted, updated,
    documentUtils: {
      getBaseEffectData: (_document, {identifier, parentEntity, ...rest}) => ({...rest, flags: {cat: {identifier}}, parentEntity}),
      async deleteDocument(document) { deleted.push(document); },
      async update(document, changes) { updated.push([document, changes]); }
    },
    effectUtils: {
      getConcentrationEffect: () => ({id: 'concentration'}),
      async createEffects(actor, datas) {
        const effects = datas.map(data => ({...data, actor}));
        created.push(...effects);
        return effects;
      }
    }
  };
}

function breathContext({targets = [{actor: {name: 'Korax'}}], castLevel = 2, choice = 'cold'} = {}) {
  const store = effectStore();
  const items = [];
  const deps = {
    ...store,
    actorUtils: {getEffectByIdentifier: () => undefined},
    dialogUtils: {selectDamageType: async () => choice},
    itemUtils: {
      getSaveDC: () => 17,
      async createItems(actor, datas, options) { items.push({actor, datas, options}); return datas; }
    },
    workflowUtils: {getCastLevel: () => castLevel}
  };
  const item = {name: "Dragon's Breath", img: 'breath.webp', uuid: 'Item.breath'};
  const workflow = {actor: {name: 'Woland'}, activity: {identifier: 'dragonsBreath'}, targets: new Set(targets)};
  return {deps, item, items, store, workflow};
}

test('Dragon\'s Breath rolls 3d6 at 2nd level and one more die per higher slot', () => {
  assert.equal(breath.breathDice(2), 3);
  assert.equal(breath.breathDice(4), 5);
  assert.equal(breath.breathDice(-1), 3);
});

test('Dragon\'s Breath grants the touched creature a cone action tied to concentration', async () => {
  const context = breathContext({castLevel: 3});
  await breath.castDragonsBreath({document: context.item, workflow: context.workflow}, context.deps);

  const [effect] = context.store.created;
  assert.equal(effect.actor.name, 'Korax');
  assert.equal(effect.flags.cat.identifier, 'dragonsBreath');
  assert.deepEqual(effect.parentEntity, {id: 'concentration'});

  const [{actor, datas: [exhale], options}] = context.items;
  assert.equal(actor.name, 'Korax');
  assert.equal(options.parentEntity, effect);
  const activity = Object.values(exhale.system.activities)[0];
  assert.equal(activity.type, 'save');
  assert.equal(activity.activation.type, 'action');
  assert.deepEqual([activity.target.template.type, activity.target.template.size], ['cone', '15']);
  assert.deepEqual(activity.save.ability, ['dex']);
  assert.equal(activity.save.dc.formula, '17');
  assert.equal(activity.damage.onSave, 'half');
  assert.deepEqual(activity.damage.parts[0].types, ['cold']);
  assert.equal(activity.damage.parts[0].number, 4);
});

test('Dragon\'s Breath without a target drops concentration and grants nothing', async () => {
  const context = breathContext({targets: []});
  await breath.castDragonsBreath({document: context.item, workflow: context.workflow}, context.deps);
  assert.deepEqual(context.store.deleted, [{id: 'concentration'}]);
  assert.equal(context.items.length, 0);
});

test('Dragon\'s Breath defaults to fire when the choice is dismissed', async () => {
  const context = breathContext({choice: false});
  await breath.castDragonsBreath({document: context.item, workflow: context.workflow}, context.deps);
  const activity = Object.values(context.items[0].datas[0].system.activities)[0];
  assert.deepEqual(activity.damage.parts[0].types, ['fire']);
});

test('Melf\'s Minute Meteors creates six meteors plus two per higher slot', () => {
  assert.equal(meteors.meteorCount(3), 6);
  assert.equal(meteors.meteorCount(5), 10);
  assert.equal(meteors.meteorCount(-1), 6);
});

function meteorContext({state, combat = {started: true, id: 'c', round: 2, turn: 1}} = {}) {
  const store = effectStore();
  const effect = state ? {id: 'meteors', flags: {[MODULE_ID]: {melfsMinuteMeteors: state}}} : undefined;
  const deps = {
    ...store,
    actorUtils: {getEffectByIdentifier: () => effect},
    workflowUtils: {getCastLevel: () => 4},
    combat: () => combat
  };
  const item = {name: "Melf's Minute Meteors", img: 'meteor.webp', uuid: 'Item.meteors'};
  return {deps, effect, item, store};
}

test('casting the meteors stores the count and reveals the hurl activity', async () => {
  const context = meteorContext();
  const workflow = {actor: {}, activity: {identifier: 'melfsMinuteMeteors', uuid: 'Activity.cast'}};
  await meteors.castMeteors({document: context.item, workflow}, context.deps);
  const [effect] = context.store.created;
  assert.equal(effect.name, "Melf's Minute Meteors (8)");
  assert.deepEqual(effect.unhideActivities, ['melfsMinuteMeteorsHurl']);
  assert.deepEqual(effect.flags[MODULE_ID].melfsMinuteMeteors, {meteors: 8, turn: 'c.2.1', thrown: 0});
});

test('a third meteor in the same combat turn is blocked, a new turn is not', async () => {
  const activity = {identifier: 'melfsMinuteMeteorsHurl'};
  const spent = meteorContext({state: {meteors: 4, turn: 'c.2.1', thrown: 2}});
  assert.equal(await meteors.checkHurl({activity, actor: {}}, spent.deps), true);

  const nextTurn = meteorContext({state: {meteors: 4, turn: 'c.1.1', thrown: 2}});
  assert.equal(await meteors.checkHurl({activity, actor: {}}, nextTurn.deps), undefined);

  const outOfCombat = meteorContext({state: {meteors: 4, turn: 'c.2.1', thrown: 2}, combat: null});
  assert.equal(await meteors.checkHurl({activity, actor: {}}, outOfCombat.deps), undefined);

  const empty = meteorContext();
  assert.equal(await meteors.checkHurl({activity, actor: {}}, empty.deps), true);
});

test('hurling spends a meteor and the last one ends the spell', async () => {
  const workflow = {actor: {}, activity: {identifier: 'melfsMinuteMeteorsHurl'}};
  const context = meteorContext({state: {meteors: 3, turn: 'c.2.1', thrown: 1}});
  await meteors.hurlMeteor({document: context.item, workflow}, context.deps);
  assert.deepEqual(context.store.updated[0][1], {
    name: "Melf's Minute Meteors (2)",
    [`flags.${MODULE_ID}.melfsMinuteMeteors`]: {meteors: 2, turn: 'c.2.1', thrown: 2}
  });

  const last = meteorContext({state: {meteors: 1, turn: 'c.1.1', thrown: 1}});
  await meteors.hurlMeteor({document: last.item, workflow}, last.deps);
  assert.deepEqual(last.store.deleted, [last.effect, {id: 'concentration'}]);
});

test('spell automations register the prefixed CAT passes', () => {
  assert.deepEqual(breath.dragonsBreath.roll.map(entry => entry.pass), ['itemRollFinished']);
  assert.deepEqual(meteors.melfsMinuteMeteors.roll.map(entry => entry.pass), ['itemPreTargeting', 'itemRollFinished']);
});
