// LudeoBPInspectorLibrary.cpp
#include "LudeoBPInspectorLibrary.h"

#include "Engine/Blueprint.h"
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "EdGraphSchema_K2.h"
#include "UObject/SavePackage.h"
#include "EdGraph/EdGraph.h"
#include "K2Node_Event.h"
#include "K2Node_CustomEvent.h"
#include "K2Node_CallFunction.h"
#include "K2Node_FunctionEntry.h"
#include "K2Node_FunctionResult.h"

TArray<FLudeoBPVariableInfo> ULudeoBPInspectorLibrary::ListBlueprintVariables(UBlueprint* BP)
{
    TArray<FLudeoBPVariableInfo> Result;
    if (!IsValid(BP))
    {
        return Result;
    }

    // Get CDO for default values
    UObject* CDO = nullptr;
    if (BP->GeneratedClass)
    {
        CDO = BP->GeneratedClass->GetDefaultObject(false);
    }

    for (const FBPVariableDescription& Var : BP->NewVariables)
    {
        FLudeoBPVariableInfo Info;
        Info.VarName = Var.VarName;
        Info.PropertyFlags = static_cast<int64>(Var.PropertyFlags);
        Info.bSaveGame = (Var.PropertyFlags & CPF_SaveGame) != 0;
        Info.bReplicated = (Var.PropertyFlags & (CPF_Net | CPF_RepNotify)) != 0;

        // Build type string from FEdGraphPinType
        const FEdGraphPinType& PinType = Var.VarType;
        FString TypeStr = PinType.PinCategory.ToString();
        if (PinType.PinSubCategoryObject.IsValid())
        {
            TypeStr += TEXT("<") + PinType.PinSubCategoryObject->GetName() + TEXT(">");
        }
        // Wrap container types
        if (PinType.ContainerType == EPinContainerType::Array)
        {
            TypeStr = TEXT("TArray<") + TypeStr + TEXT(">");
        }
        else if (PinType.ContainerType == EPinContainerType::Set)
        {
            TypeStr = TEXT("TSet<") + TypeStr + TEXT(">");
        }
        else if (PinType.ContainerType == EPinContainerType::Map)
        {
            TypeStr = TEXT("TMap<") + TypeStr + TEXT(",") + PinType.PinValueType.TerminalCategory.ToString() + TEXT(">");
        }
        Info.VarType = TypeStr;

        // Get default value from CDO
        if (CDO && BP->GeneratedClass)
        {
            FProperty* Prop = BP->GeneratedClass->FindPropertyByName(Var.VarName);
            if (Prop)
            {
                FString ValueStr;
                const void* ValuePtr = Prop->ContainerPtrToValuePtr<void>(CDO);
                Prop->ExportTextItem_Direct(ValueStr, ValuePtr, nullptr, CDO, PPF_None);
                Info.DefaultValue = ValueStr;
            }
        }

        Result.Add(Info);
    }

    return Result;
}

FName ULudeoBPInspectorLibrary::GetParentClassName(UBlueprint* BP)
{
    if (!IsValid(BP))
    {
        return NAME_None;
    }

    UClass* Current = BP->ParentClass;
    while (IsValid(Current))
    {
        if (Current->GetPathName().StartsWith(TEXT("/Script/")))
        {
            return Current->GetFName();
        }
        Current = Current->GetSuperClass();
    }

    return FName(TEXT("Unknown"));
}

bool ULudeoBPInspectorLibrary::GetSaveGameFlag(UBlueprint* BP, FName VarName)
{
    if (!IsValid(BP))
    {
        return false;
    }

    for (const FBPVariableDescription& Var : BP->NewVariables)
    {
        if (Var.VarName == VarName)
        {
            return (Var.PropertyFlags & CPF_SaveGame) != 0;
        }
    }

    return false;
}

bool ULudeoBPInspectorLibrary::SetSaveGameFlag(UBlueprint* BP, FName VarName, bool bEnable)
{
    if (!IsValid(BP))
    {
        return false;
    }

    for (FBPVariableDescription& Var : BP->NewVariables)
    {
        if (Var.VarName == VarName)
        {
            if (bEnable)
            {
                Var.PropertyFlags |= CPF_SaveGame;
            }
            else
            {
                Var.PropertyFlags &= ~CPF_SaveGame;
            }

            BP->Modify();
            FKismetEditorUtilities::CompileBlueprint(BP);

            // Save the package to disk
            UPackage* Package = BP->GetOutermost();
            if (Package)
            {
                FString PackageFilename;
                if (FPackageName::DoesPackageExist(Package->GetName(), &PackageFilename))
                {
                    UPackage::SavePackage(Package, BP, *PackageFilename, FSavePackageArgs());
                }
            }

            return true;
        }
    }

    return false;
}

TArray<FLudeoBPComponentInfo> ULudeoBPInspectorLibrary::GetBlueprintComponents(UBlueprint* BP)
{
    TArray<FLudeoBPComponentInfo> Result;
    if (!IsValid(BP) || !BP->SimpleConstructionScript)
    {
        return Result;
    }

    const USCS_Node* RootNode = BP->SimpleConstructionScript->GetDefaultSceneRootNode();

    for (USCS_Node* Node : BP->SimpleConstructionScript->GetAllNodes())
    {
        if (!IsValid(Node) || !Node->ComponentClass)
        {
            continue;
        }

        FLudeoBPComponentInfo Info;
        Info.ComponentName = Node->GetVariableName();
        Info.ComponentClass = Node->ComponentClass->GetName();
        Info.bIsRootComponent = (Node == RootNode);
        Result.Add(Info);
    }

    return Result;
}

// Helper: format a non-exec pin as "PinName:PinType"
static FString FormatPin(const UEdGraphPin* Pin)
{
    FString TypeStr = Pin->PinType.PinCategory.ToString();
    if (Pin->PinType.PinSubCategoryObject.IsValid())
    {
        TypeStr += TEXT("<") + Pin->PinType.PinSubCategoryObject->GetName() + TEXT(">");
    }
    return Pin->GetName() + TEXT(":") + TypeStr;
}

// Helper: check if a pin is an exec pin
static bool IsExecPin(const UEdGraphPin* Pin)
{
    return Pin->PinType.PinCategory == UEdGraphSchema_K2::PC_Exec;
}

TArray<FLudeoBPFunctionInfo> ULudeoBPInspectorLibrary::ListBlueprintFunctions(UBlueprint* BP)
{
    TArray<FLudeoBPFunctionInfo> Result;
    if (!IsValid(BP))
    {
        return Result;
    }

    // User-defined functions from FunctionGraphs
    for (UEdGraph* Graph : BP->FunctionGraphs)
    {
        if (!IsValid(Graph))
        {
            continue;
        }

        FLudeoBPFunctionInfo Info;
        Info.FunctionName = Graph->GetFName();
        Info.bIsCustomEvent = false;

        // Find entry node for pin info
        for (UEdGraphNode* Node : Graph->Nodes)
        {
            if (UK2Node_FunctionEntry* Entry = Cast<UK2Node_FunctionEntry>(Node))
            {
                for (UEdGraphPin* Pin : Entry->Pins)
                {
                    if (!IsExecPin(Pin) && Pin->Direction == EGPD_Output)
                    {
                        Info.InputPins.Add(FormatPin(Pin));
                    }
                }
            }
            else if (UK2Node_FunctionResult* ResultNode = Cast<UK2Node_FunctionResult>(Node))
            {
                for (UEdGraphPin* Pin : ResultNode->Pins)
                {
                    if (!IsExecPin(Pin) && Pin->Direction == EGPD_Input)
                    {
                        Info.OutputPins.Add(FormatPin(Pin));
                    }
                }
            }
        }

        Result.Add(Info);
    }

    // Custom events from UbergraphPages
    for (UEdGraph* Graph : BP->UbergraphPages)
    {
        if (!IsValid(Graph))
        {
            continue;
        }

        for (UEdGraphNode* Node : Graph->Nodes)
        {
            if (UK2Node_CustomEvent* CustomEvent = Cast<UK2Node_CustomEvent>(Node))
            {
                FLudeoBPFunctionInfo Info;
                Info.FunctionName = CustomEvent->CustomFunctionName;
                Info.bIsCustomEvent = true;

                for (UEdGraphPin* Pin : CustomEvent->Pins)
                {
                    if (!IsExecPin(Pin) && Pin->Direction == EGPD_Output)
                    {
                        Info.InputPins.Add(FormatPin(Pin));
                    }
                }

                Result.Add(Info);
            }
        }
    }

    return Result;
}

TArray<FLudeoBPEventInfo> ULudeoBPInspectorLibrary::ListBlueprintEvents(UBlueprint* BP)
{
    TArray<FLudeoBPEventInfo> Result;
    if (!IsValid(BP))
    {
        return Result;
    }

    for (UEdGraph* Graph : BP->UbergraphPages)
    {
        if (!IsValid(Graph))
        {
            continue;
        }

        for (UEdGraphNode* Node : Graph->Nodes)
        {
            UK2Node_Event* EventNode = Cast<UK2Node_Event>(Node);
            if (!EventNode)
            {
                continue;
            }

            FLudeoBPEventInfo Info;
            Info.EventName = EventNode->EventReference.GetMemberName();
            Info.bIsCustomEvent = EventNode->IsA<UK2Node_CustomEvent>();

            UClass* EventClass = EventNode->EventReference.GetMemberParentClass();
            if (EventClass)
            {
                Info.EventClass = EventClass->GetName();
            }

            Result.Add(Info);
        }
    }

    return Result;
}

// Helper: walk exec-pin chain from a starting node, building ordered node list
static TArray<FLudeoBPNodeInfo> WalkExecChain(UEdGraphNode* StartNode)
{
    TArray<FLudeoBPNodeInfo> Result;
    if (!StartNode)
    {
        return Result;
    }

    TSet<UEdGraphNode*> Visited;
    UEdGraphNode* Current = StartNode;
    int32 Index = 0;

    while (Current && !Visited.Contains(Current))
    {
        Visited.Add(Current);

        // Build node info (skip the entry node itself — start recording from first real node)
        if (Index > 0 || !Current->IsA<UK2Node_FunctionEntry>() && !Current->IsA<UK2Node_Event>())
        {
            FLudeoBPNodeInfo Info;
            Info.NodeName = Current->GetFName();
            Info.NodeClass = Current->GetClass()->GetName();
            Info.NodeTitle = Current->GetNodeTitle(ENodeTitleType::FullTitle).ToString();
            Info.NodeIndex = Index;

            if (UK2Node_CallFunction* CallNode = Cast<UK2Node_CallFunction>(Current))
            {
                Info.CalledFunction = CallNode->FunctionReference.GetMemberName().ToString();
            }

            Result.Add(Info);
            Index++;
        }

        // Follow first connected output exec pin
        UEdGraphNode* Next = nullptr;
        for (UEdGraphPin* Pin : Current->Pins)
        {
            if (Pin->Direction == EGPD_Output && IsExecPin(Pin) && Pin->LinkedTo.Num() > 0)
            {
                Next = Pin->LinkedTo[0]->GetOwningNode();
                break;
            }
        }
        Current = Next;
    }

    return Result;
}

TArray<FLudeoBPNodeInfo> ULudeoBPInspectorLibrary::GetFunctionCallGraph(UBlueprint* BP, FName FunctionName)
{
    TArray<FLudeoBPNodeInfo> Result;
    if (!IsValid(BP))
    {
        return Result;
    }

    // Search FunctionGraphs for user-defined functions
    for (UEdGraph* Graph : BP->FunctionGraphs)
    {
        if (IsValid(Graph) && Graph->GetFName() == FunctionName)
        {
            // Find entry node
            for (UEdGraphNode* Node : Graph->Nodes)
            {
                if (Node->IsA<UK2Node_FunctionEntry>())
                {
                    return WalkExecChain(Node);
                }
            }
        }
    }

    // Search UbergraphPages for events (both inherited and custom)
    for (UEdGraph* Graph : BP->UbergraphPages)
    {
        if (!IsValid(Graph))
        {
            continue;
        }

        for (UEdGraphNode* Node : Graph->Nodes)
        {
            UK2Node_Event* EventNode = Cast<UK2Node_Event>(Node);
            if (!EventNode)
            {
                continue;
            }

            // Match by event name or custom event name
            FName MatchName = EventNode->EventReference.GetMemberName();
            if (UK2Node_CustomEvent* CustomEvent = Cast<UK2Node_CustomEvent>(EventNode))
            {
                MatchName = CustomEvent->CustomFunctionName;
            }

            if (MatchName == FunctionName)
            {
                return WalkExecChain(EventNode);
            }
        }
    }

    return Result;
}
