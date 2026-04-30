using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using static Memory.Imps;

namespace Memory;

public partial class Mem
{
    public unsafe bool WriteMemory<T>(nuint address, T write, bool removeWriteProtection = true) where T : unmanaged
    {
        MemoryProtection oldMemProt = 0x00;

        if (removeWriteProtection)
        {
            ChangeProtection(address, MemoryProtection.ExecuteReadWrite, out oldMemProt);
        }
            
        var ret = WriteProcessMemory(MProc.Handle, address, &write, (nuint)sizeof(T), nint.Zero);
        if (removeWriteProtection)
        {
            ChangeProtection(address, oldMemProt, out _);
        }
            
        return ret;
    }

    public bool WriteStringMemory(nuint address, string write, Encoding? stringEncoding = null, bool removeWriteProtection = true)
    {
        var memory = stringEncoding == null ? Encoding.UTF8.GetBytes(write) : stringEncoding.GetBytes(write);
        return WriteArrayMemory(address, memory, removeWriteProtection);
    }
        
    public unsafe bool WriteArrayMemory<T>(nuint address, T[] write, bool removeWriteProtection = true) where T : unmanaged
    {
        MemoryProtection oldMemProt = 0x00;

        int buffSize = write.Length * sizeof(T);
        var buffer = Marshal.AllocHGlobal(buffSize);
        fixed (T* ptr = write)
        {
            Buffer.MemoryCopy(ptr, (void*)buffer, buffSize, buffSize);
        }

        if (removeWriteProtection)
        {
            ChangeProtection(address, MemoryProtection.ExecuteReadWrite, out oldMemProt);
        }
            
        var ret = WriteProcessMemory(MProc.Handle, address, buffer.ToPointer(), (nuint)buffSize, nint.Zero);
        if (removeWriteProtection)
        {
            ChangeProtection(address, oldMemProt, out _);
        }
            
        Marshal.FreeHGlobal(buffer);
        return ret;
    }
}