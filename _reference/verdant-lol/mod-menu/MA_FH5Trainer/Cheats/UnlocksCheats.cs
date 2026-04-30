using System.Windows.Input.Manipulations;
using MA_FH5Trainer.Resources;
using Memory;
using static MA_FH5Trainer.Resources.Cheats;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Cheats.ForzaHorizon5;

public class UnlocksCheats : CheatsUtilities, ICheatsBase, IRevertBase
{
    private UIntPtr _creditsAddress;
    public UIntPtr CreditsDetourAddress;
    private UIntPtr _xpPointsAddress;
    public UIntPtr XpPointsDetourAddress;
    private UIntPtr _xpAddress;
    public UIntPtr XpDetourAddress;
    private UIntPtr _spinsAddress;
    public UIntPtr SpinsDetourAddress;
    private UIntPtr _skillPointsAddress;
    public UIntPtr SkillPointsDetourAddress;
    private UIntPtr _seriesAddress;
    public UIntPtr SeriesDetourAddress;
    private UIntPtr _seasonalAddress;
    public UIntPtr SeasonalDetourAddress;
    private UIntPtr _bxmlEncryptionAddress;
    public UIntPtr BxmlEncryptionDetourAddress;
    private UIntPtr _clothing1Address;
    public UIntPtr Clothing1DetourAddress;
    private UIntPtr _clothing2Address;
    public UIntPtr Clothing2DetourAddress;
    private UIntPtr _emoteAddress;
    public UIntPtr EmoteDetourAddress;

    private UIntPtr _getRewardsAddress;
    private UIntPtr _getPerkPrizeAddress;

    private UIntPtr _getWheelspinsAddress;
    private UIntPtr _getSuperWheelspinsAddress;
    public async Task<bool> CheatWheelspins(float value)
    {
        if (_getWheelspinsAddress == 0)
        {
            _getWheelspinsAddress = await SmartAobScan("48 89 ? ? ? 57 48 83 EC ? E8 ? ? ? ? F3 48 ? ? ? 48 8D ? ? ? 48 8B ? ? ? ? ? E8 ? ? ? ? 90 44 8B ? 33 D2");
        }

        if (_getWheelspinsAddress == 0)
        {
            ShowError("CheatWheelspins", "_getWheelspinsAddress == 0");
            return false;
        }
        
        byte[] bVal = BitConverter.GetBytes(value);
        byte[] bSpins = BitConverter.GetBytes(_getWheelspinsAddress);
        byte[] asm =
        [
            0x51, 0x52, 0x41, 0x50, 0x41, 0x51, 0x48, 0x83, 0xEC, 0x28, 0x48, 0x8D, 0x05, 0x4D, 0x00, 0x00, 0x00, 0xC7,
            0x40, 0x40, bVal[0], bVal[1], bVal[2], bVal[3], 0x48, 0x8D, 0x0D, 0x1F, 0x00, 0x00, 0x00, 0x48, 0x89, 0x41,
            0x18, 0xFF, 0x15, 0x02, 0x00, 0x00, 0x00, 0xEB, 0x08, bSpins[0], bSpins[1], bSpins[2], bSpins[3], bSpins[4],
            bSpins[5], bSpins[6], bSpins[7], 0x48, 0x83, 0xC4, 0x28, 0x41, 0x59, 0x41, 0x58, 0x5A, 0x59, 0xC3
        ];
        
        Mem mem = GetInstance();
        IntPtr procHandle = mem.MProc.Handle;
        nuint asmAddress = Imps.VirtualAllocEx(procHandle, 0, 0x1000, 0x3000, 0x40);
        if (asmAddress == 0)
        {
            ShowError("CheatWheelspins", "_asmAddress == 0");
            return false;
        }

        mem.WriteArrayMemory(asmAddress, asm);
        IntPtr thread = Imports.CreateRemoteThread(procHandle, 0, 0, asmAddress, 0, 0, out _);
        if (thread is 0 or -1)
        {
            ShowError("CheatWheelspins", "thread == 0 || thread == -1");
            Free(asmAddress);
            return false;
        }
        
        int wait = Imports.WaitForSingleObject(thread, int.MaxValue);
        if (wait == -1 || wait == 0x00000102L)
        {
            ShowError("CheatWheelspins", "wait == -1 || wait == 0x00000102L");
            Imports.CloseHandle(thread);
            Free(asmAddress);
            return false;
        }
        
        Imports.CloseHandle(thread);
        Free(asmAddress);
        return true;
    }

    public async Task<bool> CheatSuperWheelspins(float value)
    {
        if (_getSuperWheelspinsAddress == 0)
        {
            _getSuperWheelspinsAddress = await SmartAobScan("48 89 ? ? ? 57 48 83 EC ? E8 ? ? ? ? F3 48 ? ? ? 48 8D ? ? ? 48 8B ? ? ? ? ? E8 ? ? ? ? 90 44 8B ? BA 01");
        }

        if (_getSuperWheelspinsAddress == 0)
        {
            ShowError("CheatSuperWheelspins", "_getSuperWheelspinsAddress == 0");
            return false;
        }
        
        byte[] bVal = BitConverter.GetBytes(value);
        byte[] bSpins = BitConverter.GetBytes(_getSuperWheelspinsAddress);
        byte[] asm =
        [
            0x51, 0x52, 0x41, 0x50, 0x41, 0x51, 0x48, 0x83, 0xEC, 0x28, 0x48, 0x8D, 0x05, 0x4D, 0x00, 0x00, 0x00, 0xC7,
            0x40, 0x40, bVal[0], bVal[1], bVal[2], bVal[3], 0x48, 0x8D, 0x0D, 0x1F, 0x00, 0x00, 0x00, 0x48, 0x89, 0x41,
            0x18, 0xFF, 0x15, 0x02, 0x00, 0x00, 0x00, 0xEB, 0x08, bSpins[0], bSpins[1], bSpins[2], bSpins[3], bSpins[4],
            bSpins[5], bSpins[6], bSpins[7], 0x48, 0x83, 0xC4, 0x28, 0x41, 0x59, 0x41, 0x58, 0x5A, 0x59, 0xC3
        ];
        
        Mem mem = GetInstance();
        IntPtr procHandle = mem.MProc.Handle;
        nuint asmAddress = Imps.VirtualAllocEx(procHandle, 0, 0x1000, 0x3000, 0x40);
        if (asmAddress == 0)
        {
            ShowError("CheatSuperWheelspins", "_asmAddress == 0");
            return false;
        }

        mem.WriteArrayMemory(asmAddress, asm);
        IntPtr thread = Imports.CreateRemoteThread(procHandle, 0, 0, asmAddress, 0, 0, out _);
        if (thread is 0 or -1)
        {
            ShowError("CheatSuperWheelspins", "thread == 0 || thread == -1");
            Free(asmAddress);
            return false;
        }
        
        int wait = Imports.WaitForSingleObject(thread, int.MaxValue);
        if (wait == -1 || wait == 0x00000102L)
        {
            ShowError("CheatSuperWheelspins", "wait == -1 || wait == 0x00000102L");
            Imports.CloseHandle(thread);
            Free(asmAddress);
            return false;
        }
        
        Imports.CloseHandle(thread);
        Free(asmAddress);
        return true;
    }

    public enum EPerkType : byte
    {
        Unknown,
        XP,
        FP,
        Credits
    }

    public async Task<bool> CheatPerkPrize(float value, EPerkType type)
    {
        if (_getRewardsAddress == 0)
        {
            _getRewardsAddress = await SmartAobScan("48 89 ? ? ? 57 48 83 EC ? 33 FF E8 ? ? ? ? 48 8B ? 48 8B ? FF 52");
        }

        if (_getPerkPrizeAddress == 0)
        {
            _getPerkPrizeAddress = await SmartAobScan("48 89 ? ? ? 57 48 83 EC ? 48 8B ? 48 8B ? E8 ? ? ? ? 83 E8");
        }
        
        if (_getRewardsAddress == 0 || _getPerkPrizeAddress == 0)
        {
            ShowError("GetPerkPrize", "_getRewardsAddress == 0 || _getPerkPrizeAddress == 0");
            return false;
        }

        byte[] bVal = BitConverter.GetBytes(value);
        byte[] bRewards = BitConverter.GetBytes(_getRewardsAddress);
        byte[] bPerkPrize = BitConverter.GetBytes(_getPerkPrizeAddress);
        byte[] asm =
        [
            0x51, 0x52, 0x41, 0x50, 0x41, 0x51, 0x48, 0x83, 0xEC, 0x28, 0xFF, 0x15, 0x02, 0x00, 0x00, 0x00, 0xEB, 0x08,
            bRewards[0], bRewards[1], bRewards[2], bRewards[3], bRewards[4], bRewards[5], bRewards[6], bRewards[7],
            0x48, 0x8B, 0xD0, 0x48, 0x8D, 0x05, 0x51, 0x00, 0x00, 0x00, 0xC7, 0x40, 0x40, bVal[0], bVal[1], bVal[2],
            bVal[3], 0xC6, 0x40, 0x50, (byte)type, 0x48, 0x8D, 0x0D, 0x1F, 0x00, 0x00, 0x00, 0x48, 0x89, 0x41, 0x18,
            0xFF, 0x15, 0x02, 0x00, 0x00, 0x00, 0xEB, 0x08, bPerkPrize[0], bPerkPrize[1], bPerkPrize[2], bPerkPrize[3],
            bPerkPrize[4], bPerkPrize[5], bPerkPrize[6], bPerkPrize[7], 0x48, 0x83, 0xC4, 0x28, 0x41, 0x59, 0x41, 0x58,
            0x5A, 0x59, 0xC3
        ];

        Mem mem = GetInstance();
        IntPtr procHandle = mem.MProc.Handle;
        nuint asmAddress = Imps.VirtualAllocEx(procHandle, 0, 0x1000, 0x3000, 0x40);
        if (asmAddress == 0)
        {
            ShowError("GetPerkPrize", "_asmAddress == 0");
            return false;
        }

        mem.WriteArrayMemory(asmAddress, asm);
        IntPtr thread = Imports.CreateRemoteThread(procHandle, 0, 0, asmAddress, 0, 0, out _);
        if (thread is 0 or -1)
        {
            ShowError("GetPerkPrize", "thread == 0 || thread == -1");
            Free(asmAddress);
            return false;
        }
        
        int wait = Imports.WaitForSingleObject(thread, int.MaxValue);
        if (wait == -1 || wait == 0x00000102L)
        {
            ShowError("GetPerkPrize", "wait == -1 || wait == 0x00000102L");
            Imports.CloseHandle(thread);
            Free(asmAddress);
            return false;
        }
        
        Imports.CloseHandle(thread);
        Free(asmAddress);
        return true;
    }
    
    public async Task CheatEmote()
    {
        _emoteAddress = 0;
        EmoteDetourAddress = 0;

        /*
         * Long sig (RVA Steam v1.638: 0x02B46BF8):
         * 8B 0C ? 89 8D ? ? ? ? 4D 8B ? 0F 57 ? F3 0F ? ? ? 49 8B ? ? ? ? ? 48 85 ? 74 ? 8B 42 ? 85 C0 74 ? 90 8D 48 ? F0 0F ? ? ? 74 ? 85 C0 75 ? EB ? 49 8B ? ? ? ? ? 48 89 ? ? 49 8B ? ? ? ? ? 48 89 ? ? 8B 95 ? ? ? ? 48 8B ? ? E8 ? ? ? ? 84 C0 40 0F ? ? 48 8B ? ? 48 85 ? 74 ? B8 ? ? ? ? F0 0F ? ? ? 83 F8 ? 75 ? 48 8B ? ? 48 8B ? 48 8B ? FF 10 B8 ? ? ? ? F0 0F ? ? ? 83 F8 ? 75 ? 48 8B ? ? 48 8B ? FF 50 ? 40 84 ? 74 ? 48 8B ? ? ? 48 3B ? ? ? 74 ? 8B 85 ? ? ? ? 89 02 48 83 44 24 58
         */
        _emoteAddress = await (SmartAobScan("8B 0C B8 89 8D B0 00 00 00"));
        if (_emoteAddress == 0)
        {
            ShowError("Emote", "_emoteAddress == 0");
            return;
        }

        var bypass = GetClass<Bypass>();
        if (bypass.CallAddress == 0)
        {
            await bypass.DisableCrcChecks();
        }

        if (bypass.CallAddress == 0)
        {
            return;
        }

        var memory = GetInstance();
        byte[] detour = [ 0x80, 0x3D, 0x18, 0x00, 0x00, 0x00, 0x01, 0x74, 0x05, 0x8B, 0x0C, 0xB8, 0xEB, 0x06, 0x8B, 0x0D, 0x0C, 0x00, 0x00, 0x00, 0x89, 0x8D, 0xB0, 0x00, 0x00, 0x00];
        
        EmoteDetourAddress = memory.CreateDetour(_emoteAddress, detour, 9);
        if (EmoteDetourAddress == 0)
        {
            ShowError("Emote", "EmoteDetourAddress == 0");
        }
    }
    
    public async Task CheatCredits()
    {
        _creditsAddress = 0;
        CreditsDetourAddress = 0;
        
        const string sig = "E8 ? ? ? ? 89 84 ? ? ? ? ? 4C 8D ? ? ? ? ? 48 8B";
        _creditsAddress = await SmartAobScan(sig);

        if (_creditsAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var relativeAddress = _creditsAddress + 1;
            var relativeOffset = GetInstance().ReadMemory<int>(relativeAddress);
            _creditsAddress = (UIntPtr)((IntPtr)_creditsAddress + relativeOffset + 0x5 + 24);
            
            var asm = new byte[]
            {
                0x48, 0x8B, 0x4F, 0x08, 0x80, 0x3D, 0x26, 0x00, 0x00, 0x00, 0x01, 0x75, 0x1D, 0x48, 0x8B, 0x54, 0x24,
                0x20, 0x48, 0xB8, 0x43, 0x72, 0x65, 0x64, 0x69, 0x74, 0x73, 0x00, 0x48, 0x39, 0x42, 0xB4, 0x75, 0x08,
                0x8B, 0x15, 0x0A, 0x00, 0x00, 0x00, 0x89, 0x17, 0x31, 0xD2
            };

            CreditsDetourAddress = GetInstance().CreateDetour(_creditsAddress, asm, 6);
            return;
        }
        
        ShowError("Credits", sig);
    }

    public async Task CheatXp()
    {
        _xpPointsAddress = 0;
        XpPointsDetourAddress = 0;
        _xpAddress = 0;
        XpDetourAddress = 0;

        const string sig = "44 89 ? ? 8B 89 ? ? ? ? 85 C9";
        _xpPointsAddress = await SmartAobScan(sig) + 4;
        if (_xpPointsAddress > 4)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            _xpAddress = _xpPointsAddress + 14;
            var pointsAsm = new byte[]
            {
                0x80, 0x3D, 0x14, 0x00, 0x00, 0x00, 0x01, 0x75, 0x07, 0xC6, 0x81, 0x88, 0x00, 0x00, 0x00, 0x01, 0x8B,
                0x89, 0x88, 0x00, 0x00, 0x00
            };

            var asm = new byte[]
            {
                0x41, 0x8B, 0x87, 0x8C, 0x00, 0x00, 0x00, 0x80, 0x3D, 0x0D, 0x00, 0x00, 0x00, 0x01, 0x75, 0x06, 0x8B,
                0x05, 0x06, 0x00, 0x00, 0x00
            };

            XpPointsDetourAddress = GetInstance().CreateDetour(_xpPointsAddress, pointsAsm, 6);
            XpDetourAddress = GetInstance().CreateDetour(_xpAddress, asm, 7);
            return;
        }
        
        ShowError("Xp", sig);
    }

    public async Task CheatSpins()
    {
        _spinsAddress = 0;
        SpinsDetourAddress = 0;

        const string sig = "48 89 5C 24 08 57 48 83 EC 20 48 8B FA 33 D2 48 8B 4F 10";
        _spinsAddress = await SmartAobScan(sig) + 28;

        if (_spinsAddress > 28)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x80, 0x3D, 0x15, 0x00, 0x00, 0x00, 0x01, 0x75, 0x09, 0x8B, 0x15, 0x0E, 0x00, 0x00, 0x00, 0x89, 0x57,
                0x08, 0x33, 0xD2, 0x8B, 0x5F, 0x08
            };

            SpinsDetourAddress = GetInstance().CreateDetour(_spinsAddress, asm, 5);
            return;
        }
        
        ShowError("Spins", sig);
    }
    
    public async Task CheatSkillPoints()
    {
        _skillPointsAddress = 0;
        SkillPointsDetourAddress = 0;

        const string sig = "85 D2 78 32 48 89 5C 24 08 57 48 83 EC 20 8B DA 48 8B F9 48 8B 49 48";
        _skillPointsAddress = await SmartAobScan(sig) + 34;

        if (_skillPointsAddress > 34)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x12, 0x00, 0x00, 0x00, 0x01, 0x75, 0x06, 0x8B, 0x1D, 0x0B, 0x00, 0x00, 0x00, 0x33, 0xD2,
                0x89, 0x5F, 0x40
            };

            SkillPointsDetourAddress = GetInstance().CreateDetour(_skillPointsAddress, asm, 5);
            return;
        }
        
        ShowError("Skill points", sig);
    }
    
    public async Task CheatBxmlEncryption()
    {
        _bxmlEncryptionAddress = 0;
        BxmlEncryptionDetourAddress = 0;

        const string sig = "48 89 5C 24 08 57 48 83 EC 20 48 8B 79 08 33 D2 48";
        _bxmlEncryptionAddress = await SmartAobScan(sig) + 29;

        if (_bxmlEncryptionAddress > 29)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x4D, 0x00, 0x00, 0x00, 0x01, 0x75, 0x0F, 0x83, 0x7F, 0x20, 0x07, 0x75, 0x09, 0x8B, 0x15,
                0x40, 0x00, 0x00, 0x00, 0x89, 0x57, 0x28, 0x80, 0x3D, 0x3A, 0x00, 0x00, 0x00, 0x01, 0x75, 0x11, 0x83,
                0x7F, 0x20, 0x01, 0x75, 0x0B, 0x8B, 0x15, 0x2D, 0x00, 0x00, 0x00, 0xD1, 0xEA, 0x89, 0x57, 0x28, 0x80,
                0x3D, 0x25, 0x00, 0x00, 0x00, 0x01, 0x75, 0x0F, 0x83, 0x7F, 0x20, 0x03, 0x75, 0x09, 0x8B, 0x15, 0x18,
                0x00, 0x00, 0x00, 0x89, 0x57, 0x28, 0x31, 0xD2, 0x8B, 0x5F, 0x28
            };

            BxmlEncryptionDetourAddress = GetInstance().CreateDetour(_bxmlEncryptionAddress, asm, 5);
            return;
        }
        
        ShowError("Bxml Encryption", sig);
    }

    public async Task CheatSeasonal()
    {
        _seasonalAddress = 0;
        SeasonalDetourAddress = 0;

        const string sig = "49 63 ? 8B 44 ? ? C3";
        _seasonalAddress = await SmartAobScan(sig);

        if (_seasonalAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x49, 0x63, 0xC0, 0x80, 0x3D, 0x19, 0x00, 0x00, 0x00, 0x01, 0x75, 0x0E, 0x52, 0x48, 0x8B, 0x15, 0x10,
                0x00, 0x00, 0x00, 0x48, 0x89, 0x54, 0x81, 0x60, 0x5A, 0x8B, 0x44, 0x81, 0x60
            };

            SeasonalDetourAddress = GetInstance().CreateDetour(_seasonalAddress, asm, 7);
            return;
        }
        
        ShowError("Seasonal points", sig);
    }

    public async Task CheatSeries()
    {
        _seriesAddress = 0;
        SeriesDetourAddress = 0;

        const string sig = "89 59 ? 48 83 C4 ? 5B C3 CC CC CC CC CC 44 89";
        _seriesAddress = await SmartAobScan(sig);

        if (_seriesAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x14, 0x00, 0x00, 0x00, 0x01, 0x75, 0x06, 0x8B, 0x1D, 0x0D, 0x00, 0x00, 0x00, 0x89, 0x59,
                0x14, 0x48, 0x83, 0xC4, 0x30
            };

            SeriesDetourAddress = GetInstance().CreateDetour(_seriesAddress, asm, 7);
            return;
        }
        
        ShowError("Series points", sig);
    }

    public async Task CheatClothing()
    {
        _clothing1Address = 0;
        Clothing1DetourAddress = 0;
        _clothing2Address = 0;
        Clothing2DetourAddress = 0;

        const string clothing1Sig = "48 8B ? ? ? 8B 88 ? ? ? ? 39 4B";
        _clothing1Address = await SmartAobScan(clothing1Sig) + 5;

        if (_clothing1Address > 5)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x8B, 0x88, 0x88, 0x00, 0x00, 0x00, 0x83, 0x3D, 0x0C, 0x00, 0x00, 0x00, 0x01, 0x0F, 0x44, 0x0D, 0x05,
                0x00, 0x00, 0x00
            };

            Clothing1DetourAddress = GetInstance().CreateDetour(_clothing1Address, asm, 6);
        }
        else
        {
            ShowError("Free Clothing", clothing1Sig);
            return;
        }
        
        const string clothing2Sig = "8B B8 ? ? ? ? 0F B6 ? ? ? ? ? 49 8B";
        _clothing2Address = await SmartAobScan(clothing2Sig);
        if (_clothing2Address > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x8B, 0xB8, 0x88, 0x00, 0x00, 0x00, 0x83, 0x3D, 0x0C, 0x00, 0x00, 0x00, 0x01, 0x0F, 0x44, 0x3D, 0x05,
                0x00, 0x00, 0x00
            };

            Clothing2DetourAddress = GetInstance().CreateDetour(_clothing2Address, asm, 6);
        }
        else
        {
            ShowError("Free Clothing", clothing2Sig);
        }
    }
    
    public void Cleanup()
    {
        var mem = GetInstance();
        
        if (_creditsAddress > 0)
        {
            mem.WriteArrayMemory(_creditsAddress, new byte[] { 0x48, 0x8B, 0x4F, 0x08, 0x33, 0xD2 });
            Free(CreditsDetourAddress);
        }

        if (_xpPointsAddress > 4)
        {
            mem.WriteArrayMemory(_xpPointsAddress, new byte[] { 0x8B, 0x89, 0x88, 0x00, 0x00, 0x00 });
            Free(XpPointsDetourAddress);
        }

        if (_xpAddress > 0)
        {
            mem.WriteArrayMemory(_xpAddress, new byte[] { 0x41, 0x8B, 0x87, 0x8C, 0x00, 0x00, 0x00 });
            Free(XpDetourAddress);
        }

        if (_spinsAddress > 28)
        {
            mem.WriteArrayMemory(_spinsAddress, new byte[] { 0x33, 0xD2, 0x8B, 0x5F, 0x08 });
            Free(SpinsDetourAddress);
        }

        if (_bxmlEncryptionAddress > 29)
        {
            mem.WriteArrayMemory(_bxmlEncryptionAddress, new byte[] { 0x33, 0xD2, 0x8B, 0x5F, 0x28 });
            Free(BxmlEncryptionDetourAddress);
        }

        if (_skillPointsAddress > 34)
        {
            // ReSharper disable once UseUtf8StringLiteral
            mem.WriteArrayMemory(_skillPointsAddress, new byte[] { 0x33, 0xD2, 0x89, 0x5F, 0x40 });
            Free(SkillPointsDetourAddress);
        }

        if (_clothing1Address > 5)
        {
            mem.WriteArrayMemory(_clothing1Address, new byte[] { 0x8B, 0x88, 0x88, 0x00,0x00, 0x00 });
            Free(Clothing1DetourAddress);
        }

        if (_clothing2Address > 0)
        {
            mem.WriteArrayMemory(_clothing2Address, new byte[] { 0x8B, 0xB8, 0x88, 0x00,0x00, 0x00 });
            Free(Clothing2DetourAddress);
        }

        if (_seasonalAddress > 0)
        {
            mem.WriteArrayMemory(_seasonalAddress, new byte[] { 0x49, 0x63, 0xC0, 0x8B, 0x44, 0x81, 0x60 });
            Free(SeasonalDetourAddress);
        }

        if (_emoteAddress > 0)
        {
            mem.WriteArrayMemory(_emoteAddress, new byte[] { 0x8B, 0x0C, 0xB8, 0x89, 0x8D, 0xB0, 0x00, 0x00, 0x00 });
            Free(EmoteDetourAddress);
        }

        if (_seriesAddress <= 0) return;
        mem.WriteArrayMemory(_seriesAddress, new byte[] { 0x89, 0x59, 0x14, 0x48, 0x83, 0xC4, 0x30 });
        Free(SeriesDetourAddress);
    }

    public void Reset()
    {
        var fields = typeof(UnlocksCheats).GetFields().Where(f => f.FieldType == typeof(UIntPtr));
        foreach (var field in fields)
        {
            field.SetValue(this, UIntPtr.Zero);
        }
    }

    public void Revert()
    {        
        var mem = GetInstance();
        
        if (_creditsAddress > 0)
        {
            mem.WriteArrayMemory(_creditsAddress, new byte[] { 0x48, 0x8B, 0x4F, 0x08, 0x33, 0xD2 });
        }

        if (_xpPointsAddress > 4)
        {
            mem.WriteArrayMemory(_xpPointsAddress, new byte[] { 0x8B, 0x89, 0x88, 0x00, 0x00, 0x00 });
        }

        if (_xpAddress > 0)
        {
            mem.WriteArrayMemory(_xpAddress, new byte[] { 0x41, 0x8B, 0x87, 0x8C, 0x00, 0x00, 0x00 });
        }

        if (_spinsAddress > 28)
        {
            mem.WriteArrayMemory(_spinsAddress, new byte[] { 0x33, 0xD2, 0x8B, 0x5F, 0x08 });
        }

        if (_bxmlEncryptionAddress > 29)
        {
            // ReSharper disable once UseUtf8StringLiteral
            mem.WriteArrayMemory(_bxmlEncryptionAddress, new byte[] { 0x33, 0xD2, 0x8B, 0x5F, 0x28 });
        }
        
        if (_skillPointsAddress > 34)
        {
            // ReSharper disable once UseUtf8StringLiteral
            mem.WriteArrayMemory(_skillPointsAddress, new byte[] { 0x33, 0xD2, 0x89, 0x5F, 0x40 });
        }

        if (_clothing1Address > 5)
        {
            mem.WriteArrayMemory(_clothing1Address, new byte[] { 0x8B, 0x88, 0x88, 0x00,0x00, 0x00 });
        }

        if (_clothing2Address > 0)
        {
            mem.WriteArrayMemory(_clothing2Address, new byte[] { 0x8B, 0xB8, 0x88, 0x00,0x00, 0x00 });
        }
        
        if (_seasonalAddress > 0)
        {
            mem.WriteArrayMemory(_seasonalAddress, new byte[] { 0x49, 0x63, 0xC0, 0x8B, 0x44, 0x81, 0x60 });
        }

        if (_seriesAddress <= 0) return;
        mem.WriteArrayMemory(_seriesAddress, new byte[] { 0x89, 0x59, 0x14, 0x48, 0x83, 0xC4, 0x30 });
    }

    public void Continue()
    {
        var mem = GetInstance();
        
        if (_creditsAddress > 0)
        {
            mem.WriteArrayMemory(_creditsAddress, CalculateDetour(_creditsAddress, CreditsDetourAddress, 6));
        }

        if (_xpPointsAddress > 4)
        {
            mem.WriteArrayMemory(_xpPointsAddress, CalculateDetour(_xpPointsAddress, XpPointsDetourAddress, 6));
        }

        if (_xpAddress > 0)
        {
            mem.WriteArrayMemory(_xpAddress, CalculateDetour(_xpAddress, XpDetourAddress, 7));
        }

        if (_spinsAddress > 28)
        {
            mem.WriteArrayMemory(_spinsAddress, CalculateDetour(_spinsAddress, SpinsDetourAddress, 5));
        }

        if (_bxmlEncryptionAddress > 29)
        {
            mem.WriteArrayMemory(_bxmlEncryptionAddress, CalculateDetour(_bxmlEncryptionAddress, BxmlEncryptionDetourAddress, 5));
        }
        
        if (_skillPointsAddress > 34)
        {
            mem.WriteArrayMemory(_skillPointsAddress, CalculateDetour(_skillPointsAddress, SkillPointsDetourAddress, 5));
        }

        if (_clothing1Address > 5)
        {
            mem.WriteArrayMemory(_clothing1Address, CalculateDetour(_clothing1Address, Clothing1DetourAddress, 6));
        }

        if (_clothing2Address > 0)
        {
            mem.WriteArrayMemory(_clothing2Address, CalculateDetour(_clothing2Address, Clothing2DetourAddress, 6));
        }
        
        if (_seasonalAddress > 0)
        {
            mem.WriteArrayMemory(_seasonalAddress, CalculateDetour(_seasonalAddress, SeasonalDetourAddress, 7));
        }

        if (_seriesAddress <= 0) return;
        mem.WriteArrayMemory(_seriesAddress, CalculateDetour(_seriesAddress, SeriesDetourAddress, 7));
    }
}