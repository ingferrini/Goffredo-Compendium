import {rm} from 'node:fs/promises';
import {compilePack} from '@foundryvtt/foundryvtt-cli';

const packs = ['gac-features-2014', 'gac-summons-2014', 'gac-equipment-2014'];

for (const pack of packs) {
  const output = `./packs/${pack}`;
  await rm(output, {recursive: true, force: true});
  await compilePack(`./packData/${pack}`, output, {log: true});
}
