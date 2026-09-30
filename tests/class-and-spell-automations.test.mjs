import assert from 'node:assert/strict';
import test from 'node:test';

import * as circle from '../scripts/classes/circle-of-mortality.mjs';
import * as inspiring from '../scripts/classes/inspiring-smite.mjs';
import * as crusher from '../scripts/features/crusher.mjs';
import * as bane from '../scripts/spells/elemental-bane.mjs';
import * as enlarge from '../scripts/spells/enlarge-reduce.mjs';
import * as vampiric from '../scripts/spells/vampiric-touch.mjs';

const MODULE_ID = 'goffredo-compendium';
const combat = {started: true, id: 'c', round: 3, turn: 2};

function store() {
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
    },
    actorUtils: {getEffectByIdentifier: () => undefined}
  };
}

function actor(name, size = 'med', hp = 10) {
  return {name, uuid: `Actor.${name}`, system: {traits: {size}, attributes: {hp: {value: hp, temp: 0}}}};
}

// Crusher

function crusherContext({critical = false, type = 'bludgeoning', targetSize = 'lg', pushed, confirm = true} = {}) {
  const deps = store();
  const moves = [];
  const target = {id: 't', actor: actor('Ogre', targetSize)};
  Object.assign(deps, {
    workflowUtils: {isAttackType: () => true},
    dialogUtils: {confirm: async () => confirm},
    tokenUtils: {async displaceToken(...args) { moves.push(args); }},
    combat: () => combat
  });
  const item = {name: 'Crusher', img: 'crusher.webp', uuid: 'Item.crusher', flags: pushed ? {[MODULE_ID]: {crusherPush: pushed}} : {}};
  const workflow = {
    actor: actor('Ash'), token: {document: {id: 'ash'}}, isCritical: critical,
    hitTargets: new Set([target]), damageRolls: [{options: {type}}]
  };
  return {deps, item, moves, target, workflow};
}

test('Crusher pushes a bludgeoned target once per turn', async () => {
  const context = crusherContext();
  await crusher.crusher({document: context.item, workflow: context.workflow}, context.deps);
  assert.equal(context.moves.length, 1);
  assert.equal(context.moves[0][0], context.target);
  assert.equal(context.moves[0][1].range, 5);
  assert.deepEqual(context.deps.updated[0][1], {[`flags.${MODULE_ID}.crusherPush`]: 'c.3.2'});

  const again = crusherContext({pushed: 'c.3.2'});
  await crusher.crusher({document: again.item, workflow: again.workflow}, again.deps);
  assert.equal(again.moves.length, 0);
});

test('Crusher ignores other damage types and targets two sizes larger', async () => {
  for (const options of [{type: 'slashing'}, {targetSize: 'huge'}, {confirm: false}]) {
    const context = crusherContext(options);
    await crusher.crusher({document: context.item, workflow: context.workflow}, context.deps);
    assert.equal(context.moves.length, 0, JSON.stringify(options));
  }
});

test('a bludgeoning critical grants advantage against the target until the attacker\'s next turn', async () => {
  const context = crusherContext({critical: true, confirm: false});
  await crusher.crusher({document: context.item, workflow: context.workflow}, context.deps);
  const [effect] = context.deps.created;
  assert.equal(effect.actor.name, 'Ogre');
  assert.equal(effect.flags.cat.identifier, 'crusherCritical');
  assert.deepEqual(effect.flags.dae.specialDuration, ['turnStartSource']);
  assert.equal(effect.changes[0].key, 'flags.midi-qol.grants.advantage.attack.all');

  const noCrit = crusherContext({confirm: false});
  await crusher.crusher({document: noCrit.item, workflow: noCrit.workflow}, noCrit.deps);
  assert.equal(noCrit.deps.created.length, 0);
});

// Circle of Mortality

function healRoll(total, max) {
  return {total, options: {type: 'healing'}, max};
}

function circleContext(hps) {
  const applied = [];
  const set = [];
  const targets = hps.map((hp, index) => ({id: `t${index}`, actor: {system: {attributes: {hp: {value: hp}}}}}));
  const workflow = {
    item: {type: 'spell'},
    targets: new Set(targets),
    damageRolls: [healRoll(7, 12)],
    async setDamageRolls(rolls) { set.push(rolls); }
  };
  const deps = {
    maximize: async roll => ({...roll, total: roll.max}),
    workflowUtils: {async applyDamage(...args) { applied.push(args); }}
  };
  return {applied, deps, set, targets, workflow};
}

test('Circle of Mortality maximizes healing dice for a creature at 0 hit points', async () => {
  const single = circleContext([0]);
  await circle.maximizeHealing({workflow: single.workflow}, single.deps);
  assert.equal(single.set[0][0].total, 12);

  const healthy = circleContext([5]);
  await circle.maximizeHealing({workflow: healthy.workflow}, healthy.deps);
  assert.equal(healthy.set.length, 0);
});

test('with mixed targets only the downed creatures get the difference', async () => {
  const context = circleContext([0, 5]);
  await circle.maximizeHealing({workflow: context.workflow}, context.deps);
  assert.equal(context.set.length, 0);
  await circle.healDowned({workflow: context.workflow}, context.deps);
  assert.deepEqual(context.applied, [[[context.targets[0]], 5, 'healing']]);
});

test('Circle of Mortality ignores non-spell healing', async () => {
  const context = circleContext([0]);
  context.workflow.item.type = 'consumable';
  await circle.maximizeHealing({workflow: context.workflow}, context.deps);
  assert.equal(context.set.length, 0);
});

// Inspiring Smite

test('Inspiring Smite splits 2d8 + paladin level as temporary hit points', async () => {
  const deps = store();
  const korax = {...actor('Korax'), id: 'korax', classes: {paladin: {system: {levels: 9}}}, getRollData: () => ({})};
  korax.system.attributes.hp.temp = 3;
  const ally = actor('Ash');
  ally.system.attributes.hp.temp = 10;
  const self = {id: 'kx', actor: korax};
  const friend = {id: 'ash', actor: ally};
  let dialog;
  Object.assign(deps, {
    roll: async formula => ({formula, total: 18}),
    tokenUtils: {findNearby: () => [friend]},
    dialogUtils: {async selectTargetDialog(...args) {
      dialog = args;
      return {result: [{document: self, value: 12}, {document: friend, value: 6}]};
    }}
  });
  await inspiring.inspiringSmite({workflow: {actor: korax, token: {document: self}, item: {name: 'Inspiring Smite'}}}, deps);
  assert.deepEqual(dialog[2], [self, friend]);
  assert.equal(dialog[3].maxAmount, 18);
  assert.deepEqual(deps.updated, [[korax, {'system.attributes.hp.temp': 12}]]);
});

// Vampiric Touch

test('Vampiric Touch heals half the necrotic damage dealt', async () => {
  const deps = store();
  const heals = [];
  deps.workflowUtils = {getCastLevel: () => 4, async applyDamage(...args) { heals.push(args); }};
  const token = {id: 'kragdar'};
  const workflow = {
    actor: {}, token: {document: token},
    activity: {identifier: 'vampiricTouch', uuid: 'Activity.cast'},
    damageList: [{damageDetail: [{type: 'necrotic', value: 13}]}]
  };
  await vampiric.vampiricRollFinished({document: {name: 'Vampiric Touch', uuid: 'Item.vt'}, workflow}, deps);
  assert.deepEqual(heals, [[[token], 6, 'healing']]);
  const [effect] = deps.created;
  assert.deepEqual(effect.unhideActivities, ['vampiricTouchAttack']);
  assert.equal(effect.flags[MODULE_ID].vampiricTouch.castLevel, 4);
});

test('the repeat touch keeps the upcast damage', async () => {
  const bonus = [];
  const effect = {flags: {[MODULE_ID]: {vampiricTouch: {castLevel: 5}}}};
  const deps = {
    actorUtils: {getEffectByIdentifier: () => effect},
    workflowUtils: {async bonusDamage(...args) { bonus.push(args); }}
  };
  await vampiric.upcastTouch({workflow: {actor: {}, activity: {identifier: 'vampiricTouchAttack'}}}, deps);
  assert.deepEqual(bonus[0].slice(1), ['2d6', {damageType: 'necrotic'}]);
  assert.equal(vampiric.necroticDealt([{damageDetail: [{type: 'fire', value: 5}, {type: 'necrotic', value: 4}]}]), 4);
});

// Elemental Bane

test('Elemental Bane curses failed saves and removes the chosen resistance', async () => {
  const deps = store();
  deps.dialogUtils = {selectDamageType: async () => 'cold'};
  const cursed = {actor: actor('Troll')};
  const workflow = {actor: {}, activity: {identifier: 'elementalBane'}, failedSaves: new Set([cursed])};
  await bane.castBane({document: {name: 'Elemental Bane', uuid: 'Item.eb'}, workflow}, deps);
  const [effect] = deps.created;
  assert.equal(effect.actor.name, 'Troll');
  assert.deepEqual(effect.changes, [{key: 'system.traits.dr.value', type: 'add', value: '-cold', priority: 20}]);
  assert.equal(effect.macros[0].macros[0].identifier, 'elemental-bane');
  assert.equal(effect.flags[MODULE_ID].elementalBane.damageType, 'cold');
});

test('Elemental Bane drops concentration when every target saves', async () => {
  const deps = store();
  await bane.castBane({document: {}, workflow: {actor: {}, activity: {identifier: 'elementalBane'}, failedSaves: new Set()}}, deps);
  assert.deepEqual(deps.deleted, [{id: 'concentration'}]);
});

function baneTrigger({turn, damage = [{type: 'cold', value: 8}]} = {}) {
  const deps = store();
  const applied = [];
  Object.assign(deps, {
    combat: () => combat,
    roll: async () => ({total: 7}),
    workflowUtils: {async applyDamage(...args) { applied.push(args); }}
  });
  const troll = actor('Troll');
  const token = {id: 'troll', actor: troll};
  const effect = {name: 'Elemental Bane (Cold)', parent: troll, flags: {[MODULE_ID]: {elementalBane: {damageType: 'cold', turn}}}};
  const workflow = {targets: new Set([token]), damageList: [{actorUuid: troll.uuid, damageDetail: damage}]};
  return {applied, deps, effect, token, workflow};
}

test('the cursed creature takes an extra 2d6 the first time each turn', async () => {
  const first = baneTrigger();
  await bane.baneExtraDamage({document: first.effect, workflow: first.workflow}, first.deps);
  assert.deepEqual(first.applied, [[[first.token], 7, 'cold']]);
  assert.deepEqual(first.deps.updated[0][1], {[`flags.${MODULE_ID}.elementalBane.turn`]: 'c.3.2'});

  for (const options of [{turn: 'c.3.2'}, {damage: [{type: 'fire', value: 8}]}]) {
    const context = baneTrigger(options);
    await bane.baneExtraDamage({document: context.effect, workflow: context.workflow}, context.deps);
    assert.equal(context.applied.length, 0, JSON.stringify(options));
  }
});

// Enlarge/Reduce

test('Enlarge/Reduce moves one size category', () => {
  assert.equal(enlarge.resized('med', 'enlarge'), 'lg');
  assert.equal(enlarge.resized('med', 'reduce'), 'sm');
  assert.equal(enlarge.resized('grg', 'enlarge'), 'grg');
  assert.equal(enlarge.tokenSize('lg'), 2);
  const changes = Object.fromEntries(enlarge.sizeChanges(actor('Kragdar', 'med'), 'enlarge').map(change => [change.key, change.value]));
  assert.equal(changes['system.traits.size'], 'lg');
  assert.equal(changes['system.bonuses.mwak.damage'], '+1d4');
  assert.equal(changes['flags.midi-qol.advantage.ability.save.str'], '1');
  const reduce = Object.fromEntries(enlarge.sizeChanges(actor('Ogre', 'lg'), 'reduce').map(change => [change.key, change.value]));
  assert.equal(reduce['system.traits.size'], 'med');
  assert.equal(reduce['flags.midi-qol.disadvantage.ability.check.str'], '1');
});

function sizeTarget(name, dispositionValue, effects = []) {
  const target = actor(name);
  target.effects = effects;
  return {document: {uuid: `Token.${name}`, disposition: dispositionValue, width: 1, height: 1, actor: target}, actor: target};
}

test('allies are always affected, other creatures only on a failed save', () => {
  const ally = sizeTarget('Ash', 1);
  const savedFoe = sizeTarget('Orc', -1);
  const failedFoe = sizeTarget('Goblin', -1);
  const workflow = {token: {document: {disposition: 1}}, targets: new Set([ally, savedFoe, failedFoe]), saves: new Set([ally, savedFoe])};
  assert.deepEqual(enlarge.affectedTargets(workflow), [ally, failedFoe]);
});

test('Enlarge/Reduce replaces the spell\'s own effect and resizes the token', async () => {
  const item = {name: 'Enlarge/Reduce', uuid: 'Actor.k.Item.er'};
  const sheetEffect = {id: 'sheet', origin: 'Actor.k.Item.er', flags: {}};
  const unrelated = {id: 'bless', origin: 'Actor.x.Item.bless', flags: {}};
  const ally = sizeTarget('Ash', 1, [sheetEffect, unrelated]);
  const deps = store();
  deps.dialogUtils = {buttonDialog: async () => 'enlarge'};
  const workflow = {token: {document: {disposition: 1}}, targets: new Set([ally]), saves: new Set(), activity: {identifier: 'legacy'}};
  await enlarge.castEnlargeReduce({document: item, workflow}, deps);

  const [effect] = deps.created;
  assert.deepEqual(effect.flags[MODULE_ID].enlargeReduce, {tokenUuid: 'Token.Ash', width: 1, height: 1});
  assert.deepEqual(deps.deleted, [sheetEffect]);
  assert.deepEqual(deps.updated, [[ally.document, {width: 2, height: 2}]]);
});

test('willing allies skip the save through Midi\'s friendly auto-fail', async () => {
  const set = [];
  const activity = {type: 'save', midiProperties: {}, toObject: () => ({type: 'save', midiProperties: {confirmTargets: 'never'}})};
  await enlarge.willingAllies({workflow: {activity}}, {workflowUtils: {setActivity: (...args) => set.push(args)}});
  assert.deepEqual(set[0][1].midiProperties, {confirmTargets: 'never', autoFailFriendly: true});

  const already = [];
  await enlarge.willingAllies({workflow: {activity: {type: 'save', midiProperties: {autoFailFriendly: true}}}}, {workflowUtils: {setActivity: (...args) => already.push(args)}});
  assert.equal(already.length, 0);
});

test('the token size comes back when the spell ends', async () => {
  const token = {uuid: 'Token.Ash'};
  const updated = [];
  const deps = {
    actorUtils: {getEffectByIdentifier: () => undefined},
    fromUuid: async () => token,
    documentUtils: {async update(...args) { updated.push(args); }}
  };
  const effect = {parent: {}, flags: {cat: {identifier: 'enlargeReduce'}, [MODULE_ID]: {enlargeReduce: {tokenUuid: 'Token.Ash', width: 1, height: 1}}}};
  assert.equal(await enlarge.restoreTokenSize(effect, deps), true);
  assert.deepEqual(updated, [[token, {width: 1, height: 1}]]);

  deps.actorUtils.getEffectByIdentifier = () => ({id: 'newer'});
  assert.equal(await enlarge.restoreTokenSize(effect, deps), false);
});

test('new automations register the prefixed CAT passes', () => {
  assert.deepEqual(crusher.crusherAutomation.roll.map(entry => entry.pass), ['actorRollFinished']);
  assert.deepEqual(circle.circleOfMortality.roll.map(entry => entry.pass), ['actorDamageRollComplete', 'actorRollFinished']);
  assert.deepEqual(inspiring.inspiringSmiteAutomation.roll.map(entry => entry.pass), ['itemRollFinished']);
  assert.deepEqual(vampiric.vampiricTouch.roll.map(entry => entry.pass), ['itemDamageRollComplete', 'itemRollFinished']);
  assert.deepEqual(bane.elementalBane.roll.map(entry => entry.pass), ['itemRollFinished', 'targetRollFinished']);
  assert.deepEqual(enlarge.enlargeReduce.roll.map(entry => entry.pass), ['itemPreambleComplete', 'itemRollFinished']);
});
