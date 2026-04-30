using System.Globalization;
using System.Windows;
using System.Windows.Data;
using MahApps.Metro.IconPacks;

namespace MA_FH5Trainer.Converters;

/// <summary>Maps icon name strings to <see cref="PackIconMaterialKind" /> for <c>PackIconMaterial</c>.</summary>
public sealed class IconKindStringToMaterialKindConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s))
        {
            return PackIconMaterialKind.Circle;
        }

        s = s.Trim();
        if (Enum.TryParse<PackIconMaterialKind>(s, true, out var k))
        {
            return k;
        }

        return PackIconMaterialKind.Circle;
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        DependencyProperty.UnsetValue;
}
