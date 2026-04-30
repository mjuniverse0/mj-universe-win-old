using System.Windows.Data;
using System.Globalization;
using MA_FH5Trainer.Resources;

namespace MA_FH5Trainer.Converters;

public class TypeToInstanceConverter : IValueConverter
{
    private readonly Dictionary<Type, object> CachedInstances = new();

    private object GetPage(Type pageType)
    {
        if (CachedInstances.TryGetValue(pageType, out var cachedInstance))
        {
            return cachedInstance;
        }

        var newInstance = Activator.CreateInstance(pageType);
        CachedInstances[pageType] = newInstance!;
        return newInstance!;
    }
    
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        return GetPage((Type)parameter!);
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}