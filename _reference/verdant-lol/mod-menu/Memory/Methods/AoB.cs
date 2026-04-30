using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics.X86;
using System.Threading.Tasks;
using Memory.Types;
using Reloaded.Memory.Sigscan;
using Reloaded.Memory.Sigscan.Definitions.Structs;
using static Memory.Imps;

namespace Memory;

public partial class Mem
{
    public Task<IEnumerable<nuint>> AoBScan(long start, long end, string search, bool writable = false, bool executable = true, bool mapped = false, int resultLimit = -1)
    {
        return AoBScan(start, end, search, false, writable, executable, mapped, resultLimit);
    }

    public unsafe Task<IEnumerable<nuint>> AoBScan(long start, long end, string search, bool readable, bool writable, bool executable, bool mapped, int resultLimit = -1)
    {
        return Task.Run(() =>
        {
            var pattern = ParsePattern(search);
            var sig = Utils.ParseSig(search, out var mask);
            var memoryRegions = GetEligibleMemoryRegions(start, end, readable, writable, executable);
            var results = new List<IntPtr>(resultLimit > 0 ? resultLimit : 1024);
            
            foreach (var region in memoryRegions)
            {
                ulong read = 0;
                byte* heapBuffer = (byte*)NativeMemory.Alloc((nuint)region.Size);
                if (!ReadProcessMemory(MProc.Handle, (UIntPtr)region.BaseAddress, heapBuffer, (nuint)region.Size, &read))
                {
                    NativeMemory.Free(heapBuffer);
                    continue;
                }

                if (read != (ulong)region.Size)
                {
                    NativeMemory.Free(heapBuffer);
                    continue;
                }
                
                int lastOffset = 0;
                Scanner scanner = new Scanner(heapBuffer, (int)region.Size);
                PatternScanResult result;
                do
                {
                    result = scanner.FindPattern(pattern, lastOffset);
                    if (!result.Found)
                    {
                        break;
                    }
                    
                    lastOffset = result.Offset + sig.Length;
                    results.Add(region.BaseAddress + result.Offset);
                    if (resultLimit > 0 && results.Count >= resultLimit)
                    {
                        break;
                    }
                } while (result.Found);
                NativeMemory.Free(heapBuffer);
            }

            List<nuint> final = [];
            final.AddRange(results.Select(result => (nuint)result));
            return final.AsEnumerable();
        });
    }

    private string ParsePattern(string sig)
    {
        sig = sig.Replace('*', '?').Trim();
        while (sig.EndsWith(" ?") || sig.EndsWith(" ??"))
        {
            if (sig.EndsWith(" ??"))
            {
                sig = sig[..^3];
            }
            if (sig.EndsWith(" ?"))
            {
                sig = sig[..^2];
            }
        }
        
        string[] tokens = sig.Split(' ');
        for (int i = 0; i < tokens.Length; i++)
        {
            if (tokens[i].StartsWith('?'))
            {
                tokens[i] = "??";
            }
        }
        
        return string.Join(" ", tokens);
    }
    
    private struct MemoryRegion
    {
        public IntPtr BaseAddress;
        public long Size;
    }

    private List<MemoryRegion> GetEligibleMemoryRegions(long start, long end, bool readable, bool writable, bool executable)
    {
        List<MemoryRegion> memoryRegions = [];
        GetSystemInfo(out var sysInfo);

        var minAddress = (long)sysInfo.MinimumApplicationAddress;
        var maxAddress = (long)sysInfo.MaximumApplicationAddress;

        start = Math.Max(start, minAddress);
        end = Math.Min(end, maxAddress);

        var currentAddress = (IntPtr)start;

        while (VirtualQueryEx(MProc.Handle, (nuint)currentAddress, out var memInfo) != 0 &&
               currentAddress.ToInt64() < end &&
               currentAddress.ToInt64() + memInfo.RegionSize > currentAddress.ToInt64())
        {
            if (memInfo.State != MemCommit ||
                (long)memInfo.BaseAddress >= maxAddress ||
                (memInfo.Protect & Guard) != 0 ||
                (memInfo.Protect & NoAccess) != 0 ||
                (memInfo.Type is not (MemPrivate or MemImage)))
            {
                currentAddress = IntPtr.Add((IntPtr)memInfo.BaseAddress, (int)memInfo.RegionSize);
                continue;
            }

            var isReadable = (memInfo.Protect & ReadOnly) > 0;
            var isWritable = (memInfo.Protect & ReadWrite) > 0 ||
                             (memInfo.Protect & WriteCopy) > 0 ||
                             (memInfo.Protect & ExecuteReadwrite) > 0 ||
                             (memInfo.Protect & ExecuteWriteCopy) > 0;
            var isExecutable = (memInfo.Protect & Execute) > 0 ||
                               (memInfo.Protect & ExecuteRead) > 0 ||
                               (memInfo.Protect & ExecuteReadwrite) > 0 ||
                               (memInfo.Protect & ExecuteWriteCopy) > 0;

            isReadable &= readable;
            isWritable &= writable;
            isExecutable &= executable;

            if (!(isReadable || isWritable || isExecutable))
            {
                currentAddress = IntPtr.Add((IntPtr)memInfo.BaseAddress, (int)memInfo.RegionSize);
                continue;
            }

            if (memoryRegions.Count > 0)
            {
                var lastRegion = memoryRegions[^1];
                if (lastRegion.BaseAddress.ToInt64() + lastRegion.Size == (long)memInfo.BaseAddress)
                {
                    memoryRegions[^1] = lastRegion with { Size = lastRegion.Size + memInfo.RegionSize };
                }
                else
                {
                    memoryRegions.Add(new MemoryRegion
                    {
                        BaseAddress = (IntPtr)memInfo.BaseAddress,
                        Size = memInfo.RegionSize
                    });
                }
            }
            else
            {
                memoryRegions.Add(new MemoryRegion
                {
                    BaseAddress = (IntPtr)memInfo.BaseAddress,
                    Size = memInfo.RegionSize
                });
            }

            currentAddress = IntPtr.Add((IntPtr)memInfo.BaseAddress, (int)memInfo.RegionSize);
        }

        return memoryRegions;
    }
    
}