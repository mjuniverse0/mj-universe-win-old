namespace MA_FH5Trainer.Resources;

public static class Cheats
{
    public static readonly Dictionary<Type, object> g_CachedInstances = [];

    public static T GetClass<T>() where T : class
    {
        var classType = typeof(T);
        if (g_CachedInstances.TryGetValue(classType, out var cachedInstance))
        {
            return (T)cachedInstance;
        }
        var newInstance = Activator.CreateInstance(classType) as T;
        g_CachedInstances[classType] = newInstance!;
        return newInstance!;
    }
}