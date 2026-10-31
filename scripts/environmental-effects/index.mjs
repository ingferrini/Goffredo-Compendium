export function createEnvironmentalController({list, execute}) {
  return {
    list,
    async run(id) {
      const row = list().find(entry => entry.preset.id === id);
      if (!row) throw new Error(`Environmental effect preset not found: ${id}`);
      return execute(row.preset, row.macro);
    }
  };
}

export function registerEnvironmentalModuleApi(module, controller) {
  module.api = {
    ...(module.api ?? {}),
    runEnvironmentalEffect: id => controller.run(id)
  };
}

export function registerEnvironmentalControl(hooks, deps = {}) {
  hooks.on('getSceneControlButtons', controls => {
    const isGM = deps.isGM?.() ?? globalThis.game?.user?.isGM;
    if (!isGM || !controls.tokens?.tools) return;
    controls.tokens.tools['gac-environmental-effects'] = {
      name: 'gac-environmental-effects',
      title: 'GAC.EnvironmentalEffects.Title',
      icon: 'fa-solid fa-explosion',
      order: Object.keys(controls.tokens.tools).length,
      button: true,
      visible: true,
      onChange: deps.open
    };
  });
}

export function sequencerAvailable(modules = globalThis.game?.modules) {
  return modules?.get?.('sequencer')?.active === true && Boolean(globalThis.Sequencer);
}
