using System.Windows;
using MA_FH5Trainer.Models;
using MahApps.Metro.Controls;
using Memory;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Cheats;

public class CheatsUtilities
{
    protected static async Task<nuint> SmartAobScan(string search, UIntPtr? start = null, UIntPtr? end = null)
    {
        //Imps.GetSystemInfo(out var info);

        //var handle = GetInstance().MProc.Handle;
        var minRange = (long)GetInstance().MProc.Process.MainModule!.BaseAddress;
        var maxRange = minRange + GetInstance().MProc.Process.MainModule!.ModuleMemorySize;

        if (start != null)
        {
            minRange = (long)start;
        }
        
        if (end != null)
        {
            maxRange = (long)end;
        }
        
        return (await GetInstance().AoBScan(minRange, maxRange, search, false, true, false, 1)).FirstOrDefault();
    }
    
    protected static void ShowError(string feature, string sig)
    {
        MessageBox.Show(
            $"Address for this feature wasn't found!\nPlease try to activate the cheat again or try to restart the game and the tool.\n\nIf this error still occurs, please (Press Ctrl+C) to copy, and make an issue on the GitHub repository or post the copied text in the in our discord server (discord.gg/rHzev9brJ3).\n\nFeature: {feature}\nSignature: {sig}\n\nTool Version: {System.Reflection.Assembly.GetExecutingAssembly().GetName().Version}\nGame: {GameVerPlat.GetInstance().Name}\nGame Version: {GameVerPlat.GetInstance().Update}\nPlatform: {GameVerPlat.GetInstance().Platform}",
            $"MA_FH5Trainer - Error", 0, MessageBoxImage.Error);
    }

    protected static void Free(UIntPtr address)
    {
        if (address == 0) return;
        var handle = GetInstance().MProc.Handle;
        Imps.VirtualFreeEx(handle, address,0, Imps.MemRelease);
    }
    
    protected static byte[] CalculateDetour(nuint address, nuint target, int replaceCount)
    {
        var detourBytes = new byte[replaceCount];
        detourBytes[0] = 0xE9;
        BitConverter.GetBytes((int)((long)target - (long)address - 5)).CopyTo(detourBytes, 1);
        
        for (var i = 5; i < detourBytes.Length; i++)
        {
            detourBytes[i] = 0x90;
        }

        return detourBytes;
    }
}