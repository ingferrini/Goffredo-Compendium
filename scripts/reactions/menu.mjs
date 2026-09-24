import {MODULE_ID} from '../constants.mjs';
import {localize} from '../shared/foundry.mjs';
import {
  AUDIENCES,
  GENERAL_SETTING,
  NPC_MODES,
  ON_TIMEOUT,
  REACTION_TYPES,
  REACTIONS_SETTING,
  allReactionConfigs,
  getGeneralConfig,
  normalizeGeneral,
  normalizeReaction
} from './config.mjs';

function options(values, selected, prefix) {
  return values.map(value => (
    `<option value="${value}"${value === selected ? ' selected' : ''}>${localize(`${prefix}.${value}`)}</option>`
  )).join('');
}

export function renderReactionsForm(configs, general) {
  const rows = REACTION_TYPES.map(id => {
    const config = configs[id];
    return `<tr>
      <td><label><input type="checkbox" name="${id}.enabled"${config.enabled ? ' checked' : ''}> ${localize(`GAC.Reactions.Types.${id}`)}</label></td>
      <td><input type="number" name="${id}.timeout" value="${config.timeout}" min="5" max="120" step="1" style="width:4.5em"></td>
      <td><select name="${id}.onTimeout">${options(ON_TIMEOUT, config.onTimeout, 'GAC.Reactions.OnTimeout')}</select></td>
      <td><select name="${id}.npcMode">${options(NPC_MODES, config.npcMode, 'GAC.Reactions.NpcMode')}</select></td>
      <td><select name="${id}.audience">${options(AUDIENCES, config.audience, 'GAC.Reactions.Audience')}</select></td>
    </tr>`;
  }).join('');
  return `<section class="gac-reactions">
    <p class="hint">${localize('GAC.Reactions.Menu.Intro')}</p>
    <table>
      <thead><tr>
        <th>${localize('GAC.Reactions.Columns.Reaction')}</th>
        <th>${localize('GAC.Reactions.Columns.Timeout')}</th>
        <th>${localize('GAC.Reactions.Columns.OnTimeout')}</th>
        <th>${localize('GAC.Reactions.Columns.Npc')}</th>
        <th>${localize('GAC.Reactions.Columns.Audience')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <fieldset>
      <label><input type="checkbox" name="general.combatOnly"${general.combatOnly ? ' checked' : ''}> ${localize('GAC.Reactions.General.CombatOnly')}</label>
      <label><input type="checkbox" name="general.chatSummary"${general.chatSummary ? ' checked' : ''}> ${localize('GAC.Reactions.General.ChatSummary')}</label>
    </fieldset>
    <footer class="form-footer"><button type="submit"><i class="fas fa-save"></i> ${localize('GAC.Reactions.Menu.Save')}</button></footer>
  </section>`;
}

// Unchecked boxes are absent from form data, so every enabled flag is read explicitly.
export function parseReactionsForm(values) {
  const reactions = Object.fromEntries(REACTION_TYPES.map(id => [id, normalizeReaction({
    enabled: values[`${id}.enabled`] === true || values[`${id}.enabled`] === 'on',
    timeout: values[`${id}.timeout`],
    onTimeout: values[`${id}.onTimeout`],
    npcMode: values[`${id}.npcMode`],
    audience: values[`${id}.audience`]
  })]));
  const general = normalizeGeneral({
    combatOnly: values['general.combatOnly'] === true || values['general.combatOnly'] === 'on',
    chatSummary: values['general.chatSummary'] === true || values['general.chatSummary'] === 'on'
  });
  return {reactions, general};
}

export function createReactionsMenuClass() {
  const {ApplicationV2} = globalThis.foundry.applications.api;
  return class ReactionsMenu extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${MODULE_ID}-reactions`,
      tag: 'form',
      window: {title: 'GAC.Reactions.Menu.Name', icon: 'fas fa-shield-halved'},
      position: {width: 760},
      form: {handler: ReactionsMenu.#onSubmit, closeOnSubmit: true}
    };

    async _renderHTML() {
      return renderReactionsForm(allReactionConfigs(), getGeneralConfig());
    }

    _replaceHTML(result, content) {
      content.innerHTML = result;
    }

    static async #onSubmit(_event, _form, formData) {
      const {reactions, general} = parseReactionsForm(formData.object);
      await game.settings.set(MODULE_ID, REACTIONS_SETTING, reactions);
      await game.settings.set(MODULE_ID, GENERAL_SETTING, general);
    }
  };
}
