---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: 2
question: "Does the game gate player input through a one-property interface that a central controller collects with FindObjectsOfType and ANDs together — instead of through a central game-state enum?"
sanitized: true
---

# When a game has no game-state enum, its controls-gate interface is the equivalent single lever — and it answers three phase-2/3 questions at once

[[non-ludeoable-spans-as-a-state-machine-not-paired-calls]] assumes a central `GameState` enum plus a
change notification. Plenty of games have no such thing. A common alternative shape — worth grepping
for explicitly before concluding "this game has no single lever" — is a **controls-gate interface**:

```csharp
// game-side: one property, implemented by every screen/cutscene/sequence that takes control away
public interface IControlsGate { bool ControlsAllowed { get; set; } }

// game-side: the player controller is the arbiter
public class PlayerController : MonoBehaviour
{
    List<IControlsGate> m_gates = new();
    public static bool ControlsShouldBeOn;

    void Start()   // ONCE per level load
    {
        m_gates.AddRange(FindObjectsOfType<MonoBehaviour>().OfType<IControlsGate>());
    }

    void Update()  // every frame
    {
        ControlsShouldBeOn = m_gates.TrueForAll(g => g.ControlsAllowed);
        SetInputEnabled(ControlsShouldBeOn);   // toggles PlayerInput + the camera input provider
    }
}
```

Find it by grepping for a one-property interface whose name pairs "controls"/"input"/"player" with
"on"/"enabled"/"allowed", then for the `OfType<...>()` / `FindObjectsOfType` call that collects it.

## It solves three separate problems

1. **It is the non-ludeoable census (phase 2, `non_ludeoable_candidates`).** The set of classes
   implementing the interface *is* the game team's own enumeration of "spans during which the player is
   not in control" — cutscenes, camera cutaways, dialogue, menu-ish screens, scripted respawns. In the
   source integration it produced ten implementors in one grep, where a keyword hunt for
   `Shop|Dialogue|Tutorial|Cutscene` would have found a subset and invented false positives.

2. **It is a zero-game-file-edit suppression seam (phases 3 & 5).** A `[Layer]` MonoBehaviour that
   implements the interface and holds the property `false` suppresses player input *through the game's
   own arbiter* — no game code touched, and it composes correctly with the game's own gates because the
   arbiter ANDs them.

3. **It is the non-`timeScale` suppression path** that
   [[timescale-arbiter-must-restore-the-observed-value-not-1f]] tells you to plan for. That matters most
   when the game re-asserts `Time.timeScale = 1` every frame from an `Update` (it did here), so a bare
   freeze is undone on the next frame.

## Four preconditions to verify before relying on it

1. **Collection is usually ONE-SHOT, in `Start()`, via `FindObjectsOfType`.** A layer object that
   comes into being later — or whose `Start` runs after the arbiter's — is silently never collected, and
   the seam appears to do nothing. Give the layer an explicit `[DefaultExecutionOrder]` ahead of the
   arbiter, or add a re-collect call. This is the same failure mode as
   [[the-per-class-register-hook-fires-before-capture-goes-live]], one layer up.
2. **It gates input, not the simulation.** It typically toggles only the input component and the camera
   input provider. Physics, AI and animation keep running — so it is a *control* suppressor, and CR-010's
   overwrite guard still needs either the freeze or a genuine sim gate alongside it.
3. **The list is rebuilt per level and nothing persists it.** Re-establish the layer's membership on
   every level load, not once at bootstrap.
4. **Implementor ≠ non-ludeoable.** Classify every implementor with `timeScale` evidence per
   [[classify-non-ludeoable-by-whether-the-sim-actually-freezes]]. The pause menu is normally an
   implementor too, and it *does* freeze — so it is `PauseLudeo`/`ResumeLudeo`, not a non-ludeoable span.

## Two shape differences from the state-machine pattern

- **Many implementors have ONE toggle site, not a paired enter/exit.** A screen that does
  `panel.SetActive(!panel.activeSelf); ControlsAllowed = !panel.activeSelf;` opens and closes the span
  from the same line. Do not go looking for a matching exit site — record the toggle once and derive
  the span from the value, not from the call.
- **There is no notification to subscribe to.** The arbiter *polls* every frame. So the layer either
  polls the aggregate flag itself or — better — derives its spans from each gate's own state change.
  Watch for the mirror of the self-driven-state-change guard: if the layer sets its own gate to `false`
  during a restore, anything deriving non-ludeoable spans from "some gate is closed" will emit
  `StartNoneLudeable` at its own restore. Exclude the layer's own gate from that derivation.
