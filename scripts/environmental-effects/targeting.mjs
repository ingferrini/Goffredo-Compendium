function isPlayerCharacter(token) {
  return token.actor?.type === 'character' && token.actor?.hasPlayerOwner === true;
}

function validToken(token) {
  return Boolean(token?.actor) && token.hidden !== true;
}

function tokenCenter(token) {
  return token.center ?? token.object?.center ?? {x: token.x, y: token.y};
}

export function filterAudience(tokens, audience) {
  const valid = Array.from(tokens ?? []).filter(validToken);
  if (audience === 'pcs') return valid.filter(isPlayerCharacter);
  if (audience === 'enemies') return valid.filter(token => token.disposition < 0);
  if (audience === 'allies') return valid.filter(token => token.disposition >= 0 && !isPlayerCharacter(token));
  return valid;
}

export function collectTemplateTokens(tokens, template) {
  const shape = template?.object?.shape;
  if (!shape?.contains) return [];
  return Array.from(tokens ?? []).filter(validToken).filter(token => {
    const center = tokenCenter(token);
    return shape.contains(center.x - template.x, center.y - template.y);
  });
}

export function collectSceneTokens(tokens) {
  return Array.from(tokens ?? []).filter(validToken);
}

export function sceneArea(scene) {
  const rectangle = scene?.dimensions?.sceneRect ?? {
    x: scene?.dimensions?.sceneX ?? 0,
    y: scene?.dimensions?.sceneY ?? 0,
    width: scene?.dimensions?.sceneWidth ?? scene?.width ?? 0,
    height: scene?.dimensions?.sceneHeight ?? scene?.height ?? 0
  };
  return {
    type: 'scene',
    location: {
      x: rectangle.x + rectangle.width / 2,
      y: rectangle.y + rectangle.height / 2,
      width: rectangle.width,
      height: rectangle.height
    },
    width: rectangle.width,
    height: rectangle.height
  };
}
