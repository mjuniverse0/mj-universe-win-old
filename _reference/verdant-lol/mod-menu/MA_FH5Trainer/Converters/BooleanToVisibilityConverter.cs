using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace MA_FH5Trainer.Converters;

/// <summary>Maps bool to <see cref="Visibility" /> for view states.</summary>
public sealed class BooleanToVisibilityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is true ? Visibility.Visible : Visibility.Collapsed;

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        value is Visibility v && v == Visibility.Visible;
}
