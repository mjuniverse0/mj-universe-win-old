using MA_FH5Trainer.Cheats.ForzaHorizon5;
using MA_FH5Trainer.ViewModels.SubPages;
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
    /// Interaction logic for Multipliers.xaml
    /// </summary>
    public partial class Multipliers : Page
    {
        public Multipliers()
        {
            DataContext = this;
            ViewModel = new MultipliersViewModel();
            InitializeComponent();
        }

        public MultipliersViewModel ViewModel { get; }
        public MiscCheats MiscCheats = MA_FH5Trainer.Resources.Cheats.GetClass<MiscCheats>();

        private async void DriftHackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.DriftScoreMultiplierDetourAddress == 0)
            {
                await MiscCheats.CheatDriftScoreMultiplier();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.DriftScoreMultiplierDetourAddress == 0)
            {
                toggleSwitch.Toggled -= DriftHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += DriftHackToggle_Toggled;
                return;
            }

            float value = (float)DriftBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.DriftScoreMultiplierDetourAddress + 0x20, value);
            GetInstance().WriteMemory(MiscCheats.DriftScoreMultiplierDetourAddress + 0x1F, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }

        private void DriftBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {
            if (MiscCheats.DriftScoreMultiplierDetourAddress!=0)
            {
                float value = (float)DriftBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.DriftScoreMultiplierDetourAddress + 0x20, value);
            }
        }

        private void SpeedBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {

            if (MiscCheats.SpeedZoneMultiplierDetourAddress != 0)
            {
                float value = (float)SpeedBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.SpeedZoneMultiplierDetourAddress + 0x20, value);
            }
        }

        private async void SpeedHackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.SpeedZoneMultiplierDetourAddress == 0)
            {
                await MiscCheats.CheatSpeedZoneMultiplier();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.SpeedZoneMultiplierDetourAddress == 0)
            {
                toggleSwitch.Toggled -= SpeedHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += SpeedHackToggle_Toggled;
                return;
            }

            float value = (float)SpeedBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.SpeedZoneMultiplierDetourAddress + 0x20, value);
            GetInstance().WriteMemory(MiscCheats.SpeedZoneMultiplierDetourAddress + 0x1F, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }

        private void SignBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {

            if (MiscCheats.DangerSign1DetourAddress != 0 &&
                MiscCheats.DangerSign2DetourAddress != 0 &&
                MiscCheats.DangerSign3DetourAddress != 0)
            {
                float value = (float)SignBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.DangerSign1DetourAddress + 0x38, value);
                GetInstance().WriteMemory(MiscCheats.DangerSign2DetourAddress + 0x35, value);
                GetInstance().WriteMemory(MiscCheats.DangerSign3DetourAddress + 0x35, value);
            }
        }

        private async void SignHackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.DangerSign1DetourAddress == 0 || MiscCheats.DangerSign2DetourAddress == 0 || MiscCheats.DangerSign3DetourAddress == 0)
            {
                await MiscCheats.CheatDangerSignMultiplier();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.DangerSign1DetourAddress == 0 || MiscCheats.DangerSign2DetourAddress == 0 || MiscCheats.DangerSign3DetourAddress == 0)
            {
                toggleSwitch.Toggled -= SignHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += SignHackToggle_Toggled;
                return;
            }

            float value = (float)SignBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.DangerSign1DetourAddress + 0x38, value);
            GetInstance().WriteMemory(MiscCheats.DangerSign2DetourAddress + 0x35, value);
            GetInstance().WriteMemory(MiscCheats.DangerSign3DetourAddress + 0x35, value);
            GetInstance().WriteMemory(MiscCheats.DangerSign1DetourAddress + 0x37, toggleSwitch.IsOn ? (byte)1 : (byte)0);
            GetInstance().WriteMemory(MiscCheats.DangerSign2DetourAddress + 0x34, toggleSwitch.IsOn ? (byte)1 : (byte)0);
            GetInstance().WriteMemory(MiscCheats.DangerSign3DetourAddress + 0x34, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }

        private async void TrapHackToggle_Toggled(object sender, RoutedEventArgs e)
        {

            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.SpeedTrapMultiplierDetourAddress == 0)
            {
                await MiscCheats.CheatSpeedTrapMultiplier();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.SpeedTrapMultiplierDetourAddress == 0)
            {
                toggleSwitch.Toggled -= TrapHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += TrapHackToggle_Toggled;
                return;
            }

            float value = (float)TrapBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.SpeedTrapMultiplierDetourAddress + 0x35, value);
            GetInstance().WriteMemory(MiscCheats.SpeedTrapMultiplierDetourAddress + 0x34, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }
        private void TrapBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {
            if (MiscCheats.SpeedTrapMultiplierDetourAddress != 0 )
            {
                float value = (float)TrapBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.SpeedTrapMultiplierDetourAddress + 0x35, value);
            }
        }

        private async void SkillHackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (sender is not ToggleSwitch toggleSwitch)
            {
                return;
            }

            toggleSwitch.IsEnabled = false;
            if (MiscCheats.SkillScoreMultiplierDetourAddress == 0)
            {
                await MiscCheats.CheatSkillScoreMultiplier();
            }
            toggleSwitch.IsEnabled = true;

            if (MiscCheats.SkillScoreMultiplierDetourAddress == 0)
            {
                toggleSwitch.Toggled -= SkillHackToggle_Toggled;
                toggleSwitch.IsOn = false;
                toggleSwitch.Toggled += SkillHackToggle_Toggled;
                return;
            }

            int value = (int)SkillBox!.Value.GetValueOrDefault();
            GetInstance().WriteMemory(MiscCheats.SkillScoreMultiplierDetourAddress + 0x1d, value);
            GetInstance().WriteMemory(MiscCheats.SkillScoreMultiplierDetourAddress + 0x1c, toggleSwitch.IsOn ? (byte)1 : (byte)0);
        }

        private void SkillBox_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double?> e)
        {
            if (MiscCheats.SkillScoreMultiplierDetourAddress != 0)
            {

                int value = (int)SkillBox!.Value.GetValueOrDefault();
                GetInstance().WriteMemory(MiscCheats.SkillScoreMultiplierDetourAddress + 0x1d, value);
            }

        }
    }
}
