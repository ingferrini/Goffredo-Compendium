// CAT 0.0.8 does not expose tokenUtils.moveToken, so move tokens through
// Foundry's public TokenDocument#move. Owners and the GM hold permission on
// both the owner token and the echo, which CAT creates with the owner's ownership.
export function moveToken(token, waypoints, options = {}) {
  return token.move(waypoints, options);
}

export function withMoveToken(tokenUtils) {
  return new Proxy(tokenUtils, {
    get(target, property) {
      return property === 'moveToken' ? moveToken : target[property];
    }
  });
}
