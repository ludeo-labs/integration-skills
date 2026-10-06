---
category: engine-quirks
tier: generalizable
sourceGame: IdleSample
phase: "2,4,7"
question: "Does the project build players through a build-configuration tool that stores its own per-release scene lists and scripting defines (a multi-build package, custom build window, CI build profiles)? Then EditorBuildSettings and the Editor's current define set describe neither the Ludeo build's scenes nor its defines - read the release profile instead."
sanitized: true
---

# With a per-release build tool, Build Settings and the Editor's defines are not the build's

Two phase-2 checks normally read Unity's own settings:

- "which scenes ship?" from `ProjectSettings/EditorBuildSettings.asset`
  ([[check-what-actually-ships-before-scoping-per-entity-work]])
- "is this hook's `#if` fence live in the target build?" from the define set
  ([[verify-the-define-fence-before-citing-a-hook]])

Both gave the wrong answer on a project whose players are built by a build-configuration tool.

**Scenes.** Build Settings omitted some gameplay scenes that game code loaded by name with
`SceneManager.LoadSceneAsync`. It looked like a guaranteed player-build failure. It wasn't: the build
tool's settings asset carried a **per-release-type scene list** (by scene GUID), and every release type,
including the Ludeo ones, listed all of them. Build Settings was only the Editor's Play Mode list.

**Defines.** The Editor's Standalone scripting defines were a **snapshot of whatever the build tool
wrote on its last build**. That was a different release type at the time, so code fenced on that
release's define (say `<OTHER_RELEASE_DEFINE>`) was compiled into Editor play, while the Ludeo release
types define a different set. A fence check against `ProjectSettings.asset` would have resolved hooks
against the wrong build.

## The check

1. Look for a build tool before trusting Unity's settings: a build settings asset with release/build
   types, a custom build window, or CI build profiles. Grep `Assets/` for the Ludeo define name in
   `*.asset` files; the release type that sets it is your target.
2. **Scenes:** read that release type's scene list (resolve GUIDs via `*.unity.meta`). Treat
   `EditorBuildSettings` as Play Mode only.
3. **Defines:** resolve every `#if` against the release type's define list, not the Editor's current
   symbols. Record in the code map that the Editor's defines are a stale snapshot, so later phases don't
   test a fence in Play Mode and assume it holds in the Ludeo build.
4. **Phase 7:** build through that tool's Ludeo release type
   ([[build-players-only-through-the-studios-own-pipeline]]), never a bare `BuildPipeline.BuildPlayer`
   with the Editor's scene list, which would silently drop scenes and use the wrong defines.
