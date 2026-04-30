using System.Windows;
using System.Windows.Controls;
using MA_FH5Trainer.Cheats.ForzaHorizon5;
using MA_FH5Trainer.Views.Windows;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Views.SubPages.Tuning;

public partial class Steering : Page
{
    public Steering()
    {
        MainWindow = MainWindow.Instance ?? new MainWindow();
        DataContext = this;

        InitializeComponent();
    }
    
    public MainWindow MainWindow { get; }
    private static TuningCheats TuningCheatsFh5 => MA_FH5Trainer.Resources.Cheats.GetClass<TuningCheats>();
    private static readonly int[] Offsets = [0x330, 0x8, 0x1E0, 0x0];
    private static UIntPtr Ptr => GetInstance().FollowMultiLevelPointer(TuningCheatsFh5.Base2, Offsets);

    private async void Scan_OnClick(object sender, RoutedEventArgs e)
    {
        MainWindow.ViewModel.TuningScanSuccess = false;
        MainWindow.ViewModel.TuningScanToBeDone = false;
        MainWindow.ViewModel.TuningScanInProgress = true;

        if (!TuningCheatsFh5.WasScanSuccessful)
        {
            await TuningCheatsFh5.Scan();
        }

        if (!TuningCheatsFh5.WasScanSuccessful)
        {
            MainWindow.ViewModel.TuningScanSuccess = false;
            MainWindow.ViewModel.TuningScanToBeDone = true;
            MainWindow.ViewModel.TuningScanInProgress = false;
            return;
        }
        
        MainWindow.ViewModel.TuningScanSuccess = true;
        MainWindow.ViewModel.TuningScanToBeDone = false;
        MainWindow.ViewModel.TuningScanInProgress = false;
    }

    private void ButtonBase_OnClick(object sender, RoutedEventArgs e)
    {
        if (ComboBox == null || ValueBox == null || !TuningCheatsFh5.WasScanSuccessful)
        {
            return;
        }

        ValueBox.Value = ComboBox.SelectedIndex switch
        {
            0 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.AngleMaxOffset),
            1 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.AngleMax2Offset),
            2 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityStraightOffset),
            3 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityTurningOffset),
            4 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityCountersteerOffset),
            5 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityDynamicPeekOffset),
            6 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.TimeToMaxSteeringOffset),
            _ => ValueBox.Value
        };
    }

    private void ValueBox_OnValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
    {
        if (!TuningCheatsFh5.WasScanSuccessful)
        {
            return;
        }

        var newValue = Convert.ToSingle(e.NewValue.GetValueOrDefault());
        switch (ComboBox.SelectedIndex)
        {
            case 0:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.AngleMaxOffset, newValue);                
                break;
            }
            case 1:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.AngleMax2Offset, newValue);                
                break;
            }
            case 2:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.VelocityStraightOffset, newValue);                
                break;
            }
            case 3:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.VelocityTurningOffset, newValue);                
                break;
            }
            case 4:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.VelocityCountersteerOffset, newValue);                
                break;
            }
            case 5:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.VelocityDynamicPeekOffset, newValue);                
                break;
            }
            case 6:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.TimeToMaxSteeringOffset, newValue);                
                break;
            }
        }
    }

    private void ComboBox_OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (ValueBox == null || !TuningCheatsFh5.WasScanSuccessful)
        {
            return;
        }

        ValueBox.Value = ComboBox.SelectedIndex switch
        {
            0 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.AngleMaxOffset),
            1 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.AngleMax2Offset),
            2 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityStraightOffset),
            3 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityTurningOffset),
            4 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityCountersteerOffset),
            5 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.VelocityDynamicPeekOffset),
            6 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.TimeToMaxSteeringOffset),
            _ => ValueBox.Value
        };
    }
}