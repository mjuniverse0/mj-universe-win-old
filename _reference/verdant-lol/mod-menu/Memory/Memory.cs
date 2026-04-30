using System;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Memory.Types;
using static Memory.Imps;

namespace Memory;

public partial class Mem
{
    internal static Mem DefaultInstance { get; private set; } = null!;
    public readonly Proc MProc = new();

    public Mem()
    {
        DefaultInstance = this;
    }

    public nuint VirtualQueryEx(nint hProcess, nuint lpAddress, out MemoryBasicInformation lpBuffer)
    {
        if (MProc.Is64Bit)
        {
            MemoryBasicInformation64 tmp64 = new();
            nuint retVal = Native_VirtualQueryEx(hProcess, lpAddress, out tmp64, new UIntPtr((uint)Marshal.SizeOf(tmp64)));

            lpBuffer.BaseAddress = tmp64.BaseAddress;
            lpBuffer.AllocationBase = tmp64.AllocationBase;
            lpBuffer.AllocationProtect = tmp64.AllocationProtect;
            lpBuffer.RegionSize = (long)tmp64.RegionSize;
            lpBuffer.State = tmp64.State;
            lpBuffer.Protect = tmp64.Protect;
            lpBuffer.Type = tmp64.Type;

            return retVal;
        }
        
        lpBuffer = new MemoryBasicInformation();
        return 0;
    }

    public enum OpenProcessResults
    {
        InvalidArgument = 0,
        ProcessNotFound,
        NotResponding,
        FailedToOpenHandle,
        FailedToEnablePrivilege,
        Success,
    }
    
    private const int TOKEN_ADJUST_PRIVILEGES = 0x0020;
    private const int TOKEN_QUERY = 0x0008;
    private const string SE_DEBUG_NAME = "SeDebugPrivilege";
    private const int SE_PRIVILEGE_ENABLED = 0x00000002;
    
    const int PROCESS_VM_WRITE = 0x20;
    const int PROCESS_VM_READ = 0x10;
    const int PROCESS_VM_OPERATION = 0x0008;
    const int PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const int PROCESS_CREATE_THREAD = 0x0002;


    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct LUID
    {
        public uint LowPart;
        public int HighPart;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct TOKEN_PRIVILEGES
    {
        public uint PrivilegeCount;
        public LUID Luid;
        public uint Attributes;
    }

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool LookupPrivilegeValue(string lpSystemName, string lpName, out LUID lpLuid);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool AdjustTokenPrivileges(
        IntPtr TokenHandle,
        bool DisableAllPrivileges,
        ref TOKEN_PRIVILEGES NewState,
        uint BufferLength,
        IntPtr PreviousState,
        IntPtr ReturnLength
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetCurrentProcess();

    public static bool EnableSeDebugPrivilege()
    {
        if (!IsAdministrator())
        {
            return false;
        }

        if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, out IntPtr hToken))
        {
            return false;
        }

        if (!LookupPrivilegeValue(null, SE_DEBUG_NAME, out LUID luid))
        {
            return false;
        }

        TOKEN_PRIVILEGES tp = new TOKEN_PRIVILEGES
        {
            PrivilegeCount = 1,
            Luid = luid,
            Attributes = SE_PRIVILEGE_ENABLED
        };

        bool result = AdjustTokenPrivileges(hToken, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
        Marshal.FreeHGlobal(hToken);
        return result;
    }

    private static bool IsAdministrator()
    {
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
        {
            WindowsPrincipal principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    public OpenProcessResults OpenProcess(int processId)
    {
        var found = IsProcessRunning(processId);
        if (!found)
        {
            return OpenProcessResults.ProcessNotFound;
        }
        
        MProc.ProcessId = processId;
        try
        {
            MProc.Process = Process.GetProcessById(processId);
        }
        catch
        {
            return OpenProcessResults.ProcessNotFound;
        }

        if (MProc.Process is { Responding: false })
        {
            return OpenProcessResults.NotResponding;
        }

        MProc.Handle = Imps.OpenProcess(
            PROCESS_VM_WRITE|PROCESS_VM_READ|PROCESS_VM_OPERATION|PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_CREATE_THREAD, 
            false, 
            processId
        );
        
        if (MProc.Handle == 0 || MProc.Handle == -1)
        {
            bool enabled = EnableSeDebugPrivilege();
            if (!enabled)
            {
                return OpenProcessResults.FailedToEnablePrivilege;
            }

            MProc.Handle = Imps.OpenProcess(
                PROCESS_VM_WRITE|PROCESS_VM_READ|PROCESS_VM_OPERATION|PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_CREATE_THREAD, 
                false, 
                processId
            );
            
            if (MProc.Handle == 0 || MProc.Handle == -1)
            {
                return OpenProcessResults.FailedToOpenHandle;
            }
        }

        MProc.Is64Bit = true; //IsWow64Process(MProc.Handle, out var retVal) && !retVal;
        return OpenProcessResults.Success;
    }

    public static bool IsProcessRunning(int processId)
    {
        if (processId <= 0)
        {
            return false;
        }
        
        var runningProcesses = Process.GetProcesses().Select(p => p.Id);
        return runningProcesses.Contains(processId);
    }
    
    public OpenProcessResults OpenProcess(string proc)
    {
        return string.IsNullOrWhiteSpace(proc) ? OpenProcessResults.InvalidArgument : OpenProcess(GetProcIdFromName(proc));
    }

    public static int GetProcIdFromName(string name)
    {
        var processlist = Process.GetProcesses();
        if (name.Contains(".exe", StringComparison.CurrentCultureIgnoreCase))
        {
            name = name.Replace(".exe", "");
        }

        return (from theProcess in processlist
            where theProcess.ProcessName.Equals(name, StringComparison.CurrentCultureIgnoreCase)
            select theProcess.Id).FirstOrDefault();
    }
    
    public bool ChangeProtection(nuint address, MemoryProtection newProtection, out MemoryProtection oldProtection)
    {
        if (address != nuint.Zero && MProc.Handle != nint.Zero)
        {
            var size = MProc.Is64Bit ? 8 : 4;
            return VirtualProtectEx(MProc.Handle, address, size, newProtection, out oldProtection);
        }

        oldProtection = default;
        return false;
    }
    
    public nuint FollowMultiLevelPointer(nuint address, IEnumerable<int> offsets)
    {
        var enumerable = offsets as int[] ?? offsets.ToArray();
        if (enumerable.Length == 0)
        {
            return 0;
        }
        
        var finalAddress = address;
        foreach (var offset in enumerable)
        {
            finalAddress = ReadMemory<nuint>(finalAddress);
            finalAddress += (nuint)(offset >= 0 ? offset : -offset);
        }
        
        return finalAddress;
    }
    
    public nuint CreateDetour(nuint address, byte[] newBytes, int replaceCount, byte[] varBytes = null!,
        int varOffset = 0, uint size = 0x1000, bool makeDetour = true)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(replaceCount, 5);

        var caveAddress = nuint.Zero;
        var preferred = address;

        while (caveAddress == 0)
        {
            var allocAddress = FindFreeBlockForRegion(preferred, size);
            caveAddress = VirtualAllocEx(MProc.Handle, allocAddress, size, MemCommit | MemReserve, ExecuteReadwrite);

            if (caveAddress != nuint.Zero)
            {
                break;
            }
            
            const int preferredOffset = 0x10000;
            preferred = nuint.Add(preferred, preferredOffset);
        }

        var nopsNeeded = replaceCount > 5 ? replaceCount - 5 : 0;
        var offset = (int)((long)caveAddress - (long)address - 5);

        var jmpBytes = new byte[5 + nopsNeeded];
        jmpBytes[0] = 0xE9;
        BitConverter.GetBytes(offset).CopyTo(jmpBytes, 1);

        for (var i = 5; i < jmpBytes.Length; i++)
        {
            jmpBytes[i] = 0x90;
        }

        var caveBytes = new byte[5 + newBytes.Length];
        offset = (int)((long)address + jmpBytes.Length - ((long)caveAddress + newBytes.Length) - 5);
        newBytes.CopyTo(caveBytes, 0);
        caveBytes[newBytes.Length] = 0xE9;
        BitConverter.GetBytes(offset).CopyTo(caveBytes, newBytes.Length + 1);
        WriteArrayMemory(caveAddress, caveBytes);

        if (makeDetour)
        {
            WriteArrayMemory(address, jmpBytes);
        }

        if (varBytes != null!)
        {
            WriteArrayMemory(caveAddress + (nuint)caveBytes.Length + (nuint)varOffset, varBytes);
        }

        return caveAddress;
    }
    
    public nuint CreateFarDetour(nuint address, byte[] newBytes, int replaceCount, byte[] varBytes = null!,
        int varOffset = 0, uint size = 0x1000, bool makeDetour = true)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(replaceCount, 14);

        var caveAddress = VirtualAllocEx(MProc.Handle, nuint.Zero, size, MemCommit | MemReserve, ExecuteReadwrite);
        var nopsNeeded = replaceCount > 14 ? replaceCount - 14 : 0;
        var jmpBytes = new byte[14 + nopsNeeded];
        jmpBytes[0] = 0xFF;
        jmpBytes[1] = 0x25;
        BitConverter.GetBytes((long)caveAddress).CopyTo(jmpBytes, 6);

        for (var i = 14; i < jmpBytes.Length; i++)
        {
            jmpBytes[i] = 0x90;
        }

        var caveBytes = new byte[newBytes.Length + 14];
        newBytes.CopyTo(caveBytes, 0);
        caveBytes[newBytes.Length] = 0xFF;
        caveBytes[newBytes.Length + 1] = 0x25;
        BitConverter.GetBytes((long)address + jmpBytes.Length).CopyTo(caveBytes, newBytes.Length + 6);

        WriteArrayMemory(caveAddress, caveBytes);
        if (makeDetour)
        {
            WriteArrayMemory(address, jmpBytes);
        }

        if (varBytes != null!)
        {
            WriteArrayMemory(caveAddress + (nuint)caveBytes.Length + (nuint)varOffset, varBytes);
        }
        
        return caveAddress;
    }
    
    public nuint CreateCallDetour(nuint address, byte[] newBytes, int replaceCount,
        byte[] varBytes = null!, int varOffset = 0, uint size = 0x1000, bool makeDetour = true)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(replaceCount, 16);

        var caveAddress = VirtualAllocEx(MProc.Handle, nuint.Zero, size, 0x1000 | 0x2000, 0x40);
        var nopsNeeded = replaceCount > 16 ? replaceCount - 16 : 0;
        var jmpBytes = new byte[16 + nopsNeeded];
        jmpBytes[0] = 0xFF;
        jmpBytes[1] = 0x15;
        jmpBytes[2] = 0x02;
        jmpBytes[6] = 0xEB;
        jmpBytes[7] = 0x08;
        BitConverter.GetBytes((long)caveAddress).CopyTo(jmpBytes, 8);

        for (var i = 16; i < jmpBytes.Length; i++)
        {
            jmpBytes[i] = 0x90;
        }

        var caveBytes = new byte[newBytes.Length + 1];
        newBytes.CopyTo(caveBytes, 0);
        caveBytes[newBytes.Length] = 0xC3;

        WriteArrayMemory(caveAddress, caveBytes);
        if (makeDetour)
        {
            WriteArrayMemory(address, jmpBytes);
        }

        if (varBytes != null!)
        {
            WriteArrayMemory(caveAddress + (nuint)caveBytes.Length + (nuint)varOffset, varBytes);
        }

        return caveAddress;
    }

    public enum DetourType
    {
        Jump,
        JumpFar,
        Call,
        Unspecified
    }
    
    public static byte[] CalculateDetour(nuint address, nuint target, DetourType type, int replaceCount)
    {
        if (type == DetourType.Unspecified)
        {
            throw new ArgumentOutOfRangeException(nameof(type));
        }
        
        var detourBytes = new byte[replaceCount];
        switch (type)
        {
            case DetourType.Jump:
            {
                detourBytes[0] = 0xE9;
                BitConverter.GetBytes((int)((long)target - (long)address - 5)).CopyTo(detourBytes, 1);
                break;
            }
            case DetourType.JumpFar:
            {
                detourBytes[0] = 0xFF;
                detourBytes[1] = 0x25;
                BitConverter.GetBytes((long)target).CopyTo(detourBytes, 6);
                break;
            }
            case DetourType.Call:
            {
                detourBytes[0] = 0xFF;
                detourBytes[1] = 0x15;
                detourBytes[2] = 0x02;
                detourBytes[6] = 0xEB;
                detourBytes[7] = 0x08;
                BitConverter.GetBytes((long)target).CopyTo(detourBytes, 8);
                break;
            }
            default:
            {
                throw new Exception("Achievement unlocked: How Did We Get Here?");
            }
        }

        var nopsNeeded = type switch
        {
            DetourType.Jump => 5,
            DetourType.JumpFar => 14,
            DetourType.Call => 16,
            _ => throw new Exception("Achievement unlocked: How Did We Get Here?")
        };
        
        for (var i = nopsNeeded; i < detourBytes.Length; i++)
        {
            detourBytes[i] = 0x90;
        }

        return detourBytes;
    }
    
    private nuint FindFreeBlockForRegion(nuint baseAddress, uint size)
    {
        var minAddress = nuint.Subtract(baseAddress, 0x70000000);
        var maxAddress = nuint.Add(baseAddress, 0x70000000);

        var ret = nuint.Zero;

        GetSystemInfo(out var si);

        if (MProc.Is64Bit)
        {
            if ((long)minAddress > (long)si.MaximumApplicationAddress ||
                (long)minAddress < (long)si.MinimumApplicationAddress)
            {
                minAddress = si.MinimumApplicationAddress;
            }

            if ((long)maxAddress < (long)si.MinimumApplicationAddress ||
                (long)maxAddress > (long)si.MaximumApplicationAddress)
            {
                maxAddress = si.MaximumApplicationAddress;
            }
        }
        else
        {
            minAddress = si.MinimumApplicationAddress;
            maxAddress = si.MaximumApplicationAddress;
        }

        var current = minAddress;

        while (VirtualQueryEx(MProc.Handle, current, out var mbi).ToUInt64() != 0)
        {
            if ((long)mbi.BaseAddress > (long)maxAddress)
            {
                return nuint.Zero;
            }

            if (mbi.State == MemFree && mbi.RegionSize > size)
            {
                nuint tmpAddress;
                if ((long)mbi.BaseAddress % si.AllocationGranularity > 0)
                {
                    tmpAddress = mbi.BaseAddress;
                    var offset = (int)(si.AllocationGranularity - (long)tmpAddress % si.AllocationGranularity);

                    if (mbi.RegionSize - offset >= size)
                    {
                        tmpAddress = nuint.Add(tmpAddress, offset);
                        if ((long)tmpAddress < (long)baseAddress)
                        {
                            tmpAddress = nuint.Add(tmpAddress, (int)(mbi.RegionSize - offset - size));

                            if ((long)tmpAddress > (long)baseAddress)
                            {
                                tmpAddress = baseAddress;
                            }

                            tmpAddress = nuint.Subtract(tmpAddress, (int)((long)tmpAddress % si.AllocationGranularity));
                        }

                        if (Math.Abs((long)tmpAddress - (long)baseAddress) < Math.Abs((long)ret - (long)baseAddress))
                        {
                            ret = tmpAddress;
                        }
                    }
                }
                else
                {
                    tmpAddress = mbi.BaseAddress;

                    if ((long)tmpAddress < (long)baseAddress)
                    {
                        tmpAddress = nuint.Add(tmpAddress, (int)(mbi.RegionSize - size));

                        if ((long)tmpAddress > (long)baseAddress)
                        {
                            tmpAddress = baseAddress;
                        }

                        tmpAddress =nuint.Subtract(tmpAddress, (int)((long)tmpAddress % si.AllocationGranularity));
                    }

                    if (Math.Abs((long)tmpAddress - (long)baseAddress) < Math.Abs((long)ret - (long)baseAddress))
                    {
                        ret = tmpAddress;
                    }
                }
            }

            if (mbi.RegionSize % si.AllocationGranularity > 0)
            {
                mbi.RegionSize += si.AllocationGranularity - mbi.RegionSize % si.AllocationGranularity;
            }

            var previous = current;
            current = new UIntPtr(mbi.BaseAddress + (nuint)mbi.RegionSize);

            if ((long)current >= (long)maxAddress)
            {
                return ret;
            }

            if ((long)previous >= (long)current)
            {
                return ret;
            }
        }

        return ret;
    }
}