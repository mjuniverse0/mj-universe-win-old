using System.Runtime.InteropServices;
using static Memory.Imps;

namespace Memory;

public partial class Mem
{
    public unsafe T ReadMemory<T>(nuint address) where T : unmanaged
    {
        var size = Marshal.SizeOf<T>();
        T result;
        if (!ReadProcessMemory(MProc.Handle, address, &result, (nuint)size, null))
        {
            result = default;
        }

        return result;
    }
    
    public unsafe T[] ReadArrayMemory<T>(nuint address, int length) where T : unmanaged
    {
        var size = Marshal.SizeOf<T>();
        var results = new T[length];
        
        fixed (T* result = &results[0])
        {
            return ReadProcessMemory(MProc.Handle, address, result, (nuint)(size * length), null)
                ? results
                : [];
        }
    }
}