using System.Globalization;
using System.Windows.Data;

namespace MA_FH5Trainer.Converters;

public class BoolParamConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        var isToggled = values.OfType<bool>().Any(b => b);
        var strings = values.OfType<string>().ToList();
        if (strings.Count != 2)
        {
            return new object();
        }
        
        return isToggled ? strings[0] : strings[1];
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}