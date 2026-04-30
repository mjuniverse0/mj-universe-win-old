using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Media;
using Color = System.Windows.Media.Color;
using ControlzEx.Theming;
using static System.Windows.Media.ColorConverter;

namespace MA_FH5Trainer.Resources.Theme;

public sealed class Theming : INotifyPropertyChanged
{
    private static readonly object s_lock = new object();
    private static Theming? _instance;
    public static Theming GetInstance()
    {
        lock (s_lock)
        {
            if (_instance != null)
            {
                return _instance;
            }
            
            _instance = new Theming();
            return _instance;
        }
    }
    
    // Verdant External–aligned: site uses #050505–#0e0e0e, white/soft text, subtle warm highlights
    private Brush _lighterColour = new SolidColorBrush((Color)ConvertFromString("#1a1a1a"));
    public Brush LighterColour
    {
        get => _lighterColour;
        private set => SetField(ref _lighterColour, value);
    }
    
    private Brush _lightColour = new SolidColorBrush((Color)ConvertFromString("#141414"));
    public Brush LightColour
    {
        get => _lightColour;
        private set => SetField(ref _lightColour, value);
    }
    
    private Brush _mainColour = new SolidColorBrush((Color)ConvertFromString("#0d0d0d"));
    public Brush MainColour
    {
        get => _mainColour;
        private set => SetField(ref _mainColour, value);
    }
    
    private Brush _darkishColour = new SolidColorBrush((Color)ConvertFromString("#0b0b0b"));
    public Brush DarkishColour
    {
        get => _darkishColour;
        private set => SetField(ref _darkishColour, value);
    }
    
    private Brush _darkColour = new SolidColorBrush((Color)ConvertFromString("#080808"));
    public Brush DarkColour
    {
        get => _darkColour;
        private set => SetField(ref _darkColour, value);
    }
    
    private Brush _darkerColour = new SolidColorBrush((Color)ConvertFromString("#050505"));
    public Brush DarkerColour
    {
        get => _darkerColour;
        private set => SetField(ref _darkerColour, value);
    }

    // Muted line on dark (not a white block); avoids “washed” borders next to #050505
    private Brush _accentColour = new SolidColorBrush((Color)ConvertFromString("#8a8a8a"));
    public Brush AccentColour
    {
        get => _accentColour;
        private set => SetField(ref _accentColour, value);
    }

    private Brush _accentColourDim = new SolidColorBrush((Color)ConvertFromString("#b8a070"));
    public Brush AccentColourDim
    {
        get => _accentColourDim;
        private set => SetField(ref _accentColourDim, value);
    }

    /// <summary>Site --warning / panel outline (subtle gold).</summary>
    public Brush GoldBorderBrush { get; } = new SolidColorBrush(Color.FromArgb(0x66, 0xFF, 0xC8, 0x70));

    public Brush CardSurfaceBrush { get; } = new SolidColorBrush((Color)ConvertFromString("#0f0f0f")!);

    public Brush CtaButtonBackground { get; } = new SolidColorBrush((Color)ConvertFromString("#2a2a2a")!);

    public Brush CtaButtonForeground { get; } = new SolidColorBrush((Color)ConvertFromString("#f5f5f5")!);

    /// <summary>Sidebar section titles (GAME INFO, HOTKEYS, …) — was misusing CtaButtonBackground when that was off-white.</summary>
    public Brush SectionHeaderForeground { get; } = new SolidColorBrush((Color)ConvertFromString("#e8e8e8")!);

    public Brush TextMuted { get; } = new SolidColorBrush((Color)ConvertFromString("#a9a9a9")!);

    /// <summary>Expander / section header strip (slightly above card body).</summary>
    public Brush ExpanderHeaderBrush { get; } = new SolidColorBrush((Color)ConvertFromString("#141414")!);

    /// <summary>Thin line for dashboard cards (ref. 2, low-contrast border).</summary>
    public Brush CardLineBrush { get; } = new SolidColorBrush(Color.FromArgb(0x2A, 0xFF, 0xFF, 0xFF));

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    private void SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return;
        field = value;
        OnPropertyChanged(propertyName);
    }
}