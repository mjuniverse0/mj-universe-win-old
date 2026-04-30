using System.Windows;
using System.Windows.Controls;
using MA_FH5Trainer.Cheats.ForzaHorizon5;
using MA_FH5Trainer.Views.Windows;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Views.SubPages.Tuning;

public partial class Alignment
{
    public Alignment()
    {
        MainWindow = MainWindow.Instance ?? new MainWindow();
        DataContext = this;

        InitializeComponent();
    }
    
    public MainWindow MainWindow { get; }
    private static TuningCheats TuningCheatsFh5 => MA_FH5Trainer.Resources.Cheats.GetClass<TuningCheats>();
    private static readonly int[] Offsets = [0x8B0, 0x0];
    private static UIntPtr Ptr => GetInstance().FollowMultiLevelPointer(TuningCheatsFh5.Base1, Offsets);

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
            0 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.CamberNegOffset),
            1 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.CamberPosOffset),
            2 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.ToeNegOffset),
            3 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.ToePosOffset),
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
                GetInstance().WriteMemory(Ptr + TuningOffsets.CamberNegOffset, newValue);                
                GetInstance().WriteMemory(TuningCheatsFh5.Base4, newValue);                
                break;
            }
            case 1:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.CamberPosOffset, newValue);                
                GetInstance().WriteMemory(TuningCheatsFh5.Base4 + 0x4, newValue);                
                break;
            }
            case 2:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.ToeNegOffset, newValue);                
                GetInstance().WriteMemory(TuningCheatsFh5.Base4 + 0x8, newValue);                
                break;
            }
            case 3:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.ToePosOffset, newValue);                
                GetInstance().WriteMemory(TuningCheatsFh5.Base4 + 0xC, newValue);                
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
            0 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.CamberNegOffset),
            1 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.CamberPosOffset),
            2 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.ToeNegOffset),
            3 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.ToePosOffset),
            _ => ValueBox.Value
        };
    }
}