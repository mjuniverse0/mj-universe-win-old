using Memory;

namespace MA_FH5Trainer.Resources;

public static class Memory
{
    private static Mem _instance = null!;
    public static Mem GetInstance()
    {
        if (_instance != null!) return _instance;
        _instance = new Mem();
        return _instance;
    }
}