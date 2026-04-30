using MA_FH5Trainer.Cheats.ForzaHorizon5;
using MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;
using MA_FH5Trainer.Views.Windows;
using MahApps.Metro.Controls;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using static MA_FH5Trainer.Resources.Memory;

namespace MA_FH5Trainer.Views.SubPages.SelfVehicle
{
    /// <summary>
    /// Interaction logic for Wheelspins.xaml
    /// </summary>
    public partial class Wheelspins : Page
    {
        public Wheelspins()
        {
            DataContext = this;
            MainWindow = MainWindow.Instance!;
            ViewModel = new();
            InitializeComponent();
        }

        public MainWindow MainWindow { get; }
        public WheelspinsViewModel ViewModel { get; }

        public MiscCheats MiscCheats = MA_FH5Trainer.Resources.Cheats.GetClass<MiscCheats>();
        public UnlocksCheats UnlocksCheatsFh5 => MA_FH5Trainer.Resources.Cheats.GetClass<UnlocksCheats>();

        private async void EmoteSwitch_OnToggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch || emoteIdBox.Value == null || !MainWindow.ViewModel.Attached)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (UnlocksCheatsFh5.EmoteDetourAddress == 0)
            {
                await UnlocksCheatsFh5.CheatEmote();
            }
            toggleSwitch.IsEnabled = true;

            if (UnlocksCheatsFh5.EmoteDetourAddress == 0)
            {
                toggleSwitch.Toggled -= EmoteSwitch_OnToggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += EmoteSwitch_OnToggled;
                return;
            }

            int value = (int)emoteIdBox.Value;
            GetInstance().WriteMemory(UnlocksCheatsFh5.EmoteDetourAddress + 0x20, value);
            GetInstance().WriteMemory(UnlocksCheatsFh5.EmoteDetourAddress + 0x1F, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }

        private void EmoteIdBox_OnValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {
            if (UnlocksCheatsFh5.EmoteDetourAddress == 0 || e.NewValue == null)
            {
                return;
            }

            int value = (int)e.NewValue.Value;
            GetInstance().WriteMemory(UnlocksCheatsFh5.EmoteDetourAddress + 0x20, value);
        }

        private async void SellHackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.SellFactorDetourAddress == 0)
            {
                await MiscCheats.CheatSellFactor();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.SellFactorDetourAddress == 0)
            {
                toggleSwitch.Toggled -= SellHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += SellHackToggle_Toggled;
                return;
            }

            int value = (int)SellBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.SellFactorDetourAddress + 0x1D, value);
            GetInstance().WriteMemory(MiscCheats.SellFactorDetourAddress + 0x1C, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }

        private void SellBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {
            if (MiscCheats.SellFactorDetourAddress != 0)
            {
                int value = (int)SellBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.SellFactorDetourAddress + 0x1D, value);
            }
        }

        private async void PrizeHackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.PrizeScaleDetourAddress == 0)
            {
                await MiscCheats.CheatPrizeScale();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.PrizeScaleDetourAddress == 0)
            {
                toggleSwitch.Toggled -= PrizeHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += PrizeHackToggle_Toggled;
                return;
            }

            float value = (float)PrizeBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.PrizeScaleDetourAddress + 0x1c, value);
            GetInstance().WriteMemory(MiscCheats.PrizeScaleDetourAddress + 0x1b, toggleSwitch.IsOn ? (byte)1 : (byte)0);

        }

        private void PrizeBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {
            if (MiscCheats.PrizeScaleDetourAddress!=0)
            {
                float value = (float)PrizeBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.PrizeScaleDetourAddress + 0x1c, value);
            }
        }
    }
}
