// Copyright Ludeo 2026.
//
// In-game console commands for ad-hoc bytecode / delegate inspection during a
// live session. The offline commandlet (LudeoDumpKismet) is preferred for
// full-coverage dumps; these exist for quick checks without leaving the game.
//
//   LudeoKismet.DisassembleBP <ClassSubstring> [suffix-or-path]
//       Disassemble every UFUNCTION in loaded classes matching the substring.
//
//   LudeoKismet.DumpDelegateBindings <ClassSubstring> [suffix-or-path]
//       For every world actor matching the substring, dump the bound
//       (object, function) invocation list of each multicast delegate
//       property — i.e., "who listens to this actor's events right now".
//       Fully reflection-driven; works on any game's classes.

#include "LudeoKismetDumpUtil.h"

#if LUDEO_KISMETDUMP_ENABLED

#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Actor.h"
#include "HAL/IConsoleManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "ScriptDisassembler.h"
#include "UObject/Class.h"
#include "UObject/UObjectIterator.h"
#include "UObject/UnrealType.h"

DEFINE_LOG_CATEGORY_STATIC(LogLudeoKismetCheats, Log, All);

namespace
{
	FString ResolveOutPath(const TArray<FString>& Args, int32 ArgIndex, const FString& Fallback, const TCHAR* Prefix)
	{
		const FString Suffix = Args.IsValidIndex(ArgIndex) ? Args[ArgIndex] : Fallback;
		const bool bIsBareName = !Suffix.Contains(TEXT("/"))
			&& !Suffix.Contains(TEXT("\\"))
			&& !Suffix.Contains(TEXT(":"));
		return bIsBareName
			? FPaths::ProjectSavedDir() / FString::Printf(TEXT("%s_%s.txt"), Prefix, *Suffix)
			: Suffix;
	}
}

static FAutoConsoleCommand GLudeoKismetDisassembleBPCmd(
	TEXT("LudeoKismet.DisassembleBP"),
	TEXT("Disassemble Kismet bytecode of every UFUNCTION in loaded classes whose name contains "
	     "the substring (case-insensitive; avoid broad substrings). "
	     "Usage: LudeoKismet.DisassembleBP <ClassSubstring> [suffix-or-path]"),
	FConsoleCommandWithArgsDelegate::CreateLambda(
		[](const TArray<FString>& Args)
		{
			if (Args.Num() < 1)
			{
				UE_LOG(LogLudeoKismetCheats, Warning,
					TEXT("Usage: LudeoKismet.DisassembleBP <ClassSubstring> [suffix-or-path]"));
				return;
			}
			const FString& ClassSubstr = Args[0];

			LudeoKismetDump::FLineEmittingStringOutputDevice Output;
			TSet<FString> Dumped;
			int32 NumClasses = 0;
			for (TObjectIterator<UClass> ClassIt; ClassIt; ++ClassIt)
			{
				UClass* Cls = *ClassIt;
				const FString Name = Cls->GetName();
				if (!Name.Contains(ClassSubstr)) { continue; }
				if (LudeoKismetDump::IsEditorArtifactClass(Name)) { continue; }

				// Inline disassembly to one combined file (the commandlet's
				// per-class artifact layout is overkill for ad-hoc checks).
				Output.Logf(TEXT("Processing class %s"), *Cls->GetPathName());
				FKismetBytecodeDisassembler Disassembler(Output);
				for (TFieldIterator<UFunction> FuncIt(Cls, EFieldIteratorFlags::ExcludeSuper); FuncIt; ++FuncIt)
				{
					Output.Logf(TEXT("  Processing function %s (%d bytes)"), *FuncIt->GetName(), FuncIt->Script.Num());
					Disassembler.DisassembleStructure(*FuncIt);
					Output.Logf(TEXT(""));
				}
				Output.Logf(TEXT("-----------"));
				++NumClasses;
			}

			const FString OutPath = ResolveOutPath(Args, 1, ClassSubstr, TEXT("LudeoKismet"));
			if (FFileHelper::SaveStringToFile(Output.GetString(), *OutPath))
			{
				UE_LOG(LogLudeoKismetCheats, Log, TEXT("DisassembleBP: %d classes, %d chars -> %s"),
					NumClasses, Output.Len(), *OutPath);
			}
			else
			{
				UE_LOG(LogLudeoKismetCheats, Warning, TEXT("DisassembleBP: failed to write %s"), *OutPath);
			}
		}));

static FAutoConsoleCommandWithWorldAndArgs GLudeoKismetDumpDelegateBindingsCmd(
	TEXT("LudeoKismet.DumpDelegateBindings"),
	TEXT("Dump the live invocation list of every multicast delegate property on world actors whose "
	     "class name contains the substring. Shows which objects/functions are bound to each event. "
	     "Usage: LudeoKismet.DumpDelegateBindings <ClassSubstring> [suffix-or-path]"),
	FConsoleCommandWithWorldAndArgsDelegate::CreateLambda(
		[](const TArray<FString>& Args, UWorld* World)
		{
			if (Args.Num() < 1 || !World)
			{
				UE_LOG(LogLudeoKismetCheats, Warning,
					TEXT("Usage: LudeoKismet.DumpDelegateBindings <ClassSubstring> [suffix-or-path]"));
				return;
			}
			const FString& ClassSubstr = Args[0];

			LudeoKismetDump::FLineEmittingStringOutputDevice Output;
			int32 NumActors = 0;
			for (TActorIterator<AActor> It(World); It; ++It)
			{
				AActor* Actor = *It;
				if (!Actor) { continue; }

				bool bMatch = false;
				for (const UClass* C = Actor->GetClass(); C; C = C->GetSuperClass())
				{
					if (C->GetName().Contains(ClassSubstr)) { bMatch = true; break; }
				}
				if (!bMatch) { continue; }
				++NumActors;

				Output.Logf(TEXT("%s (%s)"), *Actor->GetPathName(), *Actor->GetClass()->GetName());
				for (TFieldIterator<FMulticastDelegateProperty> PropIt(Actor->GetClass()); PropIt; ++PropIt)
				{
					const FMulticastDelegateProperty* Prop = *PropIt;
					const FMulticastScriptDelegate* Delegate =
						Prop->GetMulticastDelegate(Prop->ContainerPtrToValuePtr<void>(Actor));
					const FString Bound = (Delegate && Delegate->IsBound())
						? Delegate->ToString<UObject>()
						: TEXT("<Unbound>");
					Output.Logf(TEXT("  %-40s %s"), *Prop->GetName(), *Bound);
				}
				Output.Logf(TEXT(""));
			}

			const FString OutPath = ResolveOutPath(Args, 1, ClassSubstr, TEXT("LudeoDelegateBindings"));
			if (FFileHelper::SaveStringToFile(Output.GetString(), *OutPath))
			{
				UE_LOG(LogLudeoKismetCheats, Log, TEXT("DumpDelegateBindings: %d actors -> %s"), NumActors, *OutPath);
			}
			else
			{
				UE_LOG(LogLudeoKismetCheats, Warning, TEXT("DumpDelegateBindings: failed to write %s"), *OutPath);
			}
		}));

#endif // LUDEO_KISMETDUMP_ENABLED
