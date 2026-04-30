using MA_FH5Trainer.Cheats.ForzaHorizon5;
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
    /// Interaction logic for TimerFreezes.xaml
    /// </summary>
    public partial class TimerFreezes : Page
    {
        public TimerFreezes()
        {
            InitializeComponent();
        }

        public MiscCheats MiscCheats = MA_FH5Trainer.Resources.Cheats.GetClass<MiscCheats>();

        private async void ToggleSwitch_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.RaceTimeScaleDetourAddress == 0)
            {
                await MiscCheats.CheatRaceTimeScale();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.RaceTimeScaleDetourAddress == 0)
            {
                toggleSwitch.Toggled -= ToggleSwitch_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += ToggleSwitch_Toggled;
                return;
            }

            bool toggled = toggleSwitch.IsOn;
            GetInstance().WriteMemory(MiscCheats.RaceTimeScaleDetourAddress + 0x34, toggled ? (byte)1 : (byte)0);
            GetInstance().WriteMemory(MiscCheats.RaceTimeScaleDetourAddress + 0x35, 0f);
        }

        private async void ToggleSwitch_Toggled_1(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.TrailblazerTimeScaleDetourAddress == 0)
            {
                await MiscCheats.CheatTrailblazerTimeScale();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.TrailblazerTimeScaleDetourAddress == 0)
            {
                toggleSwitch.Toggled -= ToggleSwitch_Toggled_1;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += ToggleSwitch_Toggled_1;
                return;
            }

            bool toggled = toggleSwitch.IsOn;
            GetInstance().WriteMemory(MiscCheats.TrailblazerTimeScaleDetourAddress + 0x22, toggled ? (byte)1 : (byte)0);
            GetInstance().WriteMemory(MiscCheats.TrailblazerTimeScaleDetourAddress + 0x23, 0f);
        }

        private async void ToggleSwitch_Toggled_2(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.MissionTimeScaleDetourAddress == 0)
            {
                await MiscCheats.CheatMissionTimeScale();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.MissionTimeScaleDetourAddress == 0)
            {
                toggleSwitch.Toggled -= ToggleSwitch_Toggled_1;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += ToggleSwitch_Toggled_1;
                return;
            }

            bool toggled = toggleSwitch.IsOn;
            GetInstance().WriteMemory(MiscCheats.MissionTimeScaleDetourAddress + 0x22, toggled ? (byte)1 : (byte)0);
            GetInstance().WriteMemory(MiscCheats.MissionTimeScaleDetourAddress + 0x23, 0f);
        }
    }
}
