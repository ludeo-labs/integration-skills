// Copyright Ludeo 2026.
#include "LudeoKismetDumpUtil.h"

#if LUDEO_KISMETDUMP_ENABLED

#include "Engine/BlueprintGeneratedClass.h"
#include "Engine/ComponentDelegateBinding.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "ScriptDisassembler.h"
#include "UObject/Class.h"
#include "UObject/UnrealType.h"

DEFINE_LOG_CATEGORY_STATIC(LogLudeoKismetDump, Log, All);

namespace LudeoKismetDump
{

bool IsEditorArtifactClass(const FString& ClassName)
{
	return ClassName.StartsWith(TEXT("SKEL_"))
		|| ClassName.StartsWith(TEXT("REINST_"))
		|| ClassName.StartsWith(TEXT("TRASHCLASS_"))
		|| ClassName.StartsWith(TEXT("HOTRELOADED_"));
}

namespace
{
	FString PropertyFlagsString(const FProperty* Prop)
	{
		TArray<FString> Flags;
		if (Prop->HasAnyPropertyFlags(CPF_Net)) { Flags.Add(TEXT("Replicated")); }
		if (Prop->RepNotifyFunc != NAME_None) { Flags.Add(FString::Printf(TEXT("RepNotify=%s"), *Prop->RepNotifyFunc.ToString())); }
		if (Prop->HasAnyPropertyFlags(CPF_Transient)) { Flags.Add(TEXT("Transient")); }
		if (Prop->HasAnyPropertyFlags(CPF_SaveGame)) { Flags.Add(TEXT("SaveGame")); }
		if (Prop->HasAnyPropertyFlags(CPF_Config)) { Flags.Add(TEXT("Config")); }
		if (Prop->HasAnyPropertyFlags(CPF_BlueprintAssignable)) { Flags.Add(TEXT("BlueprintAssignable")); }
		if (Prop->HasAnyPropertyFlags(CPF_EditorOnly)) { Flags.Add(TEXT("EditorOnly")); }
		return FString::Join(Flags, TEXT(" "));
	}

	// BndEvt__<Actorish>_K2Node_ActorBoundEvent_<N>_<Sig>__DelegateSignature
	// Best-effort parse — names contain underscores so the actor part is
	// approximate, but it reliably identifies which actor + which delegate.
	bool ParseBoundEventName(const FString& FuncName, FString& OutActorish, FString& OutDelegateSig)
	{
		if (!FuncName.StartsWith(TEXT("BndEvt__"))) { return false; }
		const int32 K2Idx = FuncName.Find(TEXT("_K2Node_ActorBoundEvent_"));
		if (K2Idx == INDEX_NONE) { return false; }

		OutActorish = FuncName.Mid(8, K2Idx - 8);
		FString Rem = FuncName.Mid(K2Idx + FCString::Strlen(TEXT("_K2Node_ActorBoundEvent_")));
		int32 FirstUnderscore = INDEX_NONE;
		if (Rem.FindChar(TEXT('_'), FirstUnderscore))
		{
			OutDelegateSig = Rem.Mid(FirstUnderscore + 1).Replace(TEXT("__DelegateSignature"), TEXT(""));
		}
		return true;
	}
}

bool DumpClassArtifacts(UClass* Cls, const FString& OutDir, TSet<FString>& DumpedClassPaths)
{
	if (!Cls) { return false; }

	const FString ClassPath = Cls->GetPathName();
	if (DumpedClassPaths.Contains(ClassPath)) { return false; }
	DumpedClassPaths.Add(ClassPath);

	const FString ClassName = Cls->GetName();

	// --- Bytecode disassembly ---
	FLineEmittingStringOutputDevice Kismet;
	Kismet.Logf(TEXT("Class: %s"), *ClassPath);
	FKismetBytecodeDisassembler Disassembler(Kismet);
	int32 NumFunctions = 0;
	for (TFieldIterator<UFunction> FuncIt(Cls, EFieldIteratorFlags::ExcludeSuper); FuncIt; ++FuncIt)
	{
		UFunction* Func = *FuncIt;
		Kismet.Logf(TEXT("  Processing function %s (%d bytes)"), *Func->GetName(), Func->Script.Num());
		Disassembler.DisassembleStructure(Func);
		Kismet.Logf(TEXT(""));
		++NumFunctions;
	}

	// --- Function / bound-event inventory ---
	FLineEmittingStringOutputDevice Events;
	Events.Logf(TEXT("Class: %s"), *ClassPath);
	Events.Logf(TEXT("Parent: %s"), Cls->GetSuperClass() ? *Cls->GetSuperClass()->GetName() : TEXT("<none>"));
	Events.Logf(TEXT(""));
	Events.Logf(TEXT("=== Bound events (actor delegate listeners) ==="));
	for (TFieldIterator<UFunction> FuncIt(Cls, EFieldIteratorFlags::ExcludeSuper); FuncIt; ++FuncIt)
	{
		FString Actorish, DelegateSig;
		if (ParseBoundEventName(FuncIt->GetName(), Actorish, DelegateSig))
		{
			Events.Logf(TEXT("%-70s %s"), *Actorish, *DelegateSig);
		}
	}
	// Component-bound events bind through serialized UDynamicBlueprintBinding
	// objects on the BPGC, not bytecode — this is the only static record of
	// WHICH delegate property (e.g. OnActivated vs OnCompleted, which share a
	// signature and are indistinguishable from the stub name) a handler binds.
	// Note: LEVEL-script actor-bound events are not here either — those are
	// serialized into the placed actor instances in the map (see the
	// commandlet's per-map _PlacedActorBindings.txt).
	if (const UBlueprintGeneratedClass* BPGC = Cast<UBlueprintGeneratedClass>(Cls))
	{
		Events.Logf(TEXT(""));
		Events.Logf(TEXT("=== Dynamic bindings (compiled into class) ==="));
		for (const UDynamicBlueprintBinding* Binding : BPGC->DynamicBindingObjects)
		{
			if (const UComponentDelegateBinding* CompBinding = Cast<UComponentDelegateBinding>(Binding))
			{
				for (const FBlueprintComponentDelegateBinding& Entry : CompBinding->ComponentDelegateBindings)
				{
					Events.Logf(TEXT("%-40s %-40s -> %s"),
						*Entry.ComponentPropertyName.ToString(),
						*Entry.DelegatePropertyName.ToString(),
						*Entry.FunctionNameToBind.ToString());
				}
			}
			else if (Binding)
			{
				Events.Logf(TEXT("<%s> (not expanded — extend DumpClassArtifacts if needed)"),
					*Binding->GetClass()->GetName());
			}
		}
	}

	Events.Logf(TEXT(""));
	Events.Logf(TEXT("=== All functions ==="));
	for (TFieldIterator<UFunction> FuncIt(Cls, EFieldIteratorFlags::ExcludeSuper); FuncIt; ++FuncIt)
	{
		Events.Logf(TEXT("%-90s %5d bytes"), *FuncIt->GetName(), FuncIt->Script.Num());
	}

	// --- Class-declared variables ---
	FLineEmittingStringOutputDevice Vars;
	Vars.Logf(TEXT("Class: %s"), *ClassPath);
	Vars.Logf(TEXT(""));
	for (TFieldIterator<FProperty> PropIt(Cls, EFieldIteratorFlags::ExcludeSuper); PropIt; ++PropIt)
	{
		const FProperty* Prop = *PropIt;
		FString Extended;
		const FString CppType = Prop->GetCPPType(&Extended, 0) + Extended;
		Vars.Logf(TEXT("%-60s %-40s %s"), *Prop->GetName(), *CppType, *PropertyFlagsString(Prop));
	}

	const FString Base = OutDir / ClassName;
	const bool bOk =
		FFileHelper::SaveStringToFile(Kismet.GetString(), *(Base + TEXT(".kismet.txt"))) &&
		FFileHelper::SaveStringToFile(Events.GetString(), *(Base + TEXT(".events.txt"))) &&
		FFileHelper::SaveStringToFile(Vars.GetString(), *(Base + TEXT(".vars.txt")));

	if (bOk)
	{
		UE_LOG(LogLudeoKismetDump, Log, TEXT("Dumped %s (%d functions) -> %s.*"), *ClassName, NumFunctions, *Base);
	}
	else
	{
		UE_LOG(LogLudeoKismetDump, Warning, TEXT("Failed writing artifacts for %s under %s"), *ClassName, *OutDir);
	}
	return bOk;
}

} // namespace LudeoKismetDump

#endif // LUDEO_KISMETDUMP_ENABLED
