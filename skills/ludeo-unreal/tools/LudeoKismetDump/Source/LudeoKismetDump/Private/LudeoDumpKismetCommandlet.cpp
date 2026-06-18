// Copyright Ludeo 2026.
#include "LudeoDumpKismetCommandlet.h"

#include "LudeoKismetDumpUtil.h"

#include "Engine/Level.h"
#include "Engine/LevelScriptActor.h"
#include "Engine/LevelStreaming.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Misc/FileHelper.h"
#include "Misc/EngineVersionComparison.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "UObject/Package.h"
#include "UObject/UObjectHash.h"
#include "UObject/UObjectIterator.h"

#if UE_VERSION_OLDER_THAN(5, 0, 0)
#include "AssetRegistryModule.h"
#else
#include "AssetRegistry/AssetRegistryModule.h"
#endif

DEFINE_LOG_CATEGORY_STATIC(LogLudeoDumpKismet, Log, All);

ULudeoDumpKismetCommandlet::ULudeoDumpKismetCommandlet()
{
	IsClient = false;
	IsServer = false;
	IsEditor = true;
	LogToConsole = true;
}

int32 ULudeoDumpKismetCommandlet::Main(const FString& Params)
{
#if !LUDEO_KISMETDUMP_ENABLED
	UE_LOG(LogLudeoDumpKismet, Error,
		TEXT("LudeoDumpKismet was compiled out (Shipping/Test configuration). Run with a Development editor build."));
	return 1;
#else
	auto ParseListArg = [&Params](const TCHAR* Key, TArray<FString>& Out)
	{
		FString Value;
		if (FParse::Value(*Params, Key, Value))
		{
			Value.ParseIntoArray(Out, TEXT(","), /*CullEmpty=*/true);
		}
	};

	TArray<FString> MapFilters;
	TArray<FString> ClassFilters;
	TArray<FString> ContentPaths;
	ParseListArg(TEXT("Maps="), MapFilters);
	ParseListArg(TEXT("Classes="), ClassFilters);
	ParseListArg(TEXT("Paths="), ContentPaths);

	// GameFeature / content-plugin titles (e.g. Lyra) keep their real maps under
	// plugin mount points (/ShooterMaps, ...), not /Game — a /Game-only scan
	// silently misses them. -AllPaths walks every mounted root that lives under
	// the project directory; engine/marketplace plugin content (sample maps,
	// Fab, Bridge, ...) never holds game mission logic and would only add noise.
	const bool bAllPaths = FParse::Param(*Params, TEXT("AllPaths"));
	if (bAllPaths)
	{
		const FString ProjectDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir());
		TArray<FString> RootPaths;
		FPackageName::QueryRootContentPaths(RootPaths);
		for (const FString& Root : RootPaths)
		{
			FString RootFilename;
			if (!FPackageName::TryConvertLongPackageNameToFilename(Root, RootFilename)) { continue; }
			if (!FPaths::ConvertRelativePathToFull(RootFilename).StartsWith(ProjectDir)) { continue; }
			ContentPaths.AddUnique(Root.LeftChop(Root.EndsWith(TEXT("/")) ? 1 : 0));
		}
	}
	if (ContentPaths.Num() == 0)
	{
		ContentPaths.Add(TEXT("/Game"));
	}

	FString OutDir;
	if (!FParse::Value(*Params, TEXT("OutDir="), OutDir))
	{
		OutDir = FPaths::ProjectSavedDir() / TEXT("LudeoKismet");
	}

	// --- Discover all /Game world assets ---
	FAssetRegistryModule& AssetRegistryModule =
		FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
	IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();
	AssetRegistry.SearchAllAssets(/*bSynchronousSearch=*/true);

	FARFilter Filter;
#if UE_VERSION_OLDER_THAN(5, 1, 0)
	Filter.ClassNames.Add(UWorld::StaticClass()->GetFName());
#else
	Filter.ClassPaths.Add(UWorld::StaticClass()->GetClassPathName());
#endif
	for (const FString& ContentPath : ContentPaths)
	{
		Filter.PackagePaths.Add(*ContentPath);
	}
	Filter.bRecursivePaths = true;

	TArray<FAssetData> WorldAssets;
	AssetRegistry.GetAssets(Filter, WorldAssets);

	UE_LOG(LogLudeoDumpKismet, Log, TEXT("Found %d world assets under %s (map filters: %s)"),
		WorldAssets.Num(), *FString::Join(ContentPaths, TEXT("+")),
		MapFilters.Num() ? *FString::Join(MapFilters, TEXT(",")) : TEXT("<none — dumping all>"));

	TSet<FString> DumpedClassPaths;
	int32 MapsProcessed = 0;
	int32 ClassesDumped = 0;

	for (const FAssetData& Asset : WorldAssets)
	{
		const FString PackageName = Asset.PackageName.ToString();

		if (MapFilters.Num() > 0)
		{
			bool bMatch = false;
			for (const FString& Sub : MapFilters)
			{
				if (PackageName.Contains(Sub)) { bMatch = true; break; }
			}
			if (!bMatch) { continue; }
		}

		UPackage* Pkg = LoadPackage(nullptr, *PackageName, LOAD_None);
		if (!Pkg)
		{
			UE_LOG(LogLudeoDumpKismet, Warning, TEXT("Failed to load map package %s — skipping"), *PackageName);
			continue;
		}

		UWorld* World = UWorld::FindWorldInPackage(Pkg);
		if (!World)
		{
			UE_LOG(LogLudeoDumpKismet, Verbose, TEXT("No UWorld in %s — skipping"), *PackageName);
			continue;
		}

		const FString MapShortName = FPackageName::GetShortName(PackageName);
		const FString MapOutDir = OutDir / MapShortName;
		UE_LOG(LogLudeoDumpKismet, Log, TEXT("=== %s ==="), *MapShortName);

		// Persistent level package + every classic streaming sublevel package.
		// Sublevels matter: gameplay scripting level scripts commonly live in a
		// dedicated scripting sublevel, not the persistent map.
		TArray<UPackage*> LevelPackages;
		LevelPackages.Add(Pkg);
		for (ULevelStreaming* Streaming : World->GetStreamingLevels())
		{
			if (!Streaming) { continue; }
			const FString SubPackageName = Streaming->GetWorldAssetPackageName();
			if (UPackage* SubPkg = LoadPackage(nullptr, *SubPackageName, LOAD_None))
			{
				LevelPackages.Add(SubPkg);
			}
			else
			{
				UE_LOG(LogLudeoDumpKismet, Warning, TEXT("  Failed to load sublevel %s"), *SubPackageName);
			}
		}

		// Per-map placed-actor delegate bindings. Level-script bound events
		// (the BndEvt__ stubs) are NOT bound in bytecode or on the BPGC — the
		// editor adds them to the placed actor instance, and the binding is
		// serialized into the map. The stub name only carries the delegate
		// SIGNATURE (OnActivated/OnCompleted-style pairs share one), so this
		// file is the static source of truth for which delegate PROPERTY each
		// handler listens to.
		{
			LudeoKismetDump::FLineEmittingStringOutputDevice Bindings;
			int32 BoundActors = 0;
			for (UPackage* LevelPkg : LevelPackages)
			{
				const UWorld* LevelWorld = UWorld::FindWorldInPackage(LevelPkg);
				if (!LevelWorld || !LevelWorld->PersistentLevel) { continue; }
				for (AActor* Actor : LevelWorld->PersistentLevel->Actors)
				{
					if (!Actor) { continue; }
					bool bWroteHeader = false;
					for (TFieldIterator<FMulticastDelegateProperty> PropIt(Actor->GetClass()); PropIt; ++PropIt)
					{
						const FMulticastScriptDelegate* Delegate =
							PropIt->GetMulticastDelegate(PropIt->ContainerPtrToValuePtr<void>(Actor));
						if (!Delegate || !Delegate->IsBound()) { continue; }
						if (!bWroteHeader)
						{
							Bindings.Logf(TEXT("%s (%s)"), *Actor->GetName(), *Actor->GetClass()->GetName());
							bWroteHeader = true;
							++BoundActors;
						}
						Bindings.Logf(TEXT("  %-50s %s"), *PropIt->GetName(), *Delegate->ToString<UObject>());
					}
				}
			}
			if (BoundActors > 0)
			{
				const FString BindingsPath = MapOutDir / TEXT("_PlacedActorBindings.txt");
				FFileHelper::SaveStringToFile(Bindings.GetString(), *BindingsPath);
				UE_LOG(LogLudeoDumpKismet, Log, TEXT("  %d placed actors with serialized delegate bindings -> %s"),
					BoundActors, *BindingsPath);
			}
		}

		// Level-script classes in each level package.
		for (UPackage* LevelPkg : LevelPackages)
		{
			TArray<UObject*> Objects;
			GetObjectsWithOuter(LevelPkg, Objects, /*bIncludeNestedObjects=*/false);
			for (UObject* Obj : Objects)
			{
				UClass* Cls = Cast<UClass>(Obj);
				if (!Cls || !Cls->IsChildOf(ALevelScriptActor::StaticClass())) { continue; }
				if (LudeoKismetDump::IsEditorArtifactClass(Cls->GetName())) { continue; }
				if (LudeoKismetDump::DumpClassArtifacts(Cls, MapOutDir, DumpedClassPaths)) { ++ClassesDumped; }
			}
		}

		// Optional extra classes: any BPGC loaded by this map whose name
		// matches a -Classes= substring (gameplay actors referenced by the
		// map load as dependencies, so they're in memory here).
		if (ClassFilters.Num() > 0)
		{
			for (TObjectIterator<UClass> ClassIt; ClassIt; ++ClassIt)
			{
				UClass* Cls = *ClassIt;
				const FString Name = Cls->GetName();
				if (LudeoKismetDump::IsEditorArtifactClass(Name)) { continue; }
				bool bMatch = false;
				for (const FString& Sub : ClassFilters)
				{
					if (Name.Contains(Sub)) { bMatch = true; break; }
				}
				if (bMatch && LudeoKismetDump::DumpClassArtifacts(Cls, MapOutDir, DumpedClassPaths)) { ++ClassesDumped; }
			}
		}

		++MapsProcessed;

		// Release the loaded map before the next one so memory stays flat.
		CollectGarbage(RF_NoFlags);
	}

	UE_LOG(LogLudeoDumpKismet, Log, TEXT("Done: %d maps processed, %d classes dumped, output under %s"),
		MapsProcessed, ClassesDumped, *FPaths::ConvertRelativePathToFull(OutDir));
	return 0;
#endif // LUDEO_KISMETDUMP_ENABLED
}
