namespace MA_FH5Trainer.Resources;

public abstract class Pages
{
    private static readonly Dictionary<Type, object> CachedInstances = new();

    public static void Clear()
    {
        foreach (var cachedInstance in CachedInstances)
        {
            CachedInstances.Remove(cachedInstance.Key);
        }
    }

    public static object GetPage(Type pageType)
    {
        if (CachedInstances.TryGetValue(pageType, out var cachedInstance))
        {
            return cachedInstance;
        }

        var newInstance = Activator.CreateInstance(pageType);
        CachedInstances[pageType] = newInstance!;
        return newInstance!;
    }
}