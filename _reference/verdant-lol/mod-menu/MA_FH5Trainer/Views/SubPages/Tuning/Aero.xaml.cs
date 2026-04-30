using System.Windows;
using System.Windows.Controls;
using MA_FH5Trainer.Cheats.ForzaHorizon5;
using MA_FH5Trainer.Views.Windows;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Views.SubPages.Tuning;

public partial class Aero
{
    public Aero()
    {
        MainWindow = MainWindow.Instance ?? new MainWindow();
        DataContext = this;
        
        InitializeComponent();
    }

    public MainWindow MainWindow { get; }
    private static TuningCheats TuningCheatsFh5 => MA_FH5Trainer.Resources.Cheats.GetClass<TuningCheats>();
    private static readonly int[] Offsets = [0x330, 0x8, 0x1E0, 0x0];
    private static UIntPtr Ptr => GetInstance().FollowMultiLevelPointer(TuningCheatsFh5.Base2, Offsets);

    private void ButtonBase_OnClick(object sender, RoutedEventArgs e)
    {
        if (ComboBox == null || ValueBox == null || !TuningCheatsFh5.WasScanSuccessful)
        {
            MessageBox.Show("Total failure. Cannot pull data.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        ValueBox.Value = ComboBox.SelectedIndex switch
        {
            0 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.FrontAeroMinOffset),
            1 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.FrontAeroMaxOffset),
            2 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.RearAeroMinOffset),
            3 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.RearAeroMaxOffset),
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
                GetInstance().WriteMemory(Ptr + TuningOffsets.FrontAeroMinOffset, newValue);                
                break;
            }
            case 1:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.FrontAeroMaxOffset, newValue);                
                break;
            }
            case 2:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.RearAeroMinOffset, newValue);                
                break;
            }
            case 3:
            {
                GetInstance().WriteMemory(Ptr + TuningOffsets.RearAeroMaxOffset, newValue);                
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
            0 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.FrontAeroMinOffset),
            1 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.FrontAeroMaxOffset),
            2 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.RearAeroMinOffset),
            3 => GetInstance().ReadMemory<float>(Ptr + TuningOffsets.RearAeroMaxOffset),
            _ => ValueBox.Value
        };
    }

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
}