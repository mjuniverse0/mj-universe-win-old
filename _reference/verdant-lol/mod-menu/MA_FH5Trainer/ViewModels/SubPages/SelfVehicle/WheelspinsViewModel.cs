using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using MA_FH5Trainer.Cheats.ForzaHorizon5;
using System.Security.Policy;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;
public partial class WheelspinsViewModel : ObservableObject
{
    [RelayCommand]
    private async Task Wheelspins(object param)
    {
        float value = (float)(double)param;
        UnlocksCheats unl = MA_FH5Trainer.Resources.Cheats.GetClass<UnlocksCheats>();
        await unl.CheatWheelspins(value);
    }

    [RelayCommand]
    private async Task SuperWheelspins(object param)
    {
        float value = (float)(double)param;
        UnlocksCheats unl = MA_FH5Trainer.Resources.Cheats.GetClass<UnlocksCheats>();
        await unl.CheatSuperWheelspins(value);
    }
}