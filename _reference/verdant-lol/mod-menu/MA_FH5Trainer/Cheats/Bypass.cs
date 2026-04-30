using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Cheats.ForzaHorizon5;

public class Bypass : CheatsUtilities, ICheatsBase
{
    public UIntPtr CallAddress;
    
    private bool m_applied;
    private bool m_scanning;
    private static readonly object s_Lock = new();
    
    public async Task DisableCrcChecks()
    {
        lock (s_Lock)
        {
            if (m_scanning || m_applied)
            {
                return;
            }

            m_scanning = true;
        }
        
        var callAddress = await SmartAobScan("4C 3B ? 0F 95 ? 0F 94");
        if (callAddress == 0)
        {
            ShowError("CRC", "CallAddress == 0");
            lock (s_Lock)
            {
                m_scanning = false;
            }
            return;
        }

        lock (s_Lock)
        {
            CallAddress = callAddress;
            byte[] patch = [0x48, 0x39, 0xFF];
            GetInstance().WriteArrayMemory(CallAddress, patch);
            m_scanning = false;
            m_applied = true;
        }
    }
    
    public void Cleanup()
    {
        lock (s_Lock)
        {
            byte[] orig = [0x4C, 0x3B, 0xEF];
            GetInstance().WriteArrayMemory(CallAddress, orig);
        }

        Reset();
    }

    public void Reset()
    {
        lock (s_Lock)
        {
            m_scanning = false;
            m_applied = false;
            CallAddress = 0;
        }
    }
}