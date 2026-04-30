using System.Windows;
using System.Windows.Media;
using ControlzEx.Theming;
using MA_FH5Trainer.Resources.Theme;
using MA_FH5Trainer.Views.Windows;
using MahApps.Metro.Controls;
using Microsoft.Extensions.Hosting;

namespace MA_FH5Trainer.Services;

public class ApplicationHostService(IServiceProvider serviceProvider) : IHostedService
{
    private MetroWindow? _navigationWindow;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await HandleActivationAsync();
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
    }

    private async Task HandleActivationAsync()
    {
        await Task.CompletedTask;

        if (!Application.Current.Windows.OfType<MainWindow>().Any())
        {
            InitTheme();
            _navigationWindow = (serviceProvider.GetService(typeof(MetroWindow)) as MetroWindow)!;
            _navigationWindow.Show();
        }

        await Task.CompletedTask;
    }

    private static void InitTheme()
    {
        // Dark surfaces for MahApps AccentBase (NumericUpDown, buttons using AccentBase).
        // A light accent (#E8E8E8) filled the whole control and hid white +/- glyphs.
        var accentColor = (Color)ColorConverter.ConvertFromString("#1A1A1A")!;
        const string name = "VerdantAccent";
        ThemeManager.Current.ClearThemes();
        ThemeManager.Current.AddTheme(new Theme(name, name, "Dark", "Blue", accentColor, new SolidColorBrush(accentColor), true, false));
        ThemeManager.Current.ChangeTheme(Application.Current, name);
    }
}