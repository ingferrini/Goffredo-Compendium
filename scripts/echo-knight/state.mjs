import {FLAGS} from '../constants.mjs';

export function createEchoState(data) {
  return Object.fromEntries(Object.entries({schema: 1, ...data}).filter(([, value]) => value !== undefined));
}

export function getEchoState(actor) {
  return actor?.getFlag?.(FLAGS.scope, FLAGS.echo);
}

export async function setEchoState(actor, state) {
  return actor?.setFlag?.(FLAGS.scope, FLAGS.echo, state);
}

export async function clearEchoState(actor) {
  return actor?.unsetFlag?.(FLAGS.scope, FLAGS.echo);
}

