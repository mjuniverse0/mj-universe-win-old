using System.Collections.Concurrent;
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace MA_FH5Trainer.Converters;

/// <summary>Converts a <see cref="Type" /> to a cached page instance (same lifetime semantics as <see cref="TypeToInstanceConverter" />).</summary>
public sealed class ModPageTypeToInstanceConverter : IValueConverter
{
    private static readonly ConcurrentDictionary<Type, object> s_cache = new();

    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not Type t)
        {
            return null;
        }

        return s_cache.GetOrAdd(t, static x => Activator.CreateInstance(x)!);
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        DependencyProperty.UnsetValue;
}
