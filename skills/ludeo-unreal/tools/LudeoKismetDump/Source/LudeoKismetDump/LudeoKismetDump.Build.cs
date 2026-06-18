using UnrealBuildTool;

public class LudeoKismetDump : ModuleRules
{
	public LudeoKismetDump(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"AssetRegistry"
		});

		// Kismet bytecode disassembler — engine Developer module (Core +
		// CoreUObject only). Linking the engine's own copy keeps the opcode
		// set in sync with the engine version (UE4 and UE5 differ).
		// Excluded from Shipping/Test, where the whole feature compiles out.
		if (Target.Configuration != UnrealTargetConfiguration.Shipping
			&& Target.Configuration != UnrealTargetConfiguration.Test)
		{
			PrivateDependencyModuleNames.Add("ScriptDisassembler");
			PrivateDefinitions.Add("LUDEO_KISMETDUMP_ENABLED=1");
		}
		else
		{
			PrivateDefinitions.Add("LUDEO_KISMETDUMP_ENABLED=0");
		}
	}
}
