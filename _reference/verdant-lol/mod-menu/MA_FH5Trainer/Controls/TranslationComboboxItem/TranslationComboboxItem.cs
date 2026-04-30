using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;

namespace MA_FH5Trainer.Controls.TranslationComboboxItem;

public class TranslationComboboxItem : ComboBoxItem
{
    public static readonly DependencyProperty TranslatorsProperty
        = DependencyProperty.Register(nameof(Translators),
            typeof(string),
            typeof(TranslationComboboxItem),
            new PropertyMetadata(default(string)));
    
    [Bindable(true)]
    [Category("MA_FH5Trainer")]
    public string Translators
    {
        get => (string)GetValue(TranslatorsProperty);
        set => SetValue(TranslatorsProperty, value);
    }

    static TranslationComboboxItem()
    {
        DefaultStyleKeyProperty.OverrideMetadata(typeof(TranslationComboboxItem), new FrameworkPropertyMetadata(typeof(TranslationComboboxItem)));
    }
}