namespace MA_FH5Trainer.Converters;

using System;
using System.Globalization;
using System.Windows.Data;

public class AndBooleanMultiConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values.All(v => v is bool) && values.Length == 2)
        {
            return (bool)values[0] && (bool)values[1];
        }

        return false;
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}