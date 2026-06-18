// Copyright Ludeo 2026.
#pragma once

#include "Commandlets/Commandlet.h"
#include "LudeoDumpKismetCommandlet.generated.h"

/**
 * Offline all-maps Blueprint bytecode dump for Ludeo integration analysis.
 *
 * Loads every map under /Game (or a filtered subset), including classic
 * streaming sublevels, disassembles each level-script class (plus optional
 * extra gameplay BP classes), and writes per-class analysis artifacts:
 * disassembled bytecode, bound-event inventory, and variable list. Also
 * writes per-map _PlacedActorBindings.txt — the serialized delegate
 * invocation lists of placed actors, which statically resolve which delegate
 * PROPERTY each BndEvt__ stub binds (stub names only carry the signature).
 *
 * Usage:
 *   UE4Editor-Cmd.exe <Project>.uproject -run=LudeoDumpKismet
 *       [-Maps=Sub1,Sub2]      substring filter on map package names
 *       [-Classes=Sub1,Sub2]   also dump any loaded BPGC whose name matches
 *       [-OutDir=<path>]       default <ProjectSaved>/LudeoKismet/
 *       [-Paths=/Game,/Foo]    content roots to scan (default /Game)
 *       [-AllPaths]            scan every mounted non-engine content root —
 *                              required for GameFeature titles (Lyra-style),
 *                              whose maps mount at /<PluginName>, not /Game
 *
 * Known limitation: UE5 World Partition cells / Level Instances are not
 * walked — the persistent level script still dumps. Classic streaming
 * (UE4 and UE5) is fully covered.
 */
UCLASS()
class ULudeoDumpKismetCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	ULudeoDumpKismetCommandlet();

	virtual int32 Main(const FString& Params) override;
};
