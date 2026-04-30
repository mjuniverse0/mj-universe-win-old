namespace MA_FH5Trainer.Cheats.ForzaHorizon5;

public class CustomizationCheats : CheatsUtilities, ICheatsBase, IRevertBase
{
    private UIntPtr _paintAddress;
    public UIntPtr PaintDetourAddress;
    private UIntPtr _headlightColourAddress;
    public UIntPtr HeadlightColourDetourAddress;
    private UIntPtr _cleanlinessAddress;
    public UIntPtr CleanlinessDetourAddress;
    private UIntPtr _backfireTimeAddress;
    public UIntPtr BackfireTimeDetourAddress;

    public async Task CheatGlowingPaint()
    {
        _paintAddress = 0;
        PaintDetourAddress = 0;

        const string sig = "0F 11 ? C6 ? ? ? 49";
        _paintAddress = await SmartAobScan(sig);
        
        if (_paintAddress > 0)
        {
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3)
            {
                await Resources.Cheats.GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x80, 0x3D, 0x2F, 0x00, 0x00, 0x00, 0x01, 0x75, 0x21, 0x48, 0x83, 0xEC, 0x10, 0xF3, 0x0F, 0x7F, 0x04,
                0x24, 0xF3, 0x0F, 0x10, 0x05, 0x1D, 0x00, 0x00, 0x00, 0x0F, 0xC6, 0xC0, 0x00, 0x0F, 0x59, 0xC8, 0xF3,
                0x0F, 0x6F, 0x04, 0x24, 0x48, 0x83, 0xC4, 0x10, 0x0F, 0x11, 0x0A, 0xC6, 0x42, 0xF0, 0x01
            };

            PaintDetourAddress = Resources.Memory.GetInstance().CreateDetour(_paintAddress, asm, 7);
            return;
        }
        
        ShowError("Glowing paint", sig);
    }

    public async Task CheatHeadlightColour()
    {
        _headlightColourAddress = 0;
        HeadlightColourDetourAddress = 0;

        const string sig = "0F 10 ? ? F3 44 ? ? ? ? ? ? ? 83 7B 48";
        _headlightColourAddress = await SmartAobScan(sig);
        
        if (_headlightColourAddress > 0)
        {
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3)
            {
                await Resources.Cheats.GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x0F, 0x10, 0x7B, 0x50, 0x80, 0x3D, 0x17, 0x00, 0x00, 0x00, 0x01, 0x75, 0x07, 0x0F, 0x10, 0x3D, 0x0F,
                0x00, 0x00, 0x00, 0xF3, 0x44, 0x0F, 0x10, 0x83, 0x84, 0x00, 0x00, 0x00
            };

            HeadlightColourDetourAddress = Resources.Memory.GetInstance().CreateDetour(_headlightColourAddress, asm, 13);
            return;
        }
        
        ShowError("Headlight colour", sig);
    }

    public async Task CheatCleanliness()
    {
        _cleanlinessAddress = 0;
        CleanlinessDetourAddress = 0;

        const string sig = "F3 0F ? ? ? ? ? ? F3 0F ? ? ? ? B9 ? ? ? ? E8";
        _cleanlinessAddress = await SmartAobScan(sig);

        if (_cleanlinessAddress > 0)
        {
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3)
            {
                await Resources.Cheats.GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x80, 0x3D, 0x30, 0x00, 0x00, 0x00, 0x01, 0x75, 0x0C, 0x8B, 0x0D, 0x29, 0x00, 0x00, 0x00, 0x89, 0x88,
                0x04, 0x8A, 0x00, 0x00, 0x80, 0x3D, 0x20, 0x00, 0x00, 0x00, 0x01, 0x75, 0x0C, 0x8B, 0x0D, 0x19, 0x00,
                0x00, 0x00, 0x89, 0x88, 0x08, 0x8A, 0x00, 0x00, 0xF3, 0x0F, 0x10, 0x88, 0x0C, 0x8A, 0x00, 0x00
            };

            CleanlinessDetourAddress = Resources.Memory.GetInstance().CreateDetour(_cleanlinessAddress, asm, 8);
            return;
        }
        
        ShowError("Cleanliness", sig);
    }

    public async Task CheatBackfireTime()
    {
        _backfireTimeAddress = 0;
        BackfireTimeDetourAddress = 0;

        const string sig = "F3 0F ? ? ? ? ? ? E8 ? ? ? ? 0F 28 ? F3 0F ? ? ? ? ? ? 48 8B";
        _backfireTimeAddress = await SmartAobScan(sig);

        if (_backfireTimeAddress > 0)
        {
            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3)
            {
                await Resources.Cheats.GetClass<Bypass>().DisableCrcChecks();
            }

            if (Resources.Cheats.GetClass<Bypass>().CallAddress <= 3)
            {
                return;
            }
            
            var asm = new byte[]
            {
                0xF3, 0x0F, 0x10, 0x81, 0x7C, 0x3A, 0x00, 0x00, 0x80, 0x3D, 0x17, 0x00, 0x00, 0x00, 0x01, 0x75, 0x10,
                0xF3, 0x0F, 0x10, 0x05, 0x0E, 0x00, 0x00, 0x00, 0xF3, 0x0F, 0x10, 0x0D, 0x0A, 0x00, 0x00, 0x00
            };

            BackfireTimeDetourAddress = Resources.Memory.GetInstance().CreateDetour(_backfireTimeAddress, asm, 8); 
            return;
        }
        
        ShowError("Backfire Time", sig);
    }
    
    public void Cleanup()
    {
        var mem = Resources.Memory.GetInstance();
        
        if (_paintAddress > 0)
        {
            mem.WriteArrayMemory(_paintAddress, new byte[] { 0x0F, 0x11, 0x0A, 0xC6, 0x42, 0xF0, 0x01 });
            Free(PaintDetourAddress);
        }

        if (_headlightColourAddress > 0)
        {
            mem.WriteArrayMemory(_headlightColourAddress, new byte[] { 0x0F, 0x10, 0x7B, 0x50, 0xF3, 0x44, 0x0F, 0x10, 0x83, 0x84, 0x00, 0x00, 0x00 });
            Free(HeadlightColourDetourAddress);
        }

        if (_cleanlinessAddress > 0)
        {
            mem.WriteArrayMemory(_cleanlinessAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x88, 0x0C, 0x8A, 0x00, 0x00 });
            Free(CleanlinessDetourAddress);
        }

        if (_backfireTimeAddress <= 0) return;
        mem.WriteArrayMemory(_backfireTimeAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x81, 0x7C, 0x3A, 0x00, 0x00 });
        Free(BackfireTimeDetourAddress);
    }

    public void Reset()
    {
        var fields = typeof(CustomizationCheats).GetFields().Where(f => f.FieldType == typeof(UIntPtr));
        foreach (var field in fields)
        {
            field.SetValue(this, UIntPtr.Zero);
        }
    }

    public void Revert()
    {
        var mem = Resources.Memory.GetInstance();
        
        if (_paintAddress > 0)
        {
            mem.WriteArrayMemory(_paintAddress, new byte[] { 0x0F, 0x11, 0x0A, 0xC6, 0x42, 0xF0, 0x01 });
        }

        if (_headlightColourAddress > 0)
        {
            mem.WriteArrayMemory(_headlightColourAddress, new byte[] { 0x0F, 0x10, 0x7B, 0x50, 0xF3, 0x44, 0x0F, 0x10, 0x83, 0x84, 0x00, 0x00, 0x00 });
        }

        if (_cleanlinessAddress > 0)
        {
            mem.WriteArrayMemory(_cleanlinessAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x88, 0x0C, 0x8A, 0x00, 0x00 });
        }

        if (_backfireTimeAddress <= 0) return;
        mem.WriteArrayMemory(_backfireTimeAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x81, 0x7C, 0x3A, 0x00, 0x00 });
    }

    public void Continue()
    {
        var mem = Resources.Memory.GetInstance();
        
        if (_paintAddress > 0)
        {
            mem.WriteArrayMemory(_paintAddress, CalculateDetour(_paintAddress, PaintDetourAddress, 7));
        }

        if (_headlightColourAddress > 0)
        {
            mem.WriteArrayMemory(_headlightColourAddress, CalculateDetour(_headlightColourAddress, HeadlightColourDetourAddress, 13));
        }

        if (_cleanlinessAddress > 0)
        {
            mem.WriteArrayMemory(_cleanlinessAddress, CalculateDetour(_cleanlinessAddress, CleanlinessDetourAddress, 8));
        }

        if (_backfireTimeAddress <= 0) return;
        mem.WriteArrayMemory(_backfireTimeAddress, CalculateDetour(_backfireTimeAddress, BackfireTimeDetourAddress, 8));
    }
}