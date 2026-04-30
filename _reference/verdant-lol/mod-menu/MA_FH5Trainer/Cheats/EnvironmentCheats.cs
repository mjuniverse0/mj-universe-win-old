using static MA_FH5Trainer.Resources.Cheats;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Cheats.ForzaHorizon5;

public class EnvironmentCheats : CheatsUtilities, ICheatsBase, IRevertBase
{
    private UIntPtr _sunRgbAddress;
    public UIntPtr SunRgbDetourAddress;
    private UIntPtr _timeAddress;
    public UIntPtr TimeDetourAddress;

    public async Task CheatSunRgb()
    {
        _sunRgbAddress = 0;
        SunRgbDetourAddress = 0;

        const string sig = "41 0F ? ? 48 83 C4 ? 41 ? C3 48 8D";
        _sunRgbAddress = await SmartAobScan(sig);

        if (_sunRgbAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x2B, 0x00, 0x00, 0x00, 0x01, 0x75, 0x1C, 0x48, 0x83, 0xEC, 0x10, 0xF3, 0x0F, 0x7F, 0x14,
                0x24, 0x0F, 0x10, 0x15, 0x1A, 0x00, 0x00, 0x00, 0x0F, 0x59, 0xDA, 0xF3, 0x0F, 0x6F, 0x14, 0x24, 0x48,
                0x83, 0xC4, 0x10, 0x41, 0x0F, 0x11, 0x1E, 0x48, 0x83, 0xC4, 0x20
            };

            SunRgbDetourAddress = GetInstance().CreateDetour(_sunRgbAddress, asm, 8);
            return;
        }
        
        ShowError("Sun rgb", sig);
    }

    public async Task CheatTime()
    {
        _timeAddress = 0;
        TimeDetourAddress = 0;

        const string sig = "44 0F ? ? ? ? F2 0F ? ? ? 48 83 C4";
        _timeAddress = await SmartAobScan(sig) + 6;

        if (_timeAddress > 6)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }

            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0xF2, 0x0F, 0x11, 0x05, 0x24, 0x00, 0x00, 0x00, 0x80, 0x3D, 0x14, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08,
                0xF2, 0x0F, 0x10, 0x05, 0x0B, 0x00, 0x00, 0x00, 0xF2, 0x0F, 0x11, 0x43, 0x08
            };

            TimeDetourAddress = GetInstance().CreateDetour(_timeAddress, asm, 5);
            return;
        }
        
        ShowError("Manual time", sig);
    }
    
    public void Cleanup()
    {
        var mem = GetInstance();
        
        if (_sunRgbAddress > 0)
        {
            mem.WriteArrayMemory(_sunRgbAddress, new byte[] { 0x41, 0x0F, 0x11, 0x1E, 0x48, 0x83, 0xC4, 0x20 });
            Free(SunRgbDetourAddress);
        }

        if (_timeAddress <= 6) return;
        mem.WriteArrayMemory(_timeAddress, new byte[] { 0xF2, 0x0F, 0x11, 0x43, 0x08 });
        Free(TimeDetourAddress);
    }

    public void Reset()
    {
        var fields = typeof(EnvironmentCheats).GetFields().Where(f => f.FieldType == typeof(UIntPtr));
        foreach (var field in fields)
        {
            field.SetValue(this, UIntPtr.Zero);
        }
    }

    public void Revert()
    {
        var mem = GetInstance();
        
        if (_sunRgbAddress > 0)
        {
            mem.WriteArrayMemory(_sunRgbAddress, new byte[] { 0x41, 0x0F, 0x11, 0x1E, 0x48, 0x83, 0xC4, 0x20 });
        }

        if (_timeAddress <= 6) return;
        mem.WriteArrayMemory(_timeAddress, new byte[] { 0xF2, 0x0F, 0x11, 0x43, 0x08 });
    }

    public void Continue()
    {
        var mem = GetInstance();
        
        if (_sunRgbAddress > 0)
        {
            mem.WriteArrayMemory(_sunRgbAddress, CalculateDetour(_sunRgbAddress, SunRgbDetourAddress, 8));
        }

        if (_timeAddress <= 6) return;
        mem.WriteArrayMemory(_timeAddress, CalculateDetour(_timeAddress, TimeDetourAddress, 5));
    }
}