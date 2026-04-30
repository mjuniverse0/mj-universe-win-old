using static MA_FH5Trainer.Resources.Cheats;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Cheats.ForzaHorizon5;

public class MiscCheats : CheatsUtilities, ICheatsBase, IRevertBase
{
    private UIntPtr _nameAddress;
    public UIntPtr NameDetourAddress;
    private UIntPtr _sellFactorAddress;
    public UIntPtr SellFactorDetourAddress;
    private UIntPtr _prizeScaleAddress;
    public UIntPtr PrizeScaleDetourAddress;
    private UIntPtr _skillScoreMultiplierAddress;
    public UIntPtr SkillScoreMultiplierDetourAddress;
    private UIntPtr _driftScoreMultiplierAddress;
    public UIntPtr DriftScoreMultiplierDetourAddress;
    private UIntPtr _skillTreeWideEditAddress;
    public UIntPtr SkillTreeWideEditDetourAddress;
    private UIntPtr _skillTreePerksCostAddress;
    public UIntPtr SkillTreePerksCostDetourAddress;
    private UIntPtr _missionTimeScaleAddress;
    public UIntPtr MissionTimeScaleDetourAddress;
    private UIntPtr _trailblazerTimeScaleAddress;
    public UIntPtr TrailblazerTimeScaleDetourAddress;
    private UIntPtr _raceTimeScaleAddress;
    public UIntPtr RaceTimeScaleDetourAddress;
    private UIntPtr _speedZoneMultiplierAddress;
    public UIntPtr SpeedZoneMultiplierDetourAddress;
    private UIntPtr _unbreakableSkillScoreAddress;
    public UIntPtr UnbreakableSkillScoreDetourAddress;
    private UIntPtr _removeBuildCapAddress;
    public UIntPtr RemoveBuildCapDetourAddress;
    private UIntPtr _dangerSign1Address;
    public UIntPtr DangerSign1DetourAddress;
    private UIntPtr _dangerSign2Address;
    public UIntPtr DangerSign2DetourAddress;
    private UIntPtr _dangerSign3Address;
    public UIntPtr DangerSign3DetourAddress;
    private UIntPtr _speedTrapMultiplierAddress;
    public UIntPtr SpeedTrapMultiplierDetourAddress;
    private UIntPtr _droneModeMaxHeightMultiAddress;
    public UIntPtr DroneModeMaxHeightMultiDetourAddress;

    public async Task CheatName()
    {
        _nameAddress = 0;
        NameDetourAddress = 0;

        const string sig = "90 48 8B ? ? EB ? 48 8D ? ? 48 89";
        _nameAddress = await SmartAobScan(sig);
        
        if (_nameAddress > 0)
        {
            _nameAddress -= 61;

            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }

            if (GetClass<Bypass>().CallAddress <= 3) return;

            var namePtr = await CheatNamePtr();
            if (namePtr == 0) return;

            var ptrBytes = BitConverter.GetBytes(namePtr);
            var asm = new byte[]
            {
                0x80, 0x3D, 0x4E, 0x00, 0x00, 0x00, 0x01, 0x75, 0x40, 0x48, 0xBA, ptrBytes[0], ptrBytes[1], ptrBytes[2],
                ptrBytes[3], ptrBytes[4], ptrBytes[5], ptrBytes[6], ptrBytes[7], 0x48, 0x8B, 0x12, 0x48, 0x8B, 0x92,
                0xF0, 0x00, 0x00, 0x00, 0x48, 0x85, 0xD2, 0x74, 0x27, 0x48, 0x8B, 0x52, 0x30, 0x48, 0x85, 0xD2, 0x74,
                0x1E, 0x48, 0x8B, 0x52, 0x30, 0x48, 0x85, 0xD2, 0x74, 0x15, 0x48, 0x8B, 0x52, 0x08, 0x48, 0x85, 0xD2,
                0x74, 0x0C, 0x48, 0x39, 0xD0, 0x75, 0x07, 0x48, 0x8D, 0x05, 0x0D, 0x00, 0x00, 0x00, 0x48, 0x8B, 0xD0,
                0x48, 0x8D, 0x4D, 0x17
            };

            NameDetourAddress = GetInstance().CreateDetour(_nameAddress, asm, 7);
            return;
        }
        
        ShowError("Name Spoofer", sig);
    }

    private static async Task<UIntPtr> CheatNamePtr()
    {
        const string sig = "E8 ? ? ? ? 4C 8B ? 48 8B ? 41 FF ? ? 48 8B ? 48 85 ? 74 ? 48 8B ? 48 8B ? FF 90";
        var scanResult = (IntPtr)await SmartAobScan(sig);

        if (scanResult > 0)
        {
            var relativeAddress = scanResult + 1;
            var relative = GetInstance().ReadMemory<int>((nuint)relativeAddress);
            scanResult = scanResult + relative + 0x5;
            var relativeAddress2 = scanResult + 3;
            var relative2 = GetInstance().ReadMemory<int>((nuint)relativeAddress2);
            return (nuint)(scanResult + relative2 + 0x7);
        }

        ShowError("Name Ptr", sig);
        return 0;
    }

    public async Task CheatPrizeScale()
    {
        _prizeScaleAddress = 0;
        PrizeScaleDetourAddress = 0;

        const string sig = "F3 0F ? ? ? 33 D2 48 8B ? ? E8 ? ? ? ? 90 48 85 ? 74 ? 8B C5";
        _prizeScaleAddress = await SmartAobScan(sig);

        if (_prizeScaleAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
                
            var asm = new byte[]
            {
                0xF3, 0x0F, 0x10, 0x73, 0x10, 0x80, 0x3D, 0x0F, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x10,
                0x35, 0x06, 0x00, 0x00, 0x00
            };

            PrizeScaleDetourAddress = GetInstance().CreateDetour(_prizeScaleAddress, asm, 5);
            return;
        }
        
        ShowError("Spin prize scale", sig);
    }

    public async Task CheatSellFactor()
    {
        _sellFactorAddress = 0;
        SellFactorDetourAddress = 0;

        const string sig = "44 8B ? ? ? ? ? 33 D2 48 8B ? ? ? ? ? E8 ? ? ? ? 90";
        _sellFactorAddress = await SmartAobScan(sig);

        if (_sellFactorAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x44, 0x8B, 0xB3, 0x80, 0x00, 0x00, 0x00, 0x80, 0x3D, 0x0E, 0x00, 0x00, 0x00, 0x01, 0x75, 0x07, 0x44,
                0x8B, 0x35, 0x06, 0x00, 0x00, 0x00
            };

            SellFactorDetourAddress = GetInstance().CreateDetour(_sellFactorAddress, asm, 7);
            return;
        }
        
        ShowError("Sell factor", sig);
    }

    public async Task CheatSkillScoreMultiplier()
    {
        _skillScoreMultiplierAddress = 0;
        SkillScoreMultiplierDetourAddress = 0;
        
        const string sig = "8B 78 ? 48 8B ? ? 48 85 ? 74 ? 41 8B";
        _skillScoreMultiplierAddress = await SmartAobScan(sig);

        if (_skillScoreMultiplierAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x8B, 0x78, 0x08, 0x48, 0x8B, 0x4D, 0x60, 0x80, 0x3D, 0x0E, 0x00, 0x00, 0x00, 0x01, 0x75, 0x07, 0x0F,
                0xAF, 0x3D, 0x06, 0x00, 0x00, 0x00
            };

            SkillScoreMultiplierDetourAddress = GetInstance().CreateDetour(_skillScoreMultiplierAddress, asm, 7);
            return;
        }
        
        ShowError("Skill score multiplier", sig);
    }
    
    public async Task CheatDriftScoreMultiplier()
    {
        _driftScoreMultiplierAddress = 0;
        DriftScoreMultiplierDetourAddress = 0;
        
        const string sig = "E8 ? ? ? ? F3 0F ? ? 0F 28 ? ? ? 0F 28";
        _driftScoreMultiplierAddress = await SmartAobScan(sig) + 5;

        if (_driftScoreMultiplierAddress > 5)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x18, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x59, 0x3D, 0x0F, 0x00, 0x00, 0x00,
                0xF3, 0x0F, 0x58, 0xF7, 0x0F, 0x28, 0x7C, 0x24, 0x20
            };

            DriftScoreMultiplierDetourAddress = GetInstance().CreateDetour(_driftScoreMultiplierAddress, asm, 9);
            return;
        }
        
        ShowError("Drift score multiplier", sig);
    }
    
    public async Task CheatSkillTreeWideEdit()
    {
        _skillTreeWideEditAddress = 0;
        SkillTreeWideEditDetourAddress = 0;
        
        const string sig = "40 ? 48 83 EC ? 48 8B ? ? 33 D2 0F 29";
        _skillTreeWideEditAddress = await SmartAobScan(sig) + 32;

        if (_skillTreeWideEditAddress > 32)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0xF3, 0x0F, 0x10, 0x73, 0x40, 0x80, 0x3D, 0x0F, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x10,
                0x35, 0x06, 0x00, 0x00, 0x00
            };

            SkillTreeWideEditDetourAddress = GetInstance().CreateDetour(_skillTreeWideEditAddress, asm, 5);
            return;
        }
        
        ShowError("Skill tree wide edit", sig);
    }
    
    public async Task CheatSkillTreePerksCost()
    {
        _skillTreePerksCostAddress = 0;
        SkillTreePerksCostDetourAddress = 0;
        
        const string sig = "48 89 5C 24 08 57 48 83 EC 20 48 8B 79 18 33 D2 48 8B 4F 28";
        _skillTreePerksCostAddress = await SmartAobScan(sig) + 29;

        if (_skillTreePerksCostAddress > 29)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x31, 0xD2, 0x8B, 0x5F, 0x20, 0x80, 0x3D, 0x0E, 0x00, 0x00, 0x00, 0x01, 0x75, 0x07, 0x48, 0x8B, 0x1D,
                0x06, 0x00, 0x00, 0x00
            };

            SkillTreePerksCostDetourAddress = GetInstance().CreateDetour(_skillTreePerksCostAddress, asm, 5);
            return;
        }
        
        ShowError("Skill tree perks cost", sig);
    }
    
    public async Task CheatMissionTimeScale()
    {
        _missionTimeScaleAddress = 0;
        MissionTimeScaleDetourAddress = 0;
        
        const string sig = "F3 0F ? ? F3 0F ? ? ? ? ? ? 0F 2F ? 0F 87 ? ? ? ? C7 ? ? ? ? ? 00 00 00 00";
        _missionTimeScaleAddress = await SmartAobScan(sig);

        if (_missionTimeScaleAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x1B, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x59, 0x3D, 0x12, 0x00, 0x00, 0x00,
                0xF3, 0x0F, 0x5C, 0xC7, 0xF3, 0x0F, 0x11, 0x87, 0x0C, 0x04, 0x00, 0x00
            };

            MissionTimeScaleDetourAddress = GetInstance().CreateDetour(_missionTimeScaleAddress, asm, 12);
            return;
        }
        
        ShowError("Mission time scale", sig);
    }
    
    public async Task CheatSpeedZoneMultiplier()
    {
        _speedZoneMultiplierAddress = 0;
        SpeedZoneMultiplierDetourAddress = 0;
        
        const string sig = "F3 41 ? ? ? ? ? ? ? 0F 28 ? 0F 28 ? ? ? 48 83 C4";
        _speedZoneMultiplierAddress = await SmartAobScan(sig);

        if (_speedZoneMultiplierAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x18, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x59, 0x35, 0x0F, 0x00, 0x00, 0x00,
                0xF3, 0x41, 0x0F, 0x5E, 0xB7, 0xE8, 0x00, 0x00, 0x00
            };

            SpeedZoneMultiplierDetourAddress = GetInstance().CreateDetour(_speedZoneMultiplierAddress, asm, 9);
            return;
        }
        
        ShowError("Speedzone multiplier", sig);
    }
    
    public async Task CheatTrailblazerTimeScale()
    {
        _trailblazerTimeScaleAddress = 0;
        TrailblazerTimeScaleDetourAddress = 0;
        
        const string sig = "F3 0F ? ? F3 0F ? ? ? ? ? ? 4C 8D ? ? ? ? ? F3 0F ? ? 33 D2";
        _trailblazerTimeScaleAddress = await SmartAobScan(sig);

        if (_trailblazerTimeScaleAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x1B, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x59, 0x05, 0x12, 0x00, 0x00, 0x00,
                0xF3, 0x0F, 0x58, 0xF8, 0xF3, 0x0F, 0x11, 0xBF, 0xAC, 0x03, 0x00, 0x00
            };

            TrailblazerTimeScaleDetourAddress = GetInstance().CreateDetour(_trailblazerTimeScaleAddress, asm, 12);
            return;
        }
        
        ShowError("Trailblazer time scale", sig);
    }
    
    public async Task CheatUnbreakableSkillScore()
    {
        _unbreakableSkillScoreAddress = 0;
        UnbreakableSkillScoreDetourAddress = 0;
        
        const string sig = "0F B6 ? 40 38 ? ? ? ? ? 74 ? 84 C0";
        _unbreakableSkillScoreAddress = await SmartAobScan(sig);

        if (_unbreakableSkillScoreAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x13, 0x00, 0x00, 0x00, 0x01, 0x75, 0x02, 0x30, 0xC0, 0x0F, 0xB6, 0xF0, 0x40, 0x38, 0xAF,
                0x74, 0x02, 0x00, 0x00
            };

            UnbreakableSkillScoreDetourAddress = GetInstance().CreateDetour(_unbreakableSkillScoreAddress, asm, 10);
            return;
        }
        
        ShowError("Unbreakable skill score", sig);
    }

    public async Task CheatRaceTimeScale()
    {
        _raceTimeScaleAddress = 0;
        RaceTimeScaleDetourAddress = 0;

        const string sig = "40 ? 48 83 EC ? 48 8B ? 48 8B ? 0F 29 ? ? ? 0F 28 ? FF 50 ? 0F 57";
        _raceTimeScaleAddress = await SmartAobScan(sig) + 29;

        if (_raceTimeScaleAddress > 29)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }

            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0xF3, 0x0F, 0x5A, 0xCE, 0x80, 0x3D, 0x29, 0x00, 0x00, 0x00, 0x01, 0x75, 0x1E, 0x48, 0x83, 0xEC, 0x10,
                0xF3, 0x0F, 0x7F, 0x14, 0x24, 0xF3, 0x0F, 0x5A, 0x15, 0x17, 0x00, 0x00, 0x00, 0xF2, 0x0F, 0x59, 0xCA,
                0xF3, 0x0F, 0x6F, 0x14, 0x24, 0x48, 0x83, 0xC4, 0x10, 0xF2, 0x0F, 0x58, 0xC8
            };

            RaceTimeScaleDetourAddress = GetInstance().CreateDetour(_raceTimeScaleAddress, asm, 8);
            return;
        }
        
        ShowError("Race Time Scale", sig);
    }
    
    public async Task CheatRemoveBuildCap()
    {
        _removeBuildCapAddress = 0;
        RemoveBuildCapDetourAddress = 0;
        
        const string sig = "E8 ? ? ? ? F3 0F ? ? ? 48 8B ? ? ? 48 8B";
        _removeBuildCapAddress = await SmartAobScan(sig) + 5;

        if (_removeBuildCapAddress > 5)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x0F, 0x00, 0x00, 0x00, 0x01, 0x75, 0x03, 0x0F, 0x57, 0xC0, 0xF3, 0x0F, 0x11, 0x43, 0x44
            };

            RemoveBuildCapDetourAddress = GetInstance().CreateDetour(_removeBuildCapAddress, asm, 5);
            return;
        }
        
        ShowError("Remove build cap", sig);
    }

    public async Task CheatDangerSignMultiplier()
    {
        _dangerSign1Address = 0;
        DangerSign1DetourAddress = 0;
        _dangerSign2Address = 0;
        DangerSign2DetourAddress = 0;
        _dangerSign3Address = 0;
        DangerSign3DetourAddress = 0;
        
        const string dangerSign1Sig = "0F 51 ? F3 0F ? ? ? ? ? ? 0F 28 ? 48 8B";
        _dangerSign1Address = await SmartAobScan(dangerSign1Sig) + 3;
        if (_dangerSign1Address > 3)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x80, 0x3D, 0x30, 0x00, 0x00, 0x00, 0x01, 0x75, 0x21, 0x48, 0x83, 0xEC, 0x10, 0xF3, 0x0F, 0x7F, 0x0C,
                0x24, 0xF3, 0x0F, 0x10, 0x0D, 0x1E, 0x00, 0x00, 0x00, 0x0F, 0xC6, 0xC9, 0x00, 0x0F, 0x59, 0xC1, 0xF3,
                0x0F, 0x6F, 0x0C, 0x24, 0x48, 0x83, 0xC4, 0x10, 0xF3, 0x0F, 0x11, 0x86, 0xB4, 0x03, 0x00, 0x00
            };

            DangerSign1DetourAddress = GetInstance().CreateDetour(_dangerSign1Address, asm, 8);
        }
        else
        {
            ShowError("Danger Sign Multiplier", dangerSign1Sig);
            return;
        }

        var newScanStart = _dangerSign1Address - 0x1000;
        var newScanEnd = _dangerSign1Address + 0x1000;
        
        const string dangerSign2Sig = "0F 29 ? ? ? 49 8B ? 49 8B ? 48 8B ? ? ? ? ? 48 85";
        _dangerSign2Address = await SmartAobScan(dangerSign2Sig, newScanStart, newScanEnd);
        if (_dangerSign2Address > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;
            
            var asm = new byte[]
            {
                0x80, 0x3D, 0x2D, 0x00, 0x00, 0x00, 0x01, 0x75, 0x21, 0x48, 0x83, 0xEC, 0x10, 0xF3, 0x0F, 0x7F, 0x0C,
                0x24, 0xF3, 0x0F, 0x10, 0x0D, 0x1B, 0x00, 0x00, 0x00, 0x0F, 0xC6, 0xC9, 0x00, 0x0F, 0x59, 0xC1, 0xF3,
                0x0F, 0x6F, 0x0C, 0x24, 0x48, 0x83, 0xC4, 0x10, 0x0F, 0x29, 0x44, 0x24, 0x50
            };

            DangerSign2DetourAddress = GetInstance().CreateDetour(_dangerSign2Address, asm, 5);
        }
        else
        {
            ShowError("Danger Sign Multiplier", dangerSign2Sig);
            return;
        }
        
        
        const string dangerSign3Sig = "0F 29 ? ? ? 49 8B ? 48 8B ? ? ? ? ? 48 85";
        _dangerSign3Address = await SmartAobScan(dangerSign3Sig, newScanStart, newScanEnd);
        if (_dangerSign3Address > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x2D, 0x00, 0x00, 0x00, 0x01, 0x75, 0x21, 0x48, 0x83, 0xEC, 0x10, 0xF3, 0x0F, 0x7F, 0x0C,
                0x24, 0xF3, 0x0F, 0x10, 0x0D, 0x1B, 0x00, 0x00, 0x00, 0x0F, 0xC6, 0xC9, 0x00, 0x0F, 0x59, 0xC1, 0xF3,
                0x0F, 0x6F, 0x0C, 0x24, 0x48, 0x83, 0xC4, 0x10, 0x0F, 0x29, 0x44, 0x24, 0x50
            };

            DangerSign3DetourAddress = GetInstance().CreateDetour(_dangerSign3Address, asm, 5);
        }
        else
        {
            ShowError("Danger Sign Multiplier", dangerSign3Sig);
        }
    }

    public async Task CheatSpeedTrapMultiplier()
    {
        _speedTrapMultiplierAddress = 0;
        SpeedTrapMultiplierDetourAddress = 0;

        const string sig = "0F 29 ? ? ? 48 8B ? 48 8B ? ? ? ? ? 48 85 ? 74";
        _speedTrapMultiplierAddress = await SmartAobScan(sig);
        if (_speedTrapMultiplierAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x2D, 0x00, 0x00, 0x00, 0x01, 0x75, 0x21, 0x48, 0x83, 0xEC, 0x10, 0xF3, 0x0F, 0x7F, 0x0C,
                0x24, 0xF3, 0x0F, 0x10, 0x0D, 0x1B, 0x00, 0x00, 0x00, 0x0F, 0xC6, 0xC9, 0x00, 0x0F, 0x59, 0xC1, 0xF3,
                0x0F, 0x6F, 0x0C, 0x24, 0x48, 0x83, 0xC4, 0x10, 0x0F, 0x29, 0x44, 0x24, 0x30
            };

            SpeedTrapMultiplierDetourAddress = GetInstance().CreateDetour(_speedTrapMultiplierAddress, asm, 5);
            return;
        }
        
        ShowError("Speed Trap Multiplier", sig);
    }

    public async Task CheatDroneModeMaxHeightMulti()
    {
        _droneModeMaxHeightMultiAddress = 0;
        DroneModeMaxHeightMultiDetourAddress = 0;

        const string sig = "0F 57 ? 41 0F ? ? 73 ? 0F 28 ? 0F 57 ? F3 0F ? ? ? ? F3 0F";
        _droneModeMaxHeightMultiAddress = await SmartAobScan(sig);
        if (_droneModeMaxHeightMultiAddress > 0)
        {
            if (GetClass<Bypass>().CallAddress <= 3)
            {
                await GetClass<Bypass>().DisableCrcChecks();
            }
            
            if (GetClass<Bypass>().CallAddress <= 3) return;

            var asm = new byte[]
            {
                0x80, 0x3D, 0x16, 0x00, 0x00, 0x00, 0x01, 0x75, 0x08, 0xF3, 0x0F, 0x59, 0x05, 0x0D, 0x00, 0x00, 0x00,
                0x0F, 0x57, 0xC9, 0x41, 0x0F, 0x2F, 0xC2
            };

            DroneModeMaxHeightMultiDetourAddress = GetInstance().CreateDetour(_droneModeMaxHeightMultiAddress, asm, 7);
            return;
        }
        
        ShowError("Drone Mode Max Height Multi", sig);
    }
    
    public void Cleanup()
    {
        var mem = GetInstance();
        
        if (_nameAddress > 0)
        {
            mem.WriteArrayMemory(_nameAddress, new byte[] { 0x48, 0x8B, 0xD0, 0x48, 0x8D, 0x4D, 0x17 });
            Free(NameDetourAddress);
        }

        if (_prizeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_prizeScaleAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x73, 0x10 });
            Free(PrizeScaleDetourAddress);
        }

        if (_sellFactorAddress > 0)
        {
            mem.WriteArrayMemory(_sellFactorAddress, new byte[] { 0x44, 0x8B, 0xB3, 0x80, 0x00, 0x00, 0x00 });
            Free(SellFactorDetourAddress);
        }

        if (_skillScoreMultiplierAddress > 0)
        {
            mem.WriteArrayMemory(_skillScoreMultiplierAddress, new byte[] { 0x8B, 0x78, 0x08, 0x48, 0x8B, 0x4D, 0x60 });
            Free(SkillScoreMultiplierDetourAddress);
        }

        if (_driftScoreMultiplierAddress > 5)
        {
            mem.WriteArrayMemory(_driftScoreMultiplierAddress, new byte[] { 0xF3, 0x0F, 0x58, 0xF7, 0x0F, 0x28, 0x7C, 0x24, 0x20 });
            Free(DriftScoreMultiplierDetourAddress);
        }

        if (_skillTreeWideEditAddress > 32)
        {
            mem.WriteArrayMemory(_skillTreeWideEditAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x73, 0x40 });
            Free(SkillTreeWideEditDetourAddress);
        }

        if (_skillTreePerksCostAddress > 32)
        {
            // ReSharper disable once UseUtf8StringLiteral
            mem.WriteArrayMemory(_skillTreePerksCostAddress, new byte[] { 0x33, 0xD2, 0x8B, 0x5F, 0x20 });
            Free(SkillTreePerksCostDetourAddress);
        }

        if (_missionTimeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_missionTimeScaleAddress, new byte[] { 0xF3, 0x0F, 0x5C, 0xC7, 0xF3, 0x0F, 0x11, 0x87, 0x0C, 0x04, 0x00, 0x00 });
            Free(MissionTimeScaleDetourAddress);
        }

        if (_trailblazerTimeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_trailblazerTimeScaleAddress, new byte[] { 0xF3, 0x0F, 0x58, 0xF8, 0xF3, 0x0F, 0x11, 0xBF, 0xAC, 0x03, 0x00, 0x00 });
            Free(TrailblazerTimeScaleDetourAddress);
        }

        if (_speedZoneMultiplierAddress > 0)
        {
            mem.WriteArrayMemory(_speedZoneMultiplierAddress, new byte[] { 0xF3, 0x41, 0x0F, 0x5E, 0xB7, 0xE8, 0x00, 0x00, 0x00 });
            Free(SpeedZoneMultiplierDetourAddress);
        }

        if (_unbreakableSkillScoreAddress > 0)
        {
            mem.WriteArrayMemory(_unbreakableSkillScoreAddress, new byte[] { 0x0F, 0xB6, 0xF0, 0x40, 0x38, 0xAF, 0x74, 0x02, 0x00, 0x00 });
            Free(UnbreakableSkillScoreDetourAddress);
        }

        if (_raceTimeScaleAddress > 29)
        {
            mem.WriteArrayMemory(_raceTimeScaleAddress, new byte[] { 0xF3, 0x0F, 0x5A, 0xCE, 0xF2, 0x0F, 0x58, 0xC8 });
            Free(RaceTimeScaleDetourAddress);
        }

        if (DangerSign1DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign1Address, new byte[] { 0xF3, 0x0F, 0x11, 0x86, 0xB4, 0x03, 0x00, 0x00 });
            Free(DangerSign1DetourAddress);
        }

        if (DangerSign2DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign2Address, new byte[] { 0x0F, 0x29, 0x44, 0x24, 0x50 });
            Free(DangerSign2DetourAddress);
        }

        if (DangerSign3DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign3Address, new byte[] { 0x0F, 0x29, 0x44, 0x24, 0x50 });
            Free(DangerSign3DetourAddress);
        }

        if (SpeedTrapMultiplierDetourAddress > 0)
        {
            mem.WriteArrayMemory(_speedTrapMultiplierAddress, new byte[] { 0x0F, 0x29, 0x44, 0x24, 0x30 });
            Free(SpeedTrapMultiplierDetourAddress);
        }

        if (DroneModeMaxHeightMultiDetourAddress > 0)
        {
            mem.WriteArrayMemory(_droneModeMaxHeightMultiAddress, new byte[] { 0x0F, 0x57, 0xC9, 0x41, 0x0F, 0x2F, 0xC2 });
            Free(DroneModeMaxHeightMultiDetourAddress);
        }

        if (_removeBuildCapAddress <= 5) return;
        mem.WriteArrayMemory(_removeBuildCapAddress, new byte[] { 0xF3, 0x0F, 0x11, 0x43, 0x44 });
        Free(RemoveBuildCapDetourAddress);
    }

    public void Reset()
    {
        var fields = typeof(MiscCheats).GetFields().Where(f => f.FieldType == typeof(UIntPtr));
        foreach (var field in fields)
        {
            field.SetValue(this, UIntPtr.Zero);
        }
    }

    public void Revert()
    {
        var mem = GetInstance();
        
        if (_nameAddress > 0)
        {
            mem.WriteArrayMemory(_nameAddress, new byte[] { 0x48, 0x8B, 0xD0, 0x48, 0x8D, 0x4D, 0x17 });
        }

        if (_prizeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_prizeScaleAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x73, 0x10 });
        }

        if (_sellFactorAddress > 0)
        {
            mem.WriteArrayMemory(_sellFactorAddress, new byte[] { 0x44, 0x8B, 0xB3, 0x80, 0x00, 0x00, 0x00 });
        }

        if (_skillScoreMultiplierAddress > 0)
        {
            mem.WriteArrayMemory(_skillScoreMultiplierAddress, new byte[] { 0x8B, 0x78, 0x08, 0x48, 0x8B, 0x4D, 0x60 });
        }

        if (_driftScoreMultiplierAddress > 5)
        {
            mem.WriteArrayMemory(_driftScoreMultiplierAddress, new byte[] { 0xF3, 0x0F, 0x58, 0xF7, 0x0F, 0x28, 0x7C, 0x24, 0x20 });
        }

        if (_skillTreeWideEditAddress > 32)
        {
            mem.WriteArrayMemory(_skillTreeWideEditAddress, new byte[] { 0xF3, 0x0F, 0x10, 0x73, 0x48 });
        }

        if (_skillTreePerksCostAddress > 32)
        {
            // ReSharper disable once UseUtf8StringLiteral
            mem.WriteArrayMemory(_skillTreePerksCostAddress, new byte[] { 0x33, 0xD2, 0x8B, 0x5F, 0x28 });
        }

        if (_missionTimeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_missionTimeScaleAddress, new byte[] { 0xF3, 0x0F, 0x5C, 0xC7, 0xF3, 0x0F, 0x11, 0x87, 0x0C, 0x04, 0x00, 0x00 });
        }

        if (_trailblazerTimeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_trailblazerTimeScaleAddress, new byte[] { 0xF3, 0x0F, 0x58, 0xF8, 0xF3, 0x0F, 0x11, 0xBF, 0xAC, 0x03, 0x00, 0x00 });
        }

        if (_speedZoneMultiplierAddress > 0)
        {
            mem.WriteArrayMemory(_speedZoneMultiplierAddress, new byte[] { 0xF3, 0x41, 0x0F, 0x5E, 0xB7, 0xE8, 0x00, 0x00, 0x00 });
        }

        if (_unbreakableSkillScoreAddress > 0)
        {
            mem.WriteArrayMemory(_unbreakableSkillScoreAddress, new byte[] { 0x0F, 0xB6, 0xF0, 0x40, 0x38, 0xAF, 0x74, 0x02, 0x00, 0x00 });
        }

        if (_raceTimeScaleAddress > 29)
        {
            mem.WriteArrayMemory(_raceTimeScaleAddress, new byte[] { 0xF3, 0x0F, 0x5A, 0xCE, 0xF2, 0x0F, 0x58, 0xC8 });
        }

        if (DangerSign1DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign1Address, new byte[] { 0xF3, 0x0F, 0x11, 0x86, 0xB4, 0x03, 0x00, 0x00 });
        }

        if (DangerSign2DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign2Address, new byte[] { 0x0F, 0x29, 0x44, 0x24, 0x50 });
        }

        if (DangerSign3DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign3Address, new byte[] { 0x0F, 0x29, 0x44, 0x24, 0x50 });
        }

        if (SpeedTrapMultiplierDetourAddress > 0)
        {
            mem.WriteArrayMemory(_speedTrapMultiplierAddress, new byte[] { 0x0F, 0x29, 0x44, 0x24, 0x30 });
        }

        if (DroneModeMaxHeightMultiDetourAddress > 0)
        {
            mem.WriteArrayMemory(_droneModeMaxHeightMultiAddress, new byte[] { 0x0F, 0x57, 0xC9, 0x41, 0x0F, 0x2F, 0xC2 });
        }

        if (_removeBuildCapAddress <= 5) return;
        mem.WriteArrayMemory(_removeBuildCapAddress, new byte[] { 0xF3, 0x0F, 0x11, 0x43, 0x44 });
    }

    public void Continue()
    {
        var mem = GetInstance();
        
        if (_nameAddress > 0)
        {
            mem.WriteArrayMemory(_nameAddress, CalculateDetour(_nameAddress, NameDetourAddress, 7));
        }

        if (_prizeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_prizeScaleAddress, CalculateDetour(_prizeScaleAddress, PrizeScaleDetourAddress, 5));
        }

        if (_sellFactorAddress > 0)
        {
            mem.WriteArrayMemory(_sellFactorAddress, CalculateDetour(_sellFactorAddress, SellFactorDetourAddress, 7));
        }

        if (_skillScoreMultiplierAddress > 0)
        {
            mem.WriteArrayMemory(_skillScoreMultiplierAddress, CalculateDetour(_skillScoreMultiplierAddress, SkillScoreMultiplierDetourAddress, 7));
        }

        if (_driftScoreMultiplierAddress > 5)
        {
            mem.WriteArrayMemory(_driftScoreMultiplierAddress, CalculateDetour(_driftScoreMultiplierAddress, DriftScoreMultiplierDetourAddress, 9));
        }

        if (_skillTreeWideEditAddress > 32)
        {
            mem.WriteArrayMemory(_skillTreeWideEditAddress, CalculateDetour(_skillTreeWideEditAddress, SkillTreeWideEditDetourAddress, 5));
        }

        if (_skillTreePerksCostAddress > 32)
        {
            mem.WriteArrayMemory(_skillTreePerksCostAddress, CalculateDetour(_skillTreePerksCostAddress, SkillTreePerksCostDetourAddress, 5));
        }

        if (_missionTimeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_missionTimeScaleAddress, CalculateDetour(_missionTimeScaleAddress, MissionTimeScaleDetourAddress, 12));
        }

        if (_trailblazerTimeScaleAddress > 0)
        {
            mem.WriteArrayMemory(_trailblazerTimeScaleAddress, CalculateDetour(_trailblazerTimeScaleAddress, TrailblazerTimeScaleDetourAddress, 12));
        }

        if (_speedZoneMultiplierAddress > 0)
        {
            mem.WriteArrayMemory(_speedZoneMultiplierAddress, CalculateDetour(_speedZoneMultiplierAddress, SpeedZoneMultiplierDetourAddress, 9));
        }

        if (_unbreakableSkillScoreAddress > 0)
        {
            mem.WriteArrayMemory(_unbreakableSkillScoreAddress, CalculateDetour(_unbreakableSkillScoreAddress, UnbreakableSkillScoreDetourAddress, 10));
        }

        if (_raceTimeScaleAddress > 29)
        {
            mem.WriteArrayMemory(_raceTimeScaleAddress, CalculateDetour(_raceTimeScaleAddress, RaceTimeScaleDetourAddress, 8));
        }

        if (DangerSign1DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign1Address, CalculateDetour(_dangerSign1Address, DangerSign1DetourAddress, 8));
        }

        if (DangerSign2DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign2Address, CalculateDetour(_dangerSign2Address, DangerSign2DetourAddress, 5));
        }

        if (DangerSign3DetourAddress > 0)
        {
            mem.WriteArrayMemory(_dangerSign3Address, CalculateDetour(_dangerSign3Address, DangerSign3DetourAddress, 5));
        }

        if (SpeedTrapMultiplierDetourAddress > 0)
        {
            mem.WriteArrayMemory(_speedTrapMultiplierAddress, CalculateDetour(_speedTrapMultiplierAddress, SpeedTrapMultiplierDetourAddress, 5));
        }

        if (DroneModeMaxHeightMultiDetourAddress > 0)
        {
            mem.WriteArrayMemory(_droneModeMaxHeightMultiAddress, CalculateDetour(_droneModeMaxHeightMultiAddress, DroneModeMaxHeightMultiDetourAddress, 7));
        }
        
        if (_removeBuildCapAddress <= 5) return;
        mem.WriteArrayMemory(_removeBuildCapAddress, CalculateDetour(_removeBuildCapAddress, RemoveBuildCapDetourAddress, 5));
    }
}