using System.Numerics;
using System.Windows;
using System.Windows.Media;
using ControlzEx.Standard;
using MA_FH5Trainer.Cheats.ForzaHorizon5;
using MA_FH5Trainer.Models;
using MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;
using MA_FH5Trainer.Views.Windows;
using MahApps.Metro.Controls;
using static MA_FH5Trainer.Resources.Cheats;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Views.SubPages.SelfVehicle;

public partial class Environment
{
    public Environment()
    {
        MainWindow = MainWindow.Instance ?? new MainWindow();
        ViewModel =new EnvironmentViewModel();
        DataContext = this;
        
        InitializeComponent();
    }

    public MainWindow MainWindow { get; }
    public EnvironmentViewModel ViewModel { get; }
    private static EnvironmentCheats EnvironmentCheatsFh5 => GetClass<EnvironmentCheats>();
    private static CarCheats CarCheatsFh5 => GetClass<CarCheats>();
    
    private static Vector4 ConvertUiColorToGameValues(Color uiColor, double intensity)
    {
        var fIntensity = Convert.ToSingle(intensity);
        var alpha = uiColor.A / 255f;
        var red = uiColor.R / 255f * alpha * fIntensity;
        var green = uiColor.G / 255f * alpha * fIntensity;
        var blue = uiColor.B / 255f * alpha * fIntensity;
        return new Vector4(1 + red, 1 + green, 1 + blue, 1);        
    }

    private async void RgbSwitch_OnToggled(object sender, RoutedEventArgs e)
    {
        if (sender is not ToggleSwitch toggleSwitch)
        {
            return;
        }

        ViewModel.AreSunRgbUiElementsEnabled = false;
        if (EnvironmentCheatsFh5.SunRgbDetourAddress == 0)
        {
            await EnvironmentCheatsFh5.CheatSunRgb();
        }
        ViewModel.AreSunRgbUiElementsEnabled = true;
        if (EnvironmentCheatsFh5.SunRgbDetourAddress == 0)
        {
            toggleSwitch.Toggled -= RgbSwitch_OnToggled;
            toggleSwitch.IsOn = false;
            toggleSwitch.Toggled += RgbSwitch_OnToggled;
            return;
        }
        
        GetInstance().WriteMemory(EnvironmentCheatsFh5.SunRgbDetourAddress + 0x32, toggleSwitch.IsOn ? (byte)1 : (byte)0);

        var color = Picker.SelectedColor.GetValueOrDefault();
        var intensity = IntensityBox.Value.GetValueOrDefault();
        var gameValues = ConvertUiColorToGameValues(color, intensity);
        GetInstance().WriteMemory(EnvironmentCheatsFh5.SunRgbDetourAddress + 0x33, gameValues);
    }

    private void Picker_OnSelectedColorChanged(object sender, RoutedPropertyChangedEventArgs<Color?> e)
    {
        if (EnvironmentCheatsFh5.SunRgbDetourAddress == 0)
        {
            return;
        }
        
        var color = Picker.SelectedColor.GetValueOrDefault();
        var intensity = IntensityBox.Value.GetValueOrDefault();
        var gameValues = ConvertUiColorToGameValues(color, intensity);
        GetInstance().WriteMemory(EnvironmentCheatsFh5.SunRgbDetourAddress + 0x33, gameValues);
    }

    private async void PullButton_OnClick(object sender, RoutedEventArgs e)
    {
        ViewModel.AreManualTimeUiElementsEnabled = false;
        if (EnvironmentCheatsFh5.TimeDetourAddress == 0)
        {
            await EnvironmentCheatsFh5.CheatTime();
        }
        ViewModel.AreManualTimeUiElementsEnabled = true;

        if (EnvironmentCheatsFh5.TimeDetourAddress == 0)
        {
            return;
        }
        
        TimeBox.Value = Math.Round(GetInstance().ReadMemory<double>(EnvironmentCheatsFh5.TimeDetourAddress + 0x2C));
    }

    private void TimeBox_OnValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
    {
        if (EnvironmentCheatsFh5.TimeDetourAddress == 0)
        {
            return;
        }
        
        GetInstance().WriteMemory(EnvironmentCheatsFh5.TimeDetourAddress + 0x24, e.NewValue.GetValueOrDefault());
    }

    private async void TimeSwitch_OnToggled(object sender, RoutedEventArgs e)
    {
        if (sender is not ToggleSwitch toggleSwitch)
        {
            return;
        }
        
        ViewModel.AreManualTimeUiElementsEnabled = false;
        if (EnvironmentCheatsFh5.TimeDetourAddress == 0)
        {
            await EnvironmentCheatsFh5.CheatTime();
        }
        
        ViewModel.AreManualTimeUiElementsEnabled = true;
        if (EnvironmentCheatsFh5.TimeDetourAddress == 0)
        {
            toggleSwitch.Toggled -= TimeSwitch_OnToggled;
            toggleSwitch.IsOn = false;
            toggleSwitch.Toggled += TimeSwitch_OnToggled;
            return;
        }
        
        GetInstance().WriteMemory(EnvironmentCheatsFh5.TimeDetourAddress + 0x23, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        GetInstance().WriteMemory(EnvironmentCheatsFh5.TimeDetourAddress + 0x24, TimeBox.Value.GetValueOrDefault());
    }

    private async void FreezeAiSwitch_OnToggled(object sender, RoutedEventArgs e)
    {
        if (sender is not ToggleSwitch toggleSwitch)
        {
            return;
        }

        toggleSwitch.IsEnabled = false;
        if (CarCheatsFh5.FreezeAiDetourAddress == 0)
        {
            await CarCheatsFh5.CheatFreezeAi();
        }
        toggleSwitch.IsEnabled = true;

        if (CarCheatsFh5.FreezeAiDetourAddress == 0)
        {
            toggleSwitch.Toggled -= FreezeAiSwitch_OnToggled;
            toggleSwitch.IsOn = false;
            toggleSwitch.Toggled += FreezeAiSwitch_OnToggled;
            return;
        }
        
        GetInstance().WriteMemory(CarCheatsFh5.FreezeAiDetourAddress + 0x4F, toggleSwitch.IsOn ? (byte)1 : (byte)0);
    }

    private void NumericUpDown_OnValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
    {
        if (EnvironmentCheatsFh5.SunRgbDetourAddress == 0)
        {
            return;
        }
        
        GetInstance().WriteMemory(EnvironmentCheatsFh5.SunRgbDetourAddress + 0x33, ConvertUiColorToGameValues(Picker.SelectedColor.GetValueOrDefault(), IntensityBox.Value.GetValueOrDefault()));
    }
}