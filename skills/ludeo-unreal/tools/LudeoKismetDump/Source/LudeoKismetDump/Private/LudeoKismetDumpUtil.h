// Copyright Ludeo 2026.
#pragma once

#include "CoreMinimal.h"

#if LUDEO_KISMETDUMP_ENABLED

#include "Misc/EngineVersionComparison.h"
#if !UE_VERSION_OLDER_THAN(5, 7, 0)
// 5.7 moved FStringOutputDevice out of Containers/UnrealString.h (CoreMinimal)
// into its own header; older versions don't have this header at all.
#include "Misc/StringOutputDevice.h"
#endif

namespace LudeoKismetDump
{
	// FStringOutputDevice does not emit line terminators on Logf — a raw dump
	// comes out as one giant line. This subclass appends one per Serialize call.
	class FLineEmittingStringOutputDevice : public FStringOutputDevice
	{
	public:
		virtual void Serialize(const TCHAR* InData, ELogVerbosity::Type InVerbosity, const FName& InCategory) override
		{
			FStringOutputDevice::Serialize(InData, InVerbosity, InCategory);
			*this += LINE_TERMINATOR;
		}

		// The class derives from both FString and FOutputDevice, which makes
		// the implicit FStringView conversion ambiguous at SaveStringToFile
		// call sites — hand callers an unambiguous FString.
		const FString& GetString() const { return *this; }
	};

	// Editor-only class artifacts that duplicate the live BPGC — skip them.
	bool IsEditorArtifactClass(const FString& ClassName);

	// Write the three per-class analysis artifacts into OutDir:
	//   <Class>.kismet.txt — disassembled bytecode of every UFUNCTION
	//   <Class>.events.txt — function inventory; BndEvt__ stubs parsed into
	//                        (actor-ish name, delegate signature) pairs; plus
	//                        the BPGC's compiled-in dynamic bindings (component
	//                        delegate property -> handler), the static record
	//                        of which delegate a component handler binds
	//   <Class>.vars.txt   — class-declared UPROPERTY list with flags
	// Returns false if the class was already dumped (per DumpedClassPaths) or
	// has no script surface worth writing.
	bool DumpClassArtifacts(UClass* Cls, const FString& OutDir, TSet<FString>& DumpedClassPaths);
}

#endif // LUDEO_KISMETDUMP_ENABLED
