"""Ludeo BP Inspector — read/write Blueprint variable metadata from UE Editor.

Runs inside UE Editor (headless via UnrealEditor-Cmd or in-editor console).
Requires the Python Editor Script Plugin to be enabled.

Usage via batch wrapper:
    RunBPInspector.bat inspect
    RunBPInspector.bat set-savegame /Game/Path/BP_Name VarName true

Usage direct:
    UnrealEditor-Cmd.exe Game.uproject -ExecutePythonScript="bp_inspector.py" -PythonArg="inspect"
"""
import sys
import json
import os
from datetime import datetime, timezone

try:
    import unreal
except ImportError:
    print("ERROR: 'unreal' module not available. This script must run inside UE Editor.")
    print("Enable the Python Editor Script Plugin: Edit > Plugins > search 'Python' > enable 'Python Editor Script Plugin' > restart editor.")
    sys.exit(1)


# ============================================================
# File-based Log Sink
# ============================================================
# Headless UE Editor (-stdout -nullrhi) swallows LogPython output.
# We write a companion log file so agents can read progress/errors
# after the headless run completes.

_LOG_FILE = None


def _open_log_file():
    """Open .ludeo/bp-inspector-log.txt for writing (overwrites per run)."""
    global _LOG_FILE
    ludeo_dir = find_ludeo_dir()
    if ludeo_dir:
        try:
            _LOG_FILE = open(os.path.join(ludeo_dir, "bp-inspector-log.txt"), "w", encoding="utf-8")
        except Exception:
            pass


def _close_log_file():
    """Flush and close the log file."""
    global _LOG_FILE
    if _LOG_FILE:
        try:
            _LOG_FILE.close()
        except Exception:
            pass
        _LOG_FILE = None


# ============================================================
# C++ Plugin Detection
# ============================================================

_PLUGIN = None

def _detect_plugin():
    """Check if the LudeoBPInspector C++ plugin is available."""
    global _PLUGIN
    try:
        _PLUGIN = unreal.LudeoBPInspectorLibrary
        log("LudeoBPInspector C++ plugin detected — using native introspection")
    except AttributeError:
        _PLUGIN = None
        log("LudeoBPInspector C++ plugin not found — using .uasset fallback")


# ============================================================
# Constants
# ============================================================

# Gameplay-relevant base classes. BPs inheriting from these are scanned.
GAMEPLAY_BASE_CLASSES = [
    "/Script/Engine.Character",
    "/Script/Engine.Pawn",
    "/Script/Engine.PlayerController",
    "/Script/Engine.PlayerState",
    "/Script/Engine.GameStateBase",
    "/Script/Engine.GameModeBase",
    "/Script/Engine.ActorComponent",
]


def log(msg):
    """Log to stdout, UE's LogPython channel, and the log file."""
    text = f"[BPInspector] {msg}"
    print(text)
    try:
        unreal.log(text)
    except Exception:
        pass
    if _LOG_FILE:
        try:
            _LOG_FILE.write(text + "\n")
            _LOG_FILE.flush()
        except Exception:
            pass


def get_engine_version():
    """Return UE version string for logging."""
    try:
        return unreal.SystemLibrary.get_engine_version()
    except Exception:
        return "unknown"


def get_project_name():
    """Return the project name from the running editor."""
    try:
        return unreal.SystemLibrary.get_project_directory().rstrip("/\\").split("/")[-1]
    except Exception:
        return "unknown"


def find_ludeo_dir():
    """Find the .ludeo/ directory relative to the project root."""
    try:
        project_dir = unreal.SystemLibrary.get_project_directory()
        ludeo_dir = os.path.join(project_dir, ".ludeo")
        if not os.path.isdir(ludeo_dir):
            os.makedirs(ludeo_dir, exist_ok=True)
        return ludeo_dir
    except Exception:
        return None


# ============================================================
# BP Discovery
# ============================================================

def get_all_blueprint_assets():
    """Query Asset Registry for all Blueprint assets under /Game/.

    Handles UE 4.x (class_names) and UE 5.x (class_paths / get_all_assets) API differences.
    """
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    assets = []

    # Approach 1: UE 4.x style — ARFilter with class_names + recursive_paths
    try:
        ar_filter = unreal.ARFilter()
        ar_filter.class_names = ["Blueprint"]
        ar_filter.recursive_paths = True
        ar_filter.package_paths = ["/Game"]
        assets = asset_registry.get_assets(ar_filter)
        if assets:
            log(f"Found {len(assets)} Blueprint assets (ARFilter.class_names)")
            return assets
    except Exception as e:
        log(f"ARFilter.class_names approach failed: {e}")

    # Approach 2: UE 5.1+ — use get_assets_by_class or get_all_assets and filter
    try:
        all_assets = asset_registry.get_all_assets()
        for a in all_assets:
            # Check if it's a Blueprint asset under /Game/
            pkg = str(a.package_name) if hasattr(a, 'package_name') else str(getattr(a, 'object_path', ''))
            if not pkg.startswith("/Game"):
                continue
            # Check class — try multiple attributes for version compat
            asset_class = ""
            if hasattr(a, 'asset_class_path'):
                asset_class = str(a.asset_class_path)
            elif hasattr(a, 'asset_class'):
                asset_class = str(a.asset_class)
            if "Blueprint" in asset_class:
                assets.append(a)
        log(f"Found {len(assets)} Blueprint assets (get_all_assets filter)")
    except Exception as e:
        log(f"get_all_assets approach failed: {e}")

    if not assets:
        log("WARNING: Could not find any Blueprint assets. Asset Registry may not be fully loaded.")

    return assets


def _get_class_hierarchy(bp_class):
    """Walk the class parent chain. Handles both UE4 and UE5 Python API differences.

    UE4: bp_class.get_super_class() works
    UE5: BlueprintGeneratedClass doesn't have get_super_class();
         use CDO isinstance checks or string-based parent class lookup instead.
    """
    hierarchy = []

    # Method 1: get_super_class chain (UE4, some UE5 versions)
    try:
        current = bp_class
        depth = 0
        while current is not None and depth < 50:
            depth += 1
            try:
                hierarchy.append(current.get_path_name())
            except Exception:
                break
            try:
                current = current.get_super_class()
            except (AttributeError, Exception):
                break
            if current:
                try:
                    if current.get_name() == "Object":
                        break
                except Exception:
                    break
        if len(hierarchy) > 1:
            return hierarchy
    except Exception:
        pass

    # Method 2: CDO isinstance checks (works in UE5 when get_super_class is missing)
    # Get the CDO and check if it's an instance of our target types
    try:
        cdo = unreal.get_default_object(bp_class)
        if cdo is not None:
            # Check known base types
            type_checks = [
                ("Character", unreal.Character),
                ("Pawn", unreal.Pawn),
                ("PlayerController", unreal.PlayerController),
                ("PlayerState", unreal.PlayerState),
                ("GameStateBase", unreal.GameStateBase),
                ("GameModeBase", unreal.GameModeBase),
            ]
            for name, cls in type_checks:
                try:
                    if isinstance(cdo, cls):
                        hierarchy = [bp_class.get_path_name(), f"/Script/Engine.{name}"]
                        return hierarchy
                except Exception:
                    continue

            # Check ActorComponent
            try:
                if isinstance(cdo, unreal.ActorComponent):
                    hierarchy = [bp_class.get_path_name(), "/Script/Engine.ActorComponent"]
                    return hierarchy
            except Exception:
                pass
    except Exception:
        pass

    # Method 3: fall back to just the BP class path
    try:
        hierarchy = [bp_class.get_path_name()]
    except Exception:
        pass

    return hierarchy


def is_gameplay_relevant(bp_class):
    """Check if a BP class inherits from a gameplay-relevant base class."""
    if bp_class is None:
        return False

    # Quick reject: Widget and Animation BPs
    class_type_name = type(bp_class).__name__
    if any(skip in class_type_name for skip in ["Widget", "Anim", "Sequencer", "Niagara"]):
        return False

    hierarchy = _get_class_hierarchy(bp_class)

    for class_path in hierarchy:
        for base in GAMEPLAY_BASE_CLASSES:
            if base in class_path:
                return True
        # Also check by name suffix
        for base_name in ["Character", "Pawn", "PlayerController",
                          "PlayerState", "GameStateBase", "GameModeBase",
                          "ActorComponent"]:
            if class_path.endswith("." + base_name):
                return True

    return False


def get_native_parent_name(bp_class):
    """Find the first C++ parent class name from the hierarchy."""
    hierarchy = _get_class_hierarchy(bp_class)

    for class_path in hierarchy:
        if class_path.startswith("/Script/"):
            # Extract class name from path like /Script/Engine.Character
            return class_path.split(".")[-1] if "." in class_path else class_path.split("/")[-1]

    return "Unknown"


def _get_native_parent_class(bp_class):
    """Return the first C++ parent class object from the BP's hierarchy.

    Used to build an exclusion set of inherited properties so we can filter
    down to BP-defined variables only. Returns None if not found (caller
    should fall back to showing all properties).
    """
    # Method 1: walk get_super_class() chain — works on some UE versions
    try:
        current = bp_class
        for _ in range(50):
            parent = current.get_super_class()
            if parent is None:
                break
            try:
                if parent.get_path_name().startswith("/Script/"):
                    return parent
            except Exception:
                break
            current = parent
    except (AttributeError, Exception):
        pass

    # Method 2: use known unreal module class objects via isinstance on CDO.
    # Check most-specific first (Character before Pawn) so we get the tightest
    # exclusion set possible.
    try:
        cdo = unreal.get_default_object(bp_class)
        if cdo is not None:
            for cls in [unreal.Character, unreal.PlayerController,
                        unreal.PlayerState, unreal.GameStateBase,
                        unreal.GameModeBase, unreal.Pawn]:
                try:
                    if isinstance(cdo, cls):
                        return cls
                except Exception:
                    continue
            try:
                if isinstance(cdo, unreal.ActorComponent):
                    return unreal.ActorComponent
            except Exception:
                pass
    except Exception:
        pass

    return None


# ============================================================
# Property Inspection
# ============================================================

# Map Python type names to UE-friendly display names
_TYPE_MAP = {
    "float": "Float",
    "int": "Int32",
    "bool": "Boolean",
    "str": "String",
    "Vector": "FVector",
    "Rotator": "FRotator",
    "Name": "FName",
    "Text": "FText",
    "Transform": "FTransform",
    "LinearColor": "FLinearColor",
    "SoftObjectPath": "FSoftObjectPath",
}


def _extract_candidate_names_from_uasset(package_name):
    """Extract PascalCase candidate variable names from a .uasset file.

    UE's Python bindings don't expose BP variable enumeration (dir() on the CDO
    only shows C++ UPROPERTY bindings, and NewVariables is protected). Instead,
    we scan the .uasset binary's name table for PascalCase identifiers and then
    verify each one against get_editor_property() on the CDO.
    """
    import re
    import struct

    try:
        project_dir = unreal.SystemLibrary.get_project_directory()
    except Exception:
        return set()

    # /Game/FPS_Game/Blueprints/BP_CharacterBase -> Content/FPS_Game/Blueprints/BP_CharacterBase.uasset
    relative = package_name.replace("/Game/", "Content/", 1) + ".uasset"
    uasset_path = os.path.join(project_dir, relative.replace("/", os.sep))

    if not os.path.isfile(uasset_path):
        return set()

    try:
        with open(uasset_path, "rb") as f:
            # Read enough for the name table (typically in first ~50KB)
            data = f.read(min(os.path.getsize(uasset_path), 65536))
    except Exception:
        return set()

    # Verify .uasset magic
    if len(data) < 200:
        return set()
    magic = struct.unpack_from('<I', data, 0)[0]
    if magic != 0x9E2A83C1:
        return set()

    # Scan for null-terminated ASCII strings that match PascalCase identifiers.
    # BP variable names in the name table are stored as length-prefixed or
    # null-terminated strings. We scan for sequences of printable ASCII
    # followed by a null byte, then filter to PascalCase patterns.
    candidates = set()
    i = 0
    while i < len(data) - 4:
        if data[i] == 0 and i > 0:
            # Walk backward to find start of string
            j = i - 1
            while j >= 0 and 32 <= data[j] < 127:
                j -= 1
            j += 1
            length = i - j
            if 3 <= length <= 60:
                s = data[j:i].decode('ascii', errors='ignore')
                # PascalCase: starts with uppercase, contains lowercase
                if re.match(r'^[A-Z][a-zA-Z0-9_]{2,59}$', s) and any(c.islower() for c in s):
                    candidates.add(s)
        i += 1

    return candidates



def _check_save_game_flag(bp_class, bp_asset, cdo, var_name):
    """Check if a BP variable has the SaveGame flag set.

    Tries multiple approaches since UE's Python API varies across versions.
    In UE 5.7, find_property_by_name is not available on BlueprintGeneratedClass,
    so we also try accessing the property via the CDO or FieldPath utilities.
    """
    # Approach 1: find_property_by_name on class (UE 4.x, some 5.x)
    for obj in [bp_class, cdo]:
        try:
            if hasattr(obj, "find_property_by_name"):
                prop = obj.find_property_by_name(var_name)
                if prop and hasattr(prop, "has_any_property_flags"):
                    return bool(prop.has_any_property_flags(0x00010000))  # CPF_SaveGame
        except Exception:
            pass

    # Approach 2: try unreal.BlueprintEditorLibrary or KismetSystemLibrary
    # Some versions expose property metadata utilities
    try:
        if hasattr(unreal, "KismetSystemLibrary"):
            ks = unreal.KismetSystemLibrary
            if hasattr(ks, "get_save_game_property_flag"):
                return bool(ks.get_save_game_property_flag(cdo, var_name))
    except Exception:
        pass

    # Approach 3: parse SaveGame flag from the Blueprint's NewVariables via
    # protected field access workaround. NewVariables is protected via
    # get_editor_property, but some UE versions expose it as a Python attribute.
    try:
        nv = getattr(bp_asset, "new_variables", None)
        if nv is not None:
            for var_desc in nv:
                try:
                    vn = str(var_desc.get_editor_property("var_name"))
                    if vn == var_name:
                        flags = var_desc.get_editor_property("property_flags")
                        return bool(int(flags) & 0x00010000)
                except Exception:
                    pass
    except Exception:
        pass

    # Cannot determine SaveGame flag — return False (safe default)
    return False


def _get_variables_via_plugin(bp_asset):
    """List BP variables using the C++ plugin (authoritative, no binary scanning)."""
    infos = _PLUGIN.list_blueprint_variables(bp_asset)
    variables = []
    for info in infos:
        variables.append({
            "name": str(info.get_editor_property("var_name")),
            "type": str(info.get_editor_property("var_type")),
            "saveGame": bool(info.get_editor_property("save_game")),
            "replicated": bool(info.get_editor_property("replicated")),
            "defaultValue": str(info.get_editor_property("default_value")),
            "propertyFlags": int(info.get_editor_property("property_flags")),
            "component": None,
        })
    return variables


def _get_components_via_plugin(bp_asset):
    """List BP components using the C++ plugin."""
    nodes = _PLUGIN.get_blueprint_components(bp_asset)
    components = []
    for node in nodes:
        components.append({
            "componentName": str(node.get_editor_property("component_name")),
            "componentClass": str(node.get_editor_property("component_class")),
            "isRootComponent": bool(node.get_editor_property("is_root_component")),
        })
    return components


def _get_parent_class_via_plugin(bp_asset):
    """Get native parent class name via C++ plugin."""
    name = _PLUGIN.get_parent_class_name(bp_asset)
    return str(name) if name else "Unknown"


def _get_functions_via_plugin(bp_asset):
    """List BP functions and custom events using the C++ plugin."""
    infos = _PLUGIN.list_blueprint_functions(bp_asset)
    functions = []
    for info in infos:
        functions.append({
            "name": str(info.get_editor_property("function_name")),
            "inputPins": [str(p) for p in info.get_editor_property("input_pins")],
            "outputPins": [str(p) for p in info.get_editor_property("output_pins")],
            "isCustomEvent": bool(info.get_editor_property("is_custom_event")),
        })
    return functions


def _get_events_via_plugin(bp_asset):
    """List BP events using the C++ plugin."""
    infos = _PLUGIN.list_blueprint_events(bp_asset)
    events = []
    for info in infos:
        events.append({
            "name": str(info.get_editor_property("event_name")),
            "isCustomEvent": bool(info.get_editor_property("is_custom_event")),
            "eventClass": str(info.get_editor_property("event_class")),
        })
    return events


def _get_call_graph_via_plugin(bp_asset, function_name):
    """Get the exec-pin call graph for a function/event using the C++ plugin."""
    nodes = _PLUGIN.get_function_call_graph(bp_asset, function_name)
    result = []
    for node in nodes:
        result.append({
            "nodeName": str(node.get_editor_property("node_name")),
            "nodeClass": str(node.get_editor_property("node_class")),
            "nodeTitle": str(node.get_editor_property("node_title")),
            "calledFunction": str(node.get_editor_property("called_function")),
            "nodeIndex": int(node.get_editor_property("node_index")),
        })
    return result


def get_bp_variables(bp_asset, package_name=""):
    """Get all user-defined variables from a Blueprint, with SaveGame flag status.

    Returns a list of dicts: [{"name", "type", "saveGame", "component"}]

    Strategy: BP variables aren't visible via dir() on the CDO — only C++ UPROPERTY
    bindings show up there. Instead, we extract candidate variable names from the
    .uasset binary's name table and verify each one via get_editor_property() on the CDO.
    """
    variables = []

    # Use C++ plugin when available (authoritative, no binary scanning)
    if _PLUGIN is not None:
        return _get_variables_via_plugin(bp_asset)

    try:
        bp_class = bp_asset.generated_class()
        if bp_class is None:
            return variables
    except Exception:
        try:
            bp_path = bp_asset.get_path_name()
            bp_class = unreal.load_object(None, bp_path + "_C")
            if bp_class is None:
                return variables
        except Exception:
            return variables

    # Get CDO
    try:
        cdo = unreal.get_default_object(bp_class)
    except Exception:
        try:
            cdo = bp_class.get_default_object()
        except Exception:
            return variables

    if cdo is None:
        return variables

    # Get candidate names from .uasset binary
    candidates = _extract_candidate_names_from_uasset(package_name)
    if not candidates:
        log(f"  Warning: No candidate variable names extracted from .uasset")
        return variables

    # Build exclusion set: names that exist as properties on the native C++ parent
    # CDO are engine-level, not BP-defined. We use get_editor_property() to test
    # candidates against the native parent CDO — if readable there, it's inherited.
    inherited_names = set()
    native_parent = _get_native_parent_class(bp_class)
    if native_parent is not None:
        try:
            parent_cdo = unreal.get_default_object(native_parent)
            if parent_cdo is not None:
                for name in candidates:
                    try:
                        parent_cdo.get_editor_property(name)
                        inherited_names.add(name)
                    except Exception:
                        pass
        except Exception:
            pass

    # Verify each candidate: readable on BP CDO and NOT on native parent CDO
    for name in sorted(candidates):
        if name in inherited_names:
            continue

        try:
            val = cdo.get_editor_property(name)
        except Exception:
            continue  # Not a valid variable on this BP

        # Get property type
        prop_type = type(val).__name__ if val is not None else "None"
        display_type = _TYPE_MAP.get(prop_type, prop_type)

        # Check SaveGame flag
        save_game = _check_save_game_flag(bp_class, bp_asset, cdo, name)

        variables.append({
            "name": name,
            "type": display_type,
            "saveGame": save_game,
            "component": None,
        })

    return variables


# ============================================================
# Commands
# ============================================================

def cmd_inspect():
    """Scan all gameplay BPs and write inspection report to JSON."""
    log(f"Engine version: {get_engine_version()}")
    _detect_plugin()
    log(f"Project: {get_project_name()}")
    log("Starting Blueprint inspection...")

    bp_assets = get_all_blueprint_assets()

    results = []
    errors = []
    total_vars = 0
    with_flag = 0
    without_flag = 0

    for asset_data in bp_assets:
        pkg_name = str(asset_data.package_name)

        try:
            bp_asset = unreal.EditorAssetLibrary.load_asset(pkg_name)
            if bp_asset is None:
                continue
        except Exception as e:
            errors.append({"path": pkg_name, "error": str(e)})
            continue

        # Get the generated class from the Blueprint asset
        bp_class = None

        # Method 1: generated_class() (works on some UE versions)
        try:
            bp_class = bp_asset.generated_class()
        except (AttributeError, Exception):
            pass

        # Method 2: get_editor_property('GeneratedClass')
        if bp_class is None:
            try:
                bp_class = bp_asset.get_editor_property("generated_class")
            except (AttributeError, Exception):
                pass

        # Method 3: Load the _C class directly by path
        if bp_class is None:
            try:
                class_path = pkg_name + "." + str(asset_data.asset_name) + "_C"
                bp_class = unreal.load_object(None, class_path)
            except Exception:
                pass

        if bp_class is None:
            continue

        if not is_gameplay_relevant(bp_class):
            continue

        parent_name = get_native_parent_name(bp_class)
        variables = get_bp_variables(bp_asset, package_name=pkg_name)

        # Get components via plugin if available
        components = []
        if _PLUGIN is not None:
            components = _get_components_via_plugin(bp_asset)
            parent_name = _get_parent_class_via_plugin(bp_asset)

        if not variables:
            continue

        for v in variables:
            total_vars += 1
            if v["saveGame"]:
                with_flag += 1
            else:
                without_flag += 1

        entry = {
            "path": pkg_name,
            "parentClass": parent_name,
            "variables": variables,
        }
        if components:
            entry["components"] = components
        results.append(entry)

        log(f"  {pkg_name}: {len(variables)} variables "
            f"({sum(1 for v in variables if v['saveGame'])} with SaveGame)")

    # Build report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project": get_project_name(),
        "engineVersion": get_engine_version(),
        "blueprints": results,
        "errors": errors,
        "summary": {
            "bpsScanned": len(bp_assets),
            "gameplayBpsFound": len(results),
            "totalVariables": total_vars,
            "withSaveGameFlag": with_flag,
            "withoutSaveGameFlag": without_flag,
        },
    }

    # Write to .ludeo/bp-inspection-report.json
    ludeo_dir = find_ludeo_dir()
    if ludeo_dir:
        report_path = os.path.join(ludeo_dir, "bp-inspection-report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        log(f"Report written to: {report_path}")
    else:
        log("WARNING: Could not find .ludeo/ directory. Printing report to stdout.")
        print(json.dumps(report, indent=2))

    # Summary
    log("")
    log("=== INSPECTION SUMMARY ===")
    log(f"Blueprints scanned:      {len(bp_assets)}")
    log(f"Gameplay BPs found:      {len(results)}")
    log(f"Total variables:         {total_vars}")
    log(f"With SaveGame flag:      {with_flag}")
    log(f"Without SaveGame flag:   {without_flag}")
    if errors:
        log(f"Errors:                  {len(errors)}")
    log("")

    filtered = len(bp_assets) - len(results)
    if filtered > 0:
        log(f"NOTE: {filtered} BPs were outside the gameplay base classes and excluded from this report.")
        log("      For spawners, weapon actors, AI managers, or pickups use 'inspect-path <bp_path...>';")
        log("      for what is actually placed/spawned in a map use 'inspect-level <map_path>'.")
        log("")

    if with_flag == 0 and total_vars > 0:
        log("WARNING: No gameplay variables have the SaveGame flag set.")
        log("SaveWorld will produce empty attributes for these Blueprints.")
        log("Run 'set-savegame' to fix, or use manual WritableObject approach.")
    elif with_flag > 0:
        log(f"SaveGame flags found on {with_flag}/{total_vars} variables.")
        log("SaveWorld should work for flagged properties.")

    return 0



def cmd_set_savegame(bp_path, var_name, enable):
    """Set or clear the SaveGame flag on a specific BP variable.

    NOTE: UE's Python API does not expose a reliable setter for the SaveGame
    property flag (set_property_flags and set_editor_property(:SaveGame) don't
    exist). This command tries multiple approaches and reports honestly if none
    work. In that case, the user must set the flag manually in the editor.

    Args:
        bp_path: Asset path like "/Game/Characters/BP_CharacterBase"
        var_name: Variable name like "HealthCurrent"
        enable: True to set SaveGame, False to clear it
    """
    log(f"Engine version: {get_engine_version()}")
    _detect_plugin()
    log(f"{'Setting' if enable else 'Clearing'} SaveGame flag: {bp_path} -> {var_name}")

    # Load the BP asset
    try:
        bp_asset = unreal.EditorAssetLibrary.load_asset(bp_path)
        if bp_asset is None:
            log(f"ERROR: Could not load Blueprint at '{bp_path}'")
            return 1
    except Exception as e:
        log(f"ERROR: Failed to load '{bp_path}': {e}")
        return 1

    # Get the generated class and CDO
    bp_class = None
    try:
        bp_class = bp_asset.generated_class()
    except Exception:
        pass
    if bp_class is None:
        try:
            bp_class = bp_asset.get_editor_property("generated_class")
        except Exception:
            pass
    if bp_class is None:
        try:
            bp_class = unreal.load_object(None, bp_path + "_C")
        except Exception as e:
            log(f"ERROR: Could not get generated class for '{bp_path}': {e}")
            return 1
    if bp_class is None:
        log(f"ERROR: Generated class is None for '{bp_path}'")
        return 1

    cdo = None
    try:
        cdo = unreal.get_default_object(bp_class)
    except Exception:
        pass

    # Verify the variable exists on this BP
    try:
        val = cdo.get_editor_property(var_name)
        log(f"Found variable '{var_name}' (type: {type(val).__name__})")
    except Exception:
        log(f"ERROR: Variable '{var_name}' not found on '{bp_path}'")
        # List available variables using .uasset scanning
        candidates = _extract_candidate_names_from_uasset(bp_path)
        if candidates and cdo is not None:
            verified = []
            for name in sorted(candidates):
                try:
                    v = cdo.get_editor_property(name)
                    verified.append(f"  - {name} ({type(v).__name__})")
                except Exception:
                    pass
            if verified:
                log("Available BP variables:")
                for line in verified[:30]:
                    log(line)
        return 1

    # Try to set the SaveGame flag
    success = False

    # Approach 0: Use C++ plugin (most reliable)
    if _PLUGIN is not None:
        try:
            ok = _PLUGIN.set_save_game_flag(bp_asset, var_name, enable)
            if ok:
                log(f"{'Set' if enable else 'Cleared'} SaveGame flag via C++ plugin")
                return 0
            else:
                log(f"ERROR: C++ plugin could not find variable '{var_name}'")
                return 1
        except Exception as e:
            log(f"  C++ plugin set_save_game_flag failed: {e}")

    # Approach 1: find_property_by_name + set_property_flags
    for obj in [bp_class, cdo]:
        if success:
            break
        try:
            if hasattr(obj, "find_property_by_name"):
                prop = obj.find_property_by_name(var_name)
                if prop and hasattr(prop, "set_property_flags"):
                    current_flags = prop.get_property_flags() if hasattr(prop, "get_property_flags") else 0
                    CPF_SAVE_GAME = 0x00010000
                    new_flags = (current_flags | CPF_SAVE_GAME) if enable else (current_flags & ~CPF_SAVE_GAME)
                    prop.set_property_flags(new_flags)
                    log(f"{'Set' if enable else 'Cleared'} SaveGame flag via set_property_flags")
                    success = True
        except Exception as e:
            log(f"  set_property_flags approach failed: {e}")

    # Approach 2: NewVariables attribute access (if exposed)
    if not success:
        try:
            nv = getattr(bp_asset, "new_variables", None)
            if nv is not None:
                for var_desc in nv:
                    try:
                        vn = str(var_desc.get_editor_property("var_name"))
                        if vn == var_name:
                            flags = int(var_desc.get_editor_property("property_flags"))
                            CPF_SAVE_GAME = 0x00010000
                            new_flags = (flags | CPF_SAVE_GAME) if enable else (flags & ~CPF_SAVE_GAME)
                            var_desc.set_editor_property("property_flags", new_flags)
                            log(f"{'Set' if enable else 'Cleared'} SaveGame flag via NewVariables")
                            success = True
                            break
                    except Exception:
                        pass
        except Exception as e:
            log(f"  NewVariables approach failed: {e}")

    # Approach 3: BlueprintEditorLibrary (if a set_blueprint_variable_save_game exists)
    if not success:
        try:
            bel = unreal.BlueprintEditorLibrary
            if hasattr(bel, "set_blueprint_variable_save_game"):
                bel.set_blueprint_variable_save_game(bp_asset, var_name, enable)
                log(f"{'Set' if enable else 'Cleared'} SaveGame flag via BlueprintEditorLibrary")
                success = True
        except Exception as e:
            log(f"  BlueprintEditorLibrary approach failed: {e}")

    if not success:
        log("")
        log(f"ERROR: Could not set SaveGame flag programmatically on UE {get_engine_version()}.")
        log("The UE Python API does not expose a SaveGame flag setter.")
        log("")
        log("MANUAL FIX (takes ~10 seconds per variable):")
        log(f"  1. Open '{bp_path}' in the Blueprint Editor")
        log(f"  2. Select variable '{var_name}' in the My Blueprint panel")
        log(f"  3. In the Details panel, check the 'SaveGame' checkbox")
        log(f"  4. Compile and Save the Blueprint")
        return 1

    # Save the asset
    try:
        unreal.EditorAssetLibrary.save_asset(bp_path)
        log(f"Saved: {bp_path}")
    except Exception as e:
        log(f"ERROR: Failed to save '{bp_path}': {e}")
        log("The flag may have been set in memory but NOT saved to disk.")
        return 1

    # Verify
    verified = _check_save_game_flag(bp_class, bp_asset, cdo, var_name)
    if verified == enable:
        log(f"Verification: SaveGame flag is {'SET' if verified else 'NOT SET'} ✓")
    else:
        log("WARNING: Could not verify flag state after save.")

    log("Done.")
    return 0


def cmd_set_savegame_batch(pairs):
    """Set the SaveGame flag on multiple BP variables in one editor session.

    Args:
        pairs: list of (bp_path, var_name) tuples. All are set to enabled=True.
    """
    log(f"Engine version: {get_engine_version()}")
    _detect_plugin()
    log(f"Project: {get_project_name()}")

    if _PLUGIN is None:
        log("ERROR: set-savegame-batch requires the LudeoBPInspector C++ plugin.")
        log("Deploy the plugin first (Stage 0 step 6), then retry.")
        return 1

    log(f"Batch SaveGame flag set: {len(pairs)} variable(s)")

    # Group pairs by blueprint path to avoid reloading the same BP
    from collections import OrderedDict
    grouped = OrderedDict()
    for bp_path, var_name in pairs:
        grouped.setdefault(bp_path, []).append(var_name)

    total = len(pairs)
    success_count = 0
    fail_count = 0

    for bp_path, var_names in grouped.items():
        log(f"Loading: {bp_path} ({len(var_names)} variable(s))")

        try:
            bp_asset = unreal.EditorAssetLibrary.load_asset(bp_path)
            if bp_asset is None:
                log(f"  ERROR: Could not load Blueprint at '{bp_path}'")
                fail_count += len(var_names)
                continue
        except Exception as e:
            log(f"  ERROR: Failed to load '{bp_path}': {e}")
            fail_count += len(var_names)
            continue

        for var_name in var_names:
            try:
                ok = _PLUGIN.set_save_game_flag(bp_asset, var_name, True)
                if ok:
                    log(f"  {var_name}: SaveGame flag SET")
                    success_count += 1
                else:
                    log(f"  {var_name}: ERROR — variable not found")
                    fail_count += 1
            except Exception as e:
                log(f"  {var_name}: ERROR — {e}")
                fail_count += 1

    log("")
    log("=== BATCH SUMMARY ===")
    log(f"Total:     {total}")
    log(f"Succeeded: {success_count}")
    if fail_count > 0:
        log(f"Failed:    {fail_count}")
    log("")

    return 0 if fail_count == 0 else 1


def cmd_graph():
    """Scan all gameplay BPs for functions, events, and call graphs."""
    log(f"Engine version: {get_engine_version()}")
    _detect_plugin()
    log(f"Project: {get_project_name()}")

    if _PLUGIN is None:
        log("ERROR: graph command requires the LudeoBPInspector C++ plugin.")
        log("Deploy the plugin first (Stage 0 step 6), then retry.")
        return 1

    log("Starting Blueprint graph inspection...")

    bp_assets = get_all_blueprint_assets()
    results = []
    errors = []

    for asset_data in bp_assets:
        pkg_name = str(asset_data.package_name)

        try:
            bp_asset = unreal.EditorAssetLibrary.load_asset(pkg_name)
            if bp_asset is None:
                continue
        except Exception as e:
            errors.append({"path": pkg_name, "error": str(e)})
            continue

        # Get the generated class to check gameplay relevance
        bp_class = None
        try:
            bp_class = bp_asset.generated_class()
        except (AttributeError, Exception):
            pass
        if bp_class is None:
            try:
                bp_class = bp_asset.get_editor_property("generated_class")
            except (AttributeError, Exception):
                pass
        if bp_class is None:
            try:
                class_path = pkg_name + "." + str(asset_data.asset_name) + "_C"
                bp_class = unreal.load_object(None, class_path)
            except Exception:
                pass

        if bp_class is None or not is_gameplay_relevant(bp_class):
            continue

        functions = _get_functions_via_plugin(bp_asset)
        events = _get_events_via_plugin(bp_asset)

        # Get call graphs for each function and event
        call_graphs = {}
        for func in functions:
            name = func["name"]
            call_graphs[name] = _get_call_graph_via_plugin(bp_asset, name)
        for event in events:
            name = event["name"]
            if name not in call_graphs:
                call_graphs[name] = _get_call_graph_via_plugin(bp_asset, name)

        if not functions and not events:
            continue

        entry = {
            "path": pkg_name,
            "functions": functions,
            "events": events,
            "callGraphs": call_graphs,
        }
        results.append(entry)

        log(f"  {pkg_name}: {len(functions)} functions, {len(events)} events")

    # Build report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project": get_project_name(),
        "engineVersion": get_engine_version(),
        "blueprints": results,
        "errors": errors,
        "summary": {
            "bpsScanned": len(bp_assets),
            "gameplayBpsWithGraphs": len(results),
            "totalFunctions": sum(len(r["functions"]) for r in results),
            "totalEvents": sum(len(r["events"]) for r in results),
        },
    }

    # Write to .ludeo/bp-graph-report.json
    ludeo_dir = find_ludeo_dir()
    if ludeo_dir:
        report_path = os.path.join(ludeo_dir, "bp-graph-report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        log(f"Report written to: {report_path}")
    else:
        log("WARNING: Could not find .ludeo/ directory. Printing report to stdout.")
        print(json.dumps(report, indent=2))

    log("")
    log("=== GRAPH INSPECTION SUMMARY ===")
    log(f"Blueprints scanned:       {len(bp_assets)}")
    log(f"Gameplay BPs with graphs: {len(results)}")
    log(f"Total functions:          {report['summary']['totalFunctions']}")
    log(f"Total events:             {report['summary']['totalEvents']}")
    if errors:
        log(f"Errors:                   {len(errors)}")
    log("")

    return 0


def cmd_graph_function(bp_path, function_name):
    """Get the call graph for a single function/event in one BP."""
    log(f"Engine version: {get_engine_version()}")
    _detect_plugin()
    log(f"Project: {get_project_name()}")

    if _PLUGIN is None:
        log("ERROR: graph-function command requires the LudeoBPInspector C++ plugin.")
        log("Deploy the plugin first (Stage 0 step 6), then retry.")
        return 1

    log(f"Getting call graph: {bp_path} -> {function_name}")

    try:
        bp_asset = unreal.EditorAssetLibrary.load_asset(bp_path)
        if bp_asset is None:
            log(f"ERROR: Could not load Blueprint at '{bp_path}'")
            return 1
    except Exception as e:
        log(f"ERROR: Failed to load '{bp_path}': {e}")
        return 1

    functions = _get_functions_via_plugin(bp_asset)
    events = _get_events_via_plugin(bp_asset)
    call_graph = _get_call_graph_via_plugin(bp_asset, function_name)

    if not call_graph:
        log(f"WARNING: No call graph found for '{function_name}' in '{bp_path}'")
        log("Available functions/events:")
        for f in functions:
            log(f"  [func] {f['name']}")
        for e in events:
            tag = "custom-event" if e["isCustomEvent"] else "event"
            log(f"  [{tag}] {e['name']}")
        return 1

    log(f"Call graph for '{function_name}' ({len(call_graph)} nodes):")
    for node in call_graph:
        called = f" -> {node['calledFunction']}" if node['calledFunction'] and node['calledFunction'] != 'None' else ""
        log(f"  [{node['nodeIndex']}] {node['nodeTitle']}{called}")

    log("")
    log("Done.")
    return 0


def _full_dump_bp(path, resolve_inherited=False):
    """Full structural dump of one Blueprint by path, ignoring the gameplay filter.
    Includes parent, variables (with default values + SaveGame flag), components,
    functions, and events. Requires the LudeoBPInspector C++ plugin for full fidelity."""
    a = unreal.EditorAssetLibrary.load_asset(path)
    if a is None:
        log(f"ERROR: Could not load Blueprint at '{path}'")
        return {"path": path, "error": "load failed"}
    out = {"path": path}
    if _PLUGIN is not None:
        try:
            out["parent"] = str(_PLUGIN.get_parent_class_name(a))
        except Exception as e:
            out["parent"] = "err:" + str(e)
        try:
            out["variables"] = [{
                "name": str(i.get_editor_property("var_name")),
                "type": str(i.get_editor_property("var_type")),
                "saveGame": bool(i.get_editor_property("save_game")),
                "default": str(i.get_editor_property("default_value")),
            } for i in _PLUGIN.list_blueprint_variables(a)]
        except Exception as e:
            out["variables"] = "err:" + str(e)
        try:
            out["components"] = _get_components_via_plugin(a)
        except Exception as e:
            out["components"] = "err:" + str(e)
        try:
            out["functions"] = [f["name"] for f in _get_functions_via_plugin(a)]
        except Exception as e:
            out["functions"] = "err:" + str(e)
        try:
            out["events"] = [e2["name"] for e2 in _get_events_via_plugin(a)]
        except Exception as e:
            out["events"] = "err:" + str(e)
    else:
        out["parent"] = get_native_parent_name(a.generated_class()) if a.generated_class() else "Unknown"
        out["variables"] = get_bp_variables(a, package_name=path)
        out["note"] = "plugin not available — functions/events/components/defaults unavailable"
    if resolve_inherited:
        try:
            leaf_class = a.generated_class()
        except Exception:
            leaf_class = None
        out["parentChain"] = _bp_class_chain(leaf_class) if leaf_class else []
        out["inheritedVariables"] = _inherited_bp_variables(leaf_class)
    return out


def _safe_get_prop(actor, name):
    """Read an editor property off a live actor, returning None on failure.
    Used by the level-inspection command to read per-actor BP variable values."""
    try:
        return actor.get_editor_property(name)
    except Exception:
        return None


def cmd_inspect_path(paths, resolve_inherited=False):
    """Inspect arbitrary BPs by path (no gameplay filter). Writes path-inspection.json.

    Use for plain-Actor BPs (weapons, spawners, AI managers, pickups) that the
    gameplay-class filter in `inspect` deliberately excludes."""
    _detect_plugin()
    results = [_full_dump_bp(p, resolve_inherited) for p in paths]
    ludeo_dir = find_ludeo_dir()
    if ludeo_dir:
        out_path = os.path.join(ludeo_dir, "path-inspection.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        log(f"Report written to: {out_path}")
    else:
        log("WARNING: Could not find .ludeo/ directory. Printing report to stdout.")
        print(json.dumps(results, indent=2))
    for r in results:
        nv = len(r["variables"]) if isinstance(r.get("variables"), list) else "ERR"
        nf = len(r["functions"]) if isinstance(r.get("functions"), list) else "ERR"
        log(f"  {r['path']}: parent={r.get('parent')} vars={nv} funcs={nf}")
    return 0


def _focus_actor_props(act):
    """Dump all BP-defined variables (and their current values) for a placed actor,
    game-agnostically, via the plugin. Returns {} if the class is native or the
    plugin is unavailable."""
    props = {}
    if _PLUGIN is None:
        _detect_plugin()
    if _PLUGIN is None:
        return props
    try:
        cls = act.get_class()
        class_path = cls.get_path_name()          # e.g. /Game/AI/BP_Spawner.BP_Spawner_C
        asset_path = class_path.split(".")[0]     # -> /Game/AI/BP_Spawner
        bp_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
        if bp_asset is None:
            return props
        for v in _PLUGIN.list_blueprint_variables(bp_asset):
            name = str(v.get_editor_property("var_name"))
            val = _safe_get_prop(act, name)
            if val is not None:
                sval = str(val)
                if len(sval) > 400:
                    sval = sval[:400] + "...(truncated)"
                props[name] = sval
    except Exception:
        pass
    return props


def cmd_inspect_level(level_path, focus_substrings=None):
    """Load a map and enumerate placed actors. Groups by class; for spawner/AI actors
    dumps their BP-defined properties + current values. Writes level-inspection.json.

    Answers 'what is actually placed/spawned in this level' — reaches level-instance
    actors that asset-only inspection cannot see. Property dumping is game-agnostic
    (per-actor BP variable reflection), not a hardcoded variable allowlist."""
    _detect_plugin()
    focus = [s.lower() for s in (focus_substrings or
             ["spawn", "ai", "zombie", "enemy", "boss", "creature", "monster",
              "npc", "storage", "horde", "wave", "manager", "director", "encounter"])]
    log(f"Loading map: {level_path}")
    try:
        unreal.EditorLoadingAndSavingUtils.load_map(level_path)
    except Exception as e:
        log(f"ERROR: load_map failed: {e}")
        return 1

    actors = []
    try:
        sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        actors = list(sub.get_all_level_actors())
    except Exception:
        try:
            actors = list(unreal.EditorLevelLibrary.get_all_level_actors())
        except Exception as e:
            log(f"ERROR: could not enumerate actors: {e}")
            return 1

    histogram = {}
    focus_actors = []
    for act in actors:
        try:
            cls = act.get_class().get_name()
        except Exception:
            cls = "Unknown"
        histogram[cls] = histogram.get(cls, 0) + 1
        cls_l = cls.lower()
        if any(s in cls_l for s in focus):
            entry = {"class": cls, "name": str(act.get_name())}
            try:
                loc = act.get_actor_location()
                entry["location"] = [round(loc.x, 1), round(loc.y, 1), round(loc.z, 1)]
            except Exception:
                pass
            props = _focus_actor_props(act)
            if props:
                entry["bpProps"] = props
            focus_actors.append(entry)

    report = {
        "level": level_path,
        "totalActors": len(actors),
        "classHistogram": dict(sorted(histogram.items(), key=lambda kv: -kv[1])),
        "focusActors": focus_actors,
    }
    ludeo_dir = find_ludeo_dir()
    if ludeo_dir:
        out_path = os.path.join(ludeo_dir, "level-inspection.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        log(f"Report written to: {out_path}")
    else:
        log("WARNING: Could not find .ludeo/ directory. Printing report to stdout.")
        print(json.dumps(report, indent=2))
    log(f"  Total actors: {len(actors)}; focus actors: {len(focus_actors)}")
    log("  Top classes:")
    for cls, n in list(report["classHistogram"].items())[:30]:
        log(f"    {n:4d}  {cls}")
    return 0


def _bp_class_chain(leaf_class):
    """Walk leaf -> root; return ordered list of class path names (leaf first). Stops at the
    first native (/Script/) class, which is included.

    Walks the serialized ParentClass reference asset-by-asset — the same reliable source the
    C++ GetParentClassName uses (BP->ParentClass) — and only falls back to
    get_super_class() when the asset/parent can't be resolved. The pure get_super_class()
    walk collapsed to the native root on BP-of-BP chains when a BP parent's generated class
    was not loaded (observed twice: chain returned only the leaf, inheritedVariables ==
    own variables, parent reported as the native root). See skill-feedback item #14.
    NOTE: needs in-engine validation on a BP-parented-by-BP chain before fully trusted."""
    chain = []
    cur = leaf_class
    for _ in range(50):
        if cur is None:
            break
        try:
            p = cur.get_path_name()
        except Exception:
            break
        chain.append(p)
        if p.startswith("/Script/"):
            break
        # Prefer the serialized ParentClass off the BP asset (reliable across BP-of-BP);
        # fall back to get_super_class() only if that can't be resolved.
        nxt = None
        try:
            asset_path = p.split(".")[0]  # /Game/AI/BP_Foo.BP_Foo_C -> /Game/AI/BP_Foo
            bp_asset = unreal.EditorAssetLibrary.load_asset(asset_path)
            if bp_asset is not None:
                nxt = bp_asset.get_editor_property("parent_class")
        except Exception:
            nxt = None
        if nxt is None:
            try:
                nxt = cur.get_super_class()
            except Exception:
                nxt = None
        if nxt is cur:  # guard against a self-referential parent loop
            break
        cur = nxt
    return chain


def _inherited_bp_variables(leaf_class):
    """Variables declared on the leaf BP AND each BP ancestor, tagged with the
    declaring class. Walks the super chain; for each BP ancestor (a /Game/... class)
    loads its asset and lists its declared variables via the plugin."""
    out = []
    if leaf_class is None or _PLUGIN is None:
        return out
    for class_path in _bp_class_chain(leaf_class):
        if class_path.startswith("/Script/"):
            continue  # native parent: no BP-declared variables to enumerate
        asset_path = class_path.split(".")[0]  # /Game/AI/BP_Foo.BP_Foo_C -> /Game/AI/BP_Foo
        anc = unreal.EditorAssetLibrary.load_asset(asset_path)
        if anc is None:
            continue
        try:
            for v in _PLUGIN.list_blueprint_variables(anc):
                out.append({
                    "name": str(v.get_editor_property("var_name")),
                    "type": str(v.get_editor_property("var_type")),
                    "saveGame": bool(v.get_editor_property("save_game")),
                    "default": str(v.get_editor_property("default_value")),
                    "declaredIn": asset_path,
                })
        except Exception:
            continue
    return out


def cmd_inspect_func_sigs(paths):
    """Dump function input/output pin signatures for specific BPs by path.
    Fills the gap that 'graph-function' (node titles) and 'inspect' (var-focused)
    leave: the exact input/output pins of a BP function — needed when you must call
    a game function (e.g. an inventory AddItem) and need its parameter signature.
    Writes func-sigs.json. Requires the LudeoBPInspector C++ plugin."""
    _detect_plugin()
    if _PLUGIN is None:
        log("ERROR: inspect-func-sigs requires the LudeoBPInspector C++ plugin.")
        log("Deploy the plugin first (Stage 0 step 6), then retry.")
        return 1
    out = {}
    for path in paths:
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if asset is None:
            log(f"ERROR: Could not load Blueprint at '{path}'")
            out[path] = {"error": "load failed"}
            continue
        rows = []
        try:
            for info in _PLUGIN.list_blueprint_functions(asset):
                rows.append({
                    "name": str(info.get_editor_property("function_name")),
                    "in": [str(p) for p in info.get_editor_property("input_pins")],
                    "out": [str(p) for p in info.get_editor_property("output_pins")],
                })
        except Exception as e:
            rows = "err:" + str(e)
        out[path] = rows
        log(f"=== {path.split('/')[-1]}")
        if isinstance(rows, list):
            for r in rows:
                log(f"  {r['name']}  IN={r['in']}  OUT={r['out']}")
        else:
            log(f"  {rows}")
    ludeo_dir = find_ludeo_dir()
    if ludeo_dir:
        out_path = os.path.join(ludeo_dir, "func-sigs.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2)
        log(f"Report written to: {out_path}")
    else:
        log("WARNING: Could not find .ludeo/ directory. Printing report to stdout.")
        print(json.dumps(out, indent=2))
    return 0


# ============================================================
# Main Entry Point
# ============================================================

def main():
    """Parse arguments and dispatch to the appropriate command."""
    _open_log_file()

    # UE's -ExecutePythonScript does NOT populate sys.argv reliably.
    # Arguments passed via -PythonArg= must be extracted from the full UE command line.
    args = sys.argv[1:]  # Try sys.argv first (works in some UE versions)

    if not args:
        # Fallback: parse -PythonArg= from UE's full command line
        try:
            import re
            cmd_line = unreal.SystemLibrary.get_command_line()
            # Extract all -PythonArg="value" or -PythonArg=value tokens
            args = re.findall(r'-PythonArg="?([^"\s]+)"?', cmd_line)
            if args:
                log(f"Parsed args from UE command line: {args}")
        except Exception as e:
            log(f"Warning: Could not parse UE command line: {e}")

    if not args:
        log("Usage:")
        log("  bp_inspector.py inspect")
        log("  bp_inspector.py set-savegame <bp_path> <variable_name> <true|false>")
        log("  bp_inspector.py set-savegame-batch <bp1> <var1> <bp2> <var2> ...")
        log("  bp_inspector.py graph")
        log("  bp_inspector.py graph-function <bp_path> <function_name>")
        log("  bp_inspector.py inspect-path [--resolve-inherited] <bp_path> [<bp_path> ...]")
        log("  bp_inspector.py inspect-level <map_path> [<focus_keyword> ...]")
        log("  bp_inspector.py inspect-func-sigs <bp_path> [<bp_path> ...]")
        log("")
        log("Examples:")
        log("  bp_inspector.py inspect")
        log("  bp_inspector.py set-savegame /Game/Characters/BP_CharacterBase HealthCurrent true")
        log("  bp_inspector.py set-savegame-batch /Game/BP_Char Health /Game/BP_Char Ammo /Game/BP_Weapon Damage")
        log("  bp_inspector.py graph")
        log("  bp_inspector.py graph-function /Game/Blueprints/BP_Player ReceiveBeginPlay")
        log("  bp_inspector.py inspect-path /Game/Blueprints/BP_Spawner /Game/Blueprints/BP_Weapon")
        log("  bp_inspector.py inspect-path --resolve-inherited /Game/Blueprints/BP_Boss")
        log("  bp_inspector.py inspect-level /Game/Maps/MyArena")
        log("  bp_inspector.py inspect-func-sigs /Game/Blueprints/BP_Inventory /Game/Blueprints/BP_Boss")
        _close_log_file()
        sys.exit(1)

    command = args[0].lower()

    if command == "inspect":
        exit_code = cmd_inspect()
        _close_log_file()
        sys.exit(exit_code)

    elif command == "set-savegame":
        if len(args) < 4:
            log("ERROR: set-savegame requires 3 arguments: <bp_path> <variable_name> <true|false>")
            log("Example: bp_inspector.py set-savegame /Game/Characters/BP_CharacterBase HealthCurrent true")
            _close_log_file()
            sys.exit(1)

        bp_path = args[1]
        var_name = args[2]
        enable = args[3].lower() in ("true", "1", "yes")

        exit_code = cmd_set_savegame(bp_path, var_name, enable)
        _close_log_file()
        sys.exit(exit_code)

    elif command == "set-savegame-batch":
        remaining = args[1:]
        if len(remaining) < 2 or len(remaining) % 2 != 0:
            log("ERROR: set-savegame-batch requires pairs of arguments: <bp_path> <var_name> ...")
            log("Example: bp_inspector.py set-savegame-batch /Game/BP_Char Health /Game/BP_Char Ammo")
            _close_log_file()
            sys.exit(1)

        pairs = [(remaining[i], remaining[i + 1]) for i in range(0, len(remaining), 2)]
        exit_code = cmd_set_savegame_batch(pairs)
        _close_log_file()
        sys.exit(exit_code)

    elif command == "graph":
        exit_code = cmd_graph()
        _close_log_file()
        sys.exit(exit_code)

    elif command == "graph-function":
        if len(args) < 3:
            log("ERROR: graph-function requires 2 arguments: <bp_path> <function_name>")
            log("Example: bp_inspector.py graph-function /Game/Blueprints/BP_Player ReceiveBeginPlay")
            _close_log_file()
            sys.exit(1)

        bp_path = args[1]
        function_name = args[2]
        exit_code = cmd_graph_function(bp_path, function_name)
        _close_log_file()
        sys.exit(exit_code)

    elif command == "inspect-path":
        rest = args[1:]
        resolve_inherited = "--resolve-inherited" in rest
        paths = [a for a in rest if a != "--resolve-inherited"]
        if not paths:
            log("ERROR: inspect-path requires at least one BP path")
            log("Example: bp_inspector.py inspect-path [--resolve-inherited] /Game/Blueprints/BP_Spawner")
            _close_log_file()
            sys.exit(1)
        exit_code = cmd_inspect_path(paths, resolve_inherited)
        _close_log_file()
        sys.exit(exit_code)

    elif command == "inspect-level":
        if len(args) < 2:
            log("ERROR: inspect-level requires a level path")
            log("Example: bp_inspector.py inspect-level /Game/Maps/MyArena")
            _close_log_file()
            sys.exit(1)
        exit_code = cmd_inspect_level(args[1], args[2:] if len(args) > 2 else None)
        _close_log_file()
        sys.exit(exit_code)

    elif command == "inspect-func-sigs":
        if len(args) < 2:
            log("ERROR: inspect-func-sigs requires at least one BP path")
            log("Example: bp_inspector.py inspect-func-sigs /Game/Blueprints/BP_Inventory")
            _close_log_file()
            sys.exit(1)
        exit_code = cmd_inspect_func_sigs(args[1:])
        _close_log_file()
        sys.exit(exit_code)

    else:
        log(f"ERROR: Unknown command '{command}'")
        log("Valid commands: inspect, set-savegame, set-savegame-batch, graph, graph-function, inspect-path, inspect-level, inspect-func-sigs")
        _close_log_file()
        sys.exit(1)


# Run
main()
