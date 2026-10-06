# Reading the game's scenes and prefabs — pick the route in phase 1, use it in phases 2, 4 and 5

Much of a Unity game's state lives in the Editor, not in code: which components sit on which objects,
what a prefab contains, the values set in the Inspector. Phases 2 and 4, and every wave's deep scope in
phase 5, need to read that. **How** depends on two facts about the project, settled once in phase 1.

> **Never change how the studio's project saves its files.** Don't switch it to Force Text, not
> permanently and not for the length of the integration. It rewrites every scene and prefab (a huge diff,
> merge conflicts with the studio's own branches), and switching back doesn't restore the original files.
> The routes below read any project as it is.

## Pick the route (phase 1 readiness check)

1. Read `ProjectSettings/EditorSettings.asset` → `m_SerializationMode`: `2` = Force Text, `0` = Mixed,
   `1` = Force Binary. Mixed counts as "not Force Text": some files may be text, but you can't rely on it.
2. Read the Unity version from `ProjectSettings/ProjectVersion.txt`.

| Case | Project | Route | Proof it works |
| --- | --- | --- | --- |
| **A** | Force Text (any Unity version) | Read the `.unity` / `.prefab` / `.asset` files directly | one integration did all its discovery this way |
| **B** | Not Force Text, Unity 6.0+ | The Unity CLI with a resident headless Editor ([`agent-editor-tooling.md`](agent-editor-tooling.md)) | checked on a binary-saved Unity 6 project |
| **C** | Not Force Text, before Unity 6.0 (or the studio declines the package in case B) | The scene-dump script below, run headlessly | checked on a binary-saved Unity 6 project; its APIs exist since 2019.4, but it hasn't run on an older version yet |

Record the case in the tracker. In every case, **running** the game is the harness's job
([`agent-test-harness.md`](agent-test-harness.md)), and none of these routes shows objects that exist only
at runtime (spawned from code or Addressables). For those, a harness capture run logs the count per type.

## Case A — read the files

The files are YAML. What to look for:

- `--- !u!1 &<fileID>` starts a GameObject (`m_Name`, `m_IsActive`, `m_TagString`, `m_Component` lists its
  components by fileID). `!u!4` is a Transform: `m_Father` and `m_Children` give the hierarchy.
- `!u!114` is a MonoBehaviour. `m_Script: {fileID: 11500000, guid: <g>}` names the script: find the
  `.cs.meta` whose `guid:` is `<g>`. The script's serialized fields follow by name.
- `!u!1001` is a prefab instance. `m_SourcePrefab: {guid: <g>}` names the prefab, and `m_Modifications`
  lists only the values this instance overrides. Everything else comes from the source prefab, read
  separately.
- Grep across all scenes and prefabs at once (`--include=*.unity --include=*.prefab`), and split big
  projects across parallel read-only subagents. A level built from prefabs keeps its managers inside the
  prefabs, so a scene grep alone finds nothing
  ([prefab-composed-levels-hide-their-managers-from-scene-greps](../learnings/engine-quirks/prefab-composed-levels-hide-their-managers-from-scene-greps.md)).

When nested prefabs and overrides get too tangled to resolve by hand, run the case-C dump: it works on
Force Text projects too, and the Editor resolves every override for you.

## Case B — the Unity CLI, resident headless Editor

Set up once (phase 1): the package offer, install, commit and checks in
[`agent-editor-tooling.md`](agent-editor-tooling.md). Then for each reading session:

1. **Make sure no Editor holds the project** (no `Temp/UnityLockfile`, no `Unity.exe` with this
   `-projectPath`). If the integrator has it open, either ask them to close it while you read, or, with
   their OK, query their Editor read-only and skip steps 2 and 5.
2. **Start the resident headless Editor** in the background:
   `"<Unity.exe>" -batchmode -nographics -projectPath "<ABS_PROJECT>" -logFile "<ABS_LOG>"` (no `-quit`).
   Wait until `unity command --project-path "<ABS_PROJECT>"` answers (`unity status` won't list it).
3. **Read** with the read-only commands (`agent-editor-tooling.md` → *Reading commands*): typically
   `get_build_settings` → for each build scene `open_scene --path …` → `get_scene_hierarchy` →
   `get_component_properties --target <object> --type <Component>` for the objects that matter;
   `find_assets --type GameObject` for prefabs; `eval` for anything else. Save what you learn into the
   phase's artifact (`CODE_MAP.json`, `OBJECT_TRACKING.md`), so later phases don't re-query.
4. **Never call a mutating command** (`save_*`, `set_*`, `create_*`, …) while reading.
5. **Stop it** before anything that needs the project lock (a headless compile, the dev-player build):
   `unity command eval --code 'UnityEditor.EditorApplication.delayCall += () => UnityEditor.EditorApplication.Exit(0); return "exiting";' --project-path "<ABS_PROJECT>"`.

If the studio declines the package, or the project path is too deep for it on Windows, use case C. The
surprises of a headless Editor are collected in
[a-headless-editor-the-unity-cli-drives-is-invisible-to-status-and-holds-the-lock](../learnings/engine-quirks/a-headless-editor-the-unity-cli-drives-is-invisible-to-status-and-holds-the-lock.md).

## Case C — the scene-dump script

A small Editor-only script, added to the integration's own Editor folder (next to the dev-build
script), dumps every build scene and, on request, every prefab to text. It writes one `path = value` line
per serialized field: custom component fields, enum names, asset references, arrays of structs, and
nested prefab instances with their source prefab. It opens scenes and prefabs but never saves them.

**Run it** with no Editor holding the project:

```bash
"<Unity.exe>" -batchmode -quit -nographics -projectPath "<ABS_PROJECT>" \
  -executeMethod LudeoIntegration.EditorTools.LudeoProjectDump.Run \
  -ludeoDumpOut "<ABS_PROJECT>/ludeo-integration-plan/project-dump" -ludeoDumpPrefabs -logFile "<ABS_LOG>"
```

- **Pass** = the log line `[LudeoDump] done scenes=<n> prefabs=<m> out=…` with the counts you expect, and
  one `scene__*.txt` per build scene. Add `-ludeoDumpAllScenes` for scenes outside the build list.
- It takes seconds on a warm `Library`. Re-run it after the studio changes scenes, and before each wave's
  deep scope.
- Keep `project-dump/` out of commits (add it to the plan folder's `.gitignore`); it is a working copy
  of the studio's content.
- It doesn't cover ScriptableObject assets outside scenes and prefabs. If a wave needs them, extend it
  with the same `DumpFields` over `AssetDatabase.FindAssets("t:<Type>")`, and check the output.

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace LudeoIntegration.EditorTools
{
    /// <summary>
    /// Read-only dump of scenes and prefabs to text, so an agent can read a project whose assets are binary.
    /// Every GameObject (hierarchy, active, tag, layer, prefab source) and every component's serialized fields,
    /// one "path = value" line per field. Opens scenes and prefab contents, never saves them.
    /// Headless, with no Editor holding the project:
    ///   Unity.exe -batchmode -quit -projectPath &lt;proj&gt; -executeMethod LudeoIntegration.EditorTools.LudeoProjectDump.Run
    ///     -ludeoDumpOut &lt;abs dir&gt; [-ludeoDumpAllScenes] [-ludeoDumpPrefabs] -logFile &lt;abs log&gt;
    /// </summary>
    public static class LudeoProjectDump
    {
        private const int MAX_LINES_PER_COMPONENT = 300;
        private const int MAX_ARRAY_ELEMENTS = 50;

        public static void Run()
        {
            string outDir = Arg("-ludeoDumpOut") ?? "ludeo-integration-plan/project-dump";
            Directory.CreateDirectory(outDir);

            List<string> scenes = HasArg("-ludeoDumpAllScenes")
                ? AssetDatabase.FindAssets("t:Scene", new[] { "Assets" }).Select(AssetDatabase.GUIDToAssetPath).ToList()
                : EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToList();

            int sceneCount = 0;
            foreach (string path in scenes)
            {
                var scene = EditorSceneManager.OpenScene(path, OpenSceneMode.Single);
                var sb = new StringBuilder();
                sb.AppendLine($"# scene {path}");
                foreach (GameObject root in scene.GetRootGameObjects())
                    DumpGameObject(root, 0, sb);
                File.WriteAllText(Path.Combine(outDir, "scene__" + Safe(path) + ".txt"), sb.ToString());
                sceneCount++;
            }

            int prefabCount = 0;
            if (HasArg("-ludeoDumpPrefabs"))
            {
                foreach (string path in AssetDatabase.FindAssets("t:Prefab", new[] { "Assets" }).Select(AssetDatabase.GUIDToAssetPath))
                {
                    GameObject root = PrefabUtility.LoadPrefabContents(path);
                    try
                    {
                        var sb = new StringBuilder();
                        sb.AppendLine($"# prefab {path}");
                        DumpGameObject(root, 0, sb);
                        File.WriteAllText(Path.Combine(outDir, "prefab__" + Safe(path) + ".txt"), sb.ToString());
                        prefabCount++;
                    }
                    finally
                    {
                        PrefabUtility.UnloadPrefabContents(root);
                    }
                }
            }

            Debug.Log($"[LudeoDump] done scenes={sceneCount} prefabs={prefabCount} out={Path.GetFullPath(outDir)}");
        }

        private static void DumpGameObject(GameObject go, int depth, StringBuilder sb)
        {
            string pad = new string(' ', depth * 2);
            string prefab = PrefabUtility.IsAnyPrefabInstanceRoot(go)
                ? " prefab=" + PrefabUtility.GetPrefabAssetPathOfNearestInstanceRoot(go)
                : string.Empty;
            sb.AppendLine($"{pad}GameObject \"{go.name}\" active={go.activeSelf} tag={go.tag} layer={LayerMask.LayerToName(go.layer)}{prefab}");

            foreach (Component component in go.GetComponents<Component>())
            {
                if (component == null)
                {
                    sb.AppendLine($"{pad}  [Missing script]");
                    continue;
                }
                sb.AppendLine($"{pad}  [{component.GetType().FullName}]");
                DumpFields(component, pad + "    ", sb);
            }

            foreach (Transform child in go.transform)
                DumpGameObject(child.gameObject, depth + 1, sb);
        }

        private static void DumpFields(UnityEngine.Object target, string pad, StringBuilder sb)
        {
            var so = new SerializedObject(target);
            SerializedProperty it = so.GetIterator();
            int lines = 0;
            bool enter = true;
            while (it.NextVisible(enter))
            {
                enter = true;
                if (it.propertyPath == "m_Script")
                    continue;
                if (it.isArray && it.propertyType != SerializedPropertyType.String && it.arraySize > MAX_ARRAY_ELEMENTS)
                {
                    sb.AppendLine($"{pad}{it.propertyPath} = <array of {it.arraySize}, not expanded>");
                    enter = false;
                    continue;
                }
                if (it.hasVisibleChildren && it.propertyType == SerializedPropertyType.Generic)
                    continue; // its children follow, each on its own line
                if (++lines > MAX_LINES_PER_COMPONENT)
                {
                    sb.AppendLine($"{pad}<truncated after {MAX_LINES_PER_COMPONENT} fields>");
                    return;
                }
                sb.AppendLine($"{pad}{it.propertyPath} = {Value(it)}");
                enter = false; // a printed value (vector, color, string…) is not expanded further
            }
        }

        private static string Value(SerializedProperty p)
        {
            switch (p.propertyType)
            {
                case SerializedPropertyType.Integer: return p.longValue.ToString();
                case SerializedPropertyType.Boolean: return p.boolValue.ToString();
                case SerializedPropertyType.Float: return p.doubleValue.ToString("R");
                case SerializedPropertyType.String: return "\"" + p.stringValue + "\"";
                case SerializedPropertyType.Enum:
                    return p.enumValueIndex >= 0 && p.enumValueIndex < p.enumDisplayNames.Length
                        ? p.enumDisplayNames[p.enumValueIndex]
                        : p.intValue.ToString();
                case SerializedPropertyType.ObjectReference:
                    UnityEngine.Object o = p.objectReferenceValue;
                    if (o == null) return "null";
                    string assetPath = AssetDatabase.GetAssetPath(o);
                    return string.IsNullOrEmpty(assetPath) ? $"{o.GetType().Name} \"{o.name}\" (in scene)" : $"{o.GetType().Name} {assetPath}";
                case SerializedPropertyType.Vector2: return p.vector2Value.ToString("R");
                case SerializedPropertyType.Vector3: return p.vector3Value.ToString("R");
                case SerializedPropertyType.Vector4: return p.vector4Value.ToString("R");
                case SerializedPropertyType.Quaternion: return p.quaternionValue.eulerAngles.ToString("R") + " (euler)";
                case SerializedPropertyType.Color: return p.colorValue.ToString();
                case SerializedPropertyType.Rect: return p.rectValue.ToString();
                case SerializedPropertyType.Bounds: return p.boundsValue.ToString();
                case SerializedPropertyType.LayerMask: return p.intValue.ToString();
                case SerializedPropertyType.ArraySize: return p.intValue.ToString();
                default: return "<" + p.propertyType + ">";
            }
        }

        private static string Safe(string path) => path.Replace('/', '_').Replace('\\', '_').Replace(' ', '_');

        private static bool HasArg(string name) => Environment.GetCommandLineArgs().Contains(name);

        private static string Arg(string name)
        {
            string[] args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }
}
```

**Last resort: a read-only Force Text copy.** If the dump can't show something, copy the project to a
separate folder outside the studio's working copy, switch only the copy to Force Text there
(`EditorSettings.serializationMode = SerializationMode.ForceText;` then
`AssetDatabase.ForceReserializeAssets();` in a batch run), and read the copy. It costs a full import and
drifts as the studio changes scenes. Never commit from it.
