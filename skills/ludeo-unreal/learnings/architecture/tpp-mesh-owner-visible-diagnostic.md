---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: 5
question: "Does the FPS use separate FPP and TPP meshes? Is the TPP base mesh owner-visible or owner-hidden by default? Does the cosmetic / weapon attach decision evaluate `bIsLocallyControlled` (or `Controller->GetViewTarget()`) at runtime, and if so, when does that evaluation fire relative to your restore?"
sanitized: true
---

# "Dark blob over the player's head" symptom = TPP mesh visible to owner

## Precondition

Applies to FPS games with the standard FPP/TPP split where:

1. The player has two skeletal meshes: an FPP mesh (hands + weapon, owner-only) and a TPP mesh (full body, others-only or both).
2. The host engine has a runtime decision (typically inside an `ApplyCosmetic` / `EquipCosmetic` / `AttachWeapon` function) that picks **which mesh** a cosmetic / weapon attaches to, based on `bIsLocallyControlled && Controller && Controller->GetViewTarget() == this` (or some equivalent locally-controlled check).
3. The integration restores cosmetic / equip state via reflection or synthetic OnRep, decoupling the state-write from the engine's natural attach flow.

If your game has a single combined mesh, or the attach decision is purely role-based (server vs client) without a "view target" or "locally controlled" check, this learning likely doesn't apply.

## The symptom

On replay, the local player sees a **dark curved shape filling the upper portion of their FPP camera view**. Could look like a hat brim, a head cosmetic seen from inside, a hovering blob.

Bonus symptom: weapon visible looks wrong — small / different from what was equipped at capture (you're seeing the TPP weapon mesh attached at a TPP socket, not the FPP version).

## The diagnostic test (free, ~30 seconds, no debug camera needed)

**Aim down sights.** ADS shifts the FPP camera forward to align with the gun's sights, putting the camera ahead of the head bone.

- If the blob **moves out of view** when you ADS → it's the player's own TPP head/cosmetic geometry. Camera is now past the head, so the geometry is behind/below.
- If the blob **stays put** in your view when you ADS → it's something attached to the camera itself (UI overlay, post-process, FPP attachment). Different bug.

This test rules out 90% of "weird mesh in view" possibilities in seconds.

## Root cause

The runtime FPP-vs-TPP attach decision had at least one false precondition at the moment it ran:

- `bIsLocallyControlled` was false (pawn possession not finalised yet).
- `Controller` was null (controller setup ordering race).
- `Controller->GetViewTarget()` was not the pawn (view target hadn't been set, or was a transition camera, or a debug camera).

When the decision evaluates false, the cosmetic attaches to the **TPP mesh**. If the TPP mesh is owner-visible (e.g. `Mesh3P->bOnlyOwnerSee = false; bOwnerNoSee = false;`), the local player sees their own TPP cosmetics from the inside.

In editor, the timing usually has all preconditions true by the time the attach function runs. In shipping, the natural flow can race ahead of (or alongside) restore, and the attach evaluation lands during a window where one precondition is still false.

## How to apply

1. **Locate the attach decision in the host engine**. For ActionGame it was the player character's `ApplyCosmetic` function:

   ```cpp
   const bool bIsRendered1P = bIsLocallyControlled && Controller && (Controller->GetViewTarget() == this);
   EquippedCosmetic->SetRendered1P(bIsRendered1P ? GetMesh1P() : GetMesh(), bIsRendered1P);
   ```

   Search for `bIsLocallyControlled`, `GetViewTarget`, `SetRendered1P`, `Mesh1P` / `GetMesh1P` to find the equivalent in your game.

2. **Identify when that decision fires** relative to your restore. Common moments: pawn `BeginPlay`, `OnRep_PlayerState`, `PostSetupLoadout`, `OnLoadoutLoadedDelegate`. Add a log at the top of the attach function showing the three precondition values.

3. **Schedule restore so the engine's attach decision runs against finished setup**, not mid-possession. Practical patterns:
   - Run restore synchronously in your `OnPawnReady` / `OnPossessed` hook (after the controller is locked in).
   - If the engine's attach function early-returns until some flag (`IsLoadoutLoaded()`), wait for that flag too, but unpause the world during the wait (the async-load needs game-thread tick).
   - Avoid pre-restore deferrals — they can cause the natural attach to fire before your restore (see `restore-must-precede-natural-equip-flow` learning).

4. **As a last-resort fixup**, after restore explicitly destroy and re-attach the cosmetic with the right mesh:

   ```cpp
   if (PlayerChar->EquippedCosmetic)
   {
       PlayerChar->EquippedCosmetic->Destroy();
       PlayerChar->EquippedCosmetic = nullptr;
       PlayerChar->ApplyCosmetic(false); // re-runs the FPP/TPP decision
   }
   ```

   Only do this if you can't fix the root timing issue.

## Reference incident

ActionGame, Stage 3. Shipping-only first-replay artifact: dark blob filling upper FPP screen. ADS test confirmed it moved away when camera shifted forward → TPP cosmetic. Ranked candidate for hours: cheat-manager spawn timing, plugin commits, aerial-vehicle restore. Real cause was timing on the natural cosmetic-attach evaluation in the player character's `ApplyCosmetic` racing our reflection-driven `bIsCosmeticOn` poke, made worse in shipping by a 5s pre-restore deferral that let natural defaults install before our restore ran. ADS test would've cut diagnosis time from hours to minutes if applied first.
