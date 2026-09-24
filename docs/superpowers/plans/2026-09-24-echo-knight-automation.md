# Echo Knight Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an installable Foundry VTT 14 module whose 2014 compendia fully automate Manifest Echo and Unleash Incarnation on D&D5e 5.3.3.

**Architecture:** A thin module runtime registers function macros with CAT and keeps Foundry-specific adapters separate from pure Echo Knight rules. Human-readable Item and Actor JSON compile into LevelDB compendium packs with the official Foundry CLI. Midi-QOL resolves attacks, CAT owns summons and privileged movement, DAE stores the active-echo marker, and direct Foundry movement hooks implement the echo-specific movement limit and opportunity-attack trigger.

**Tech Stack:** JavaScript ES modules, Node.js built-in test runner, ESLint, `@foundryvtt/foundryvtt-cli`, Foundry VTT 14.367 Public API, D&D5e 5.3.3, Midi-QOL 14.0.12, DAE 14.0.14, CAT 0.0.8, optional Sequencer 4.2.3 and Levels 7.0.3.

---

## File Map

- `module.json`: installable development manifest and dependency/version contract.
- `package.json`: test, lint, pack-build and release-build commands.
- `scripts/main.mjs`: module lifecycle, compatibility guard and CAT registration.
- `scripts/proxy.mjs`: lazy, typed-by-JSDoc access to the CAT API.
- `scripts/constants.mjs`: module IDs, pack IDs, automation IDs and flag keys.
- `scripts/registry.mjs`: translates exported automation definitions into CAT registrations.
- `scripts/echo-knight/rules.mjs`: pure calculations and state predicates.
- `scripts/echo-knight/state.mjs`: namespaced actor/token flag access and cleanup.
- `scripts/echo-knight/manifest-echo.mjs`: summon, attack, swap, dismiss and turn-end callbacks.
- `scripts/echo-knight/movement.mjs`: 30-foot budget, vertical distance and move-hook integration.
- `scripts/echo-knight/opportunity-attack.mjs`: leaving-reach detection, reaction prompt and synthetic attack.
- `scripts/echo-knight/unleash-incarnation.mjs`: extra-melee-attack workflow and resource guard.
- `packData/gac-features-2014/*.json`: Manifest Echo and Unleash Incarnation Items.
- `packData/gac-summons-2014/*.json`: Echo summon Actor.
- `tools/build-packs.mjs`: JSON-to-LevelDB compiler.
- `tools/build-release.mjs`: deterministic ZIP staging and manifest validation.
- `lang/en.json`, `lang/it.json`: all user-facing strings.
- `tests/*.test.mjs`: unit and adapter-contract tests using Node mocks.
- `.github/workflows/ci.yml`: tests, lint and pack build on pushes and pull requests.
- `.github/workflows/release.yml`: tagged release ZIP, manifest and checksums.
- `README.md`, `CHANGELOG.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`: distribution and attribution.

### Task 1: Repository and module scaffold

**Files:**
- Create: `.gitignore`
- Create: `.gitattributes`
- Create: `package.json`
- Create: `module.json`
- Create: `scripts/main.mjs`
- Create: `tests/manifest.test.mjs`

- [ ] **Step 1: Write the failing manifest contract test**

Test that `module.json` has ID `goffredo-compendium`, version `0.1.0`, Foundry 14 compatibility, D&D5e 5.3.3 support, required `midi-qol`, `dae`, and `cat` relationships, two pack declarations, English/Italian languages, and the production GitHub URLs under `https://github.com/ingferrini/Goffredo-Compendium`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- tests/manifest.test.mjs`

Expected: FAIL because `package.json` and `module.json` do not exist.

- [ ] **Step 3: Add the minimal module scaffold**

Use Node ESM, `node --test`, ESLint and `@foundryvtt/foundryvtt-cli`. Declare packs `GACFeatures2014` and `GACSummons2014`, grouped by `packFolders` under `Goffredo's Automation Compendium / 2014`.

- [ ] **Step 4: Run the manifest test**

Run: `npm install && npm test -- tests/manifest.test.mjs`

Expected: PASS, 1 test file with zero failures.

- [ ] **Step 5: Commit**

```powershell
git add .gitignore .gitattributes package.json package-lock.json module.json scripts/main.mjs tests/manifest.test.mjs
git commit -m "chore: scaffold Foundry automation module"
```

### Task 2: CAT proxy, registry and compatibility guard

**Files:**
- Create: `scripts/constants.mjs`
- Create: `scripts/proxy.mjs`
- Create: `scripts/registry.mjs`
- Modify: `scripts/main.mjs`
- Create: `tests/registry.test.mjs`

- [ ] **Step 1: Write failing registry tests**

Cover registration of one 2014 automation as `{source: 'goffredo-compendium', rules: '2014', identifier}`, rejection of duplicate IDs, and compatibility results for the exact live module versions. Test that missing CAT or Midi-QOL returns a localized GM-facing error instead of registering partial callbacks.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/registry.test.mjs`

Expected: FAIL because registry exports are missing.

- [ ] **Step 3: Implement the CAT boundary**

Mirror CAT's lazy proxy pattern rather than importing its private files. Register automations only from `Hooks.once('catReady')`; expose no global API in `0.1.0`. Use `api.registerFnMacro` and `api.registerAutomationModule` with source display name `Goffredo's Automation Compendium`.

- [ ] **Step 4: Verify registry tests pass**

Run: `npm test -- tests/registry.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/constants.mjs scripts/proxy.mjs scripts/registry.mjs scripts/main.mjs tests/registry.test.mjs
git commit -m "feat: register automations through CAT"
```

### Task 3: Pure Echo Knight rules

**Files:**
- Create: `scripts/echo-knight/rules.mjs`
- Create: `tests/echo-rules.test.mjs`

- [ ] **Step 1: Write failing rule tests**

Cover `echoArmorClass(proficiency)`, `unleashUses(constitutionModifier)`, Euclidean 3D distance, summon range at 15/15.1 feet, end-turn range at 30/30.1 feet, leaving a 5-foot reach, valid melee attack detection, and movement-budget accumulation including elevation.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/echo-rules.test.mjs`

Expected: FAIL because `rules.mjs` is missing.

- [ ] **Step 3: Implement pure functions without Foundry globals**

All functions accept plain objects and numbers. Distances use scene-provided grid-space conversion before the pure function is called. Boundaries are inclusive: 15 and 30 feet are valid; more than 5 feet after starting within 5 feet qualifies as leaving reach.

- [ ] **Step 4: Verify the tests pass**

Run: `npm test -- tests/echo-rules.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/echo-knight/rules.mjs tests/echo-rules.test.mjs
git commit -m "feat: add tested Echo Knight rules"
```

### Task 4: Compendium source data and bilingual localization

**Files:**
- Create: `lang/en.json`
- Create: `lang/it.json`
- Create: `packData/gac-features-2014/Manifest_Echo.json`
- Create: `packData/gac-features-2014/Unleash_Incarnation.json`
- Create: `packData/gac-summons-2014/Echo.json`
- Create: `tools/build-packs.mjs`
- Create: `tests/pack-data.test.mjs`

- [ ] **Step 1: Write failing pack-data tests**

Validate stable IDs, unique activity identifiers, empty/non-infringing descriptions, 2014 source markers, CAT automation flags, item use formulas, Echo Actor 1 HP and condition immunities, and one-to-one localization-key parity between English and Italian.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/pack-data.test.mjs`

Expected: FAIL because pack source files are missing.

- [ ] **Step 3: Create the pack documents**

Manifest Echo receives activities `manifestEcho`, `manifestEchoAttack`, `manifestEchoSwap`, and `manifestEchoDismiss`. Unleash Incarnation receives `unleashIncarnation`, special activation, `@abilities.con.mod` maximum uses with minimum-one correction in runtime, and long-rest recovery. The Echo template is an NPC shell; summon-time updates copy size, token art, senses, saving throws and AC.

- [ ] **Step 4: Compile and test the packs**

Run: `npm run build:packs && npm test -- tests/pack-data.test.mjs`

Expected: LevelDB directories `packs/gac-features-2014` and `packs/gac-summons-2014`; all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add lang packData tools/build-packs.mjs packs tests/pack-data.test.mjs
git commit -m "feat: add Echo Knight compendium content"
```

### Task 5: Echo state and summon lifecycle

**Files:**
- Create: `scripts/echo-knight/state.mjs`
- Create: `scripts/echo-knight/manifest-echo.mjs`
- Create: `tests/echo-state.test.mjs`
- Create: `tests/manifest-echo.test.mjs`

- [ ] **Step 1: Write failing state and summon tests**

Test namespaced state serialization, stale-token cleanup, replacement of an existing echo, dynamic CA/HP/size/token image updates, CAT summon placement at 15 feet, DAE marker creation, and cleanup when summon placement is cancelled.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/echo-state.test.mjs tests/manifest-echo.test.mjs`

Expected: FAIL because lifecycle modules are missing.

- [ ] **Step 3: Implement summon and dismiss callbacks**

Use `compendiumUtils.getDocumentByIdentifier`, `summonUtils.createSummon`, `summonUtils.placeSummons`, `documentUtils.getBaseEffectData`, and `effectUtils.createEffects`. Store owner Actor UUID and echo token UUID in module flags; use summon deletion and marker-effect deletion as the single cleanup path.

- [ ] **Step 4: Verify lifecycle tests pass**

Run: `npm test -- tests/echo-state.test.mjs tests/manifest-echo.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/echo-knight/state.mjs scripts/echo-knight/manifest-echo.mjs tests/echo-state.test.mjs tests/manifest-echo.test.mjs
git commit -m "feat: automate Manifest Echo lifecycle"
```

### Task 6: Attack origin, swap and range cleanup

**Files:**
- Modify: `scripts/echo-knight/manifest-echo.mjs`
- Create: `tests/echo-actions.test.mjs`

- [ ] **Step 1: Write failing action tests**

Cover weapon selection, equipped-weapon filtering, synthetic attack with echo-origin range override, cancellation without side effects, atomic swap validation, 15-foot movement cost, elevation exchange, and automatic echo dismissal beyond 30 feet at owner turn end.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/echo-actions.test.mjs`

Expected: FAIL for unimplemented callbacks.

- [ ] **Step 3: Implement actions**

Use `workflowUtils.syntheticItemRoll` for the selected attack. Apply temporary, dependent range-override effects to owner and echo and remove them in `finally`. Use `tokenUtils.moveToken` for both halves of the swap only after both destinations and movement budget validate. Register CAT roll passes for the four activity identifiers and a combat `actorTurnEnd` pass for the active marker.

- [ ] **Step 4: Verify action tests pass**

Run: `npm test -- tests/echo-actions.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/echo-knight/manifest-echo.mjs tests/echo-actions.test.mjs
git commit -m "feat: add Echo Knight combat actions"
```

### Task 7: Echo movement budget and vertical control

**Files:**
- Create: `scripts/echo-knight/movement.mjs`
- Modify: `scripts/main.mjs`
- Create: `tests/echo-movement.test.mjs`

- [ ] **Step 1: Write failing movement tests**

Test owner-turn detection, 3D segment cost, cumulative 30-foot budget, reset at owner turn start, ignored forced/internal movement, rollback of over-budget movement without recursion, and elevation-only movement on a Levels scene.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/echo-movement.test.mjs`

Expected: FAIL because movement integration is missing.

- [ ] **Step 3: Implement movement hooks**

Register the Foundry 14 `moveToken` hook from `ready`. Track per-combat-turn movement in echo token flags, keyed by combat ID and round/turn. Internal rollback and swap movement carry `options.goffredoCompendium.ignoreEchoMovement`. Provide a small elevation dialog/activity that moves through CAT's GM-capable `tokenUtils.moveToken` path.

- [ ] **Step 4: Verify movement tests pass**

Run: `npm test -- tests/echo-movement.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/echo-knight/movement.mjs scripts/main.mjs tests/echo-movement.test.mjs
git commit -m "feat: enforce echo movement budget"
```

### Task 8: Opportunity attack and Unleash Incarnation

**Files:**
- Create: `scripts/echo-knight/opportunity-attack.mjs`
- Create: `scripts/echo-knight/unleash-incarnation.mjs`
- Modify: `scripts/echo-knight/manifest-echo.mjs`
- Modify: `scripts/registry.mjs`
- Create: `tests/echo-reactions.test.mjs`
- Create: `tests/unleash-incarnation.test.mjs`

- [ ] **Step 1: Write failing reaction and resource tests**

Cover a hostile creature starting within 5 feet and ending beyond 5 feet, visibility from the owner, non-teleport/non-forced movement, available reaction, declined prompt, one reaction per round, melee-only Unleash selection, minimum-one Constitution uses, cancellation without consumption, one use per Attack action, and long-rest recovery data.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/echo-reactions.test.mjs tests/unleash-incarnation.test.mjs`

Expected: FAIL because reaction and Unleash callbacks are missing.

- [ ] **Step 3: Implement the reaction and extra attack**

Observe completed token movement and compare origin/destination against all active echoes on the scene. Prompt the echo owner through CAT query/dialog utilities, consume the owner's reaction through Midi-QOL, and run one melee synthetic attack from the echo. Reuse the same attack-origin helper for Unleash, consuming the Item use only after weapon and target selection succeeds.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- tests/echo-reactions.test.mjs tests/unleash-incarnation.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/echo-knight scripts/registry.mjs tests/echo-reactions.test.mjs tests/unleash-incarnation.test.mjs
git commit -m "feat: automate Echo Knight reactions and Unleash"
```

### Task 9: Documentation, licensing and continuous integration

**Files:**
- Create: `README.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `tools/build-release.mjs`
- Create: `tests/release.test.mjs`

- [ ] **Step 1: Write the failing release test**

Require the release archive to contain `module.json`, scripts, languages, LevelDB packs, license and notices; reject `packData`, tests, Node dependencies, non-SRD descriptions and unlicensed artwork.

- [ ] **Step 2: Verify it fails**

Run: `npm test -- tests/release.test.mjs`

Expected: FAIL because release tooling and documentation are missing.

- [ ] **Step 3: Add distribution files and workflows**

Document installation, dependencies, CAT application, supported versions, bilingual behavior, public-content policy and troubleshooting. Attribute the adapted CPR Echo Knight structure and CAT proxy under MIT. Build `dist/goffredo-compendium.zip` and `dist/module.json`; tags matching `v*` publish both assets and SHA-256 checksums.

- [ ] **Step 4: Run the complete local gate**

Run: `npm run check`

Expected: ESLint PASS, all Node tests PASS, packs compile, release archive validates.

- [ ] **Step 5: Commit**

```powershell
git add README.md CHANGELOG.md LICENSE THIRD_PARTY_NOTICES.md .github tools/build-release.mjs tests/release.test.mjs package.json package-lock.json
git commit -m "chore: add release pipeline and documentation"
```

### Task 10: GitHub publication and Foundry smoke test

**Files:**
- Modify: `CHANGELOG.md` only if the live smoke test finds a user-visible correction.

- [ ] **Step 1: Run all checks from a clean checkout**

Run: `npm ci && npm run check`

Expected: zero failures and a validated `dist/goffredo-compendium.zip`.

- [ ] **Step 2: Create and push the public repository**

```powershell
gh repo create ingferrini/Goffredo-Compendium --public --source . --remote origin --push
```

Expected: public repository URL `https://github.com/ingferrini/Goffredo-Compendium` and clean local branch tracking `origin`.

- [ ] **Step 3: Install the development build for the test world**

Create a `v0.1.0-rc.1` release, install its manifest through The Forge, enable the module, and verify both compendia are listed under the expected folder. Do not modify the production Ash actor.

- [ ] **Step 4: Test on a copy of Ash**

Exercise GM and player summon, normal/vertical movement, attack, ranged attack origin, swap, dismiss, end-turn range, opportunity attack, Unleash usage and long-rest recovery on one flat scene and one Levels scene. Record every case in the release checklist.

- [ ] **Step 5: Fix, re-run and publish**

For any failure, first add a reproducing automated test, then patch and rerun `npm run check` plus the affected Foundry case. When all cases pass, tag `v0.1.0` and publish the stable release.

## Plan Self-Review

- Every behavior in design sections 6 and 7 maps to Tasks 3 through 8.
- Public distribution, localization, licensing and non-SRD text rules map to Tasks 4 and 9.
- Compatibility, graceful failure and exact live versions map to Tasks 1, 2 and 10.
- No silent migration touches the production Ash actor; Task 10 explicitly uses a copy.
- The implementation reuses public CAT registration and utility surfaces while keeping pure rules testable without Foundry.
