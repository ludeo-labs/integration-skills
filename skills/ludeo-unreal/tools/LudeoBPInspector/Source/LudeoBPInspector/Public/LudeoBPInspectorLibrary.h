// LudeoBPInspectorLibrary.h
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "LudeoBPInspectorLibrary.generated.h"

USTRUCT(BlueprintType)
struct LUDEOBPINSPECTOR_API FLudeoBPVariableInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FName VarName;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString VarType;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    bool bSaveGame = false;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    bool bReplicated = false;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    int64 PropertyFlags = 0;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString DefaultValue;
};

USTRUCT(BlueprintType)
struct LUDEOBPINSPECTOR_API FLudeoBPComponentInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FName ComponentName;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString ComponentClass;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    bool bIsRootComponent = false;
};

USTRUCT(BlueprintType)
struct LUDEOBPINSPECTOR_API FLudeoBPFunctionInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FName FunctionName;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    TArray<FString> InputPins;  // "PinName:PinType" format

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    TArray<FString> OutputPins;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    bool bIsCustomEvent = false;
};

USTRUCT(BlueprintType)
struct LUDEOBPINSPECTOR_API FLudeoBPEventInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FName EventName;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    bool bIsCustomEvent = false;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString EventClass;
};

USTRUCT(BlueprintType)
struct LUDEOBPINSPECTOR_API FLudeoBPNodeInfo
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FName NodeName;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString NodeClass;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString NodeTitle;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    FString CalledFunction;

    UPROPERTY(BlueprintReadOnly, Category="LudeoBPInspector")
    int32 NodeIndex = 0;
};

UCLASS()
class LUDEOBPINSPECTOR_API ULudeoBPInspectorLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    /** List all BP-defined variables from BP->NewVariables. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static TArray<FLudeoBPVariableInfo> ListBlueprintVariables(UBlueprint* BP);

    /** Check CPF_SaveGame flag on a specific variable. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static bool GetSaveGameFlag(UBlueprint* BP, FName VarName);

    /** Set or clear CPF_SaveGame, recompile, and save. Returns false if var not found. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static bool SetSaveGameFlag(UBlueprint* BP, FName VarName, bool bEnable);

    /** List components from SimpleConstructionScript. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static TArray<FLudeoBPComponentInfo> GetBlueprintComponents(UBlueprint* BP);

    /** Get the native C++ parent class name (e.g., "Character", "Pawn"). */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static FName GetParentClassName(UBlueprint* BP);

    /** List all user-defined functions and custom events in a Blueprint. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static TArray<FLudeoBPFunctionInfo> ListBlueprintFunctions(UBlueprint* BP);

    /** List all events (inherited + custom) in a Blueprint's EventGraph. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static TArray<FLudeoBPEventInfo> ListBlueprintEvents(UBlueprint* BP);

    /** Walk the exec-pin chain of a function or event and return ordered nodes. */
    UFUNCTION(BlueprintCallable, Category="LudeoBPInspector")
    static TArray<FLudeoBPNodeInfo> GetFunctionCallGraph(UBlueprint* BP, FName FunctionName);
};
