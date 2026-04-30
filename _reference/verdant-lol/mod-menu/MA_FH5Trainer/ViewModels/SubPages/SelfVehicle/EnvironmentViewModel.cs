using CommunityToolkit.Mvvm.ComponentModel;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;

public partial class EnvironmentViewModel : ObservableObject
{
    [ObservableProperty]
    private bool _areSunRgbUiElementsEnabled = true;
    
    [ObservableProperty]
    private bool _areManualTimeUiElementsEnabled = true;
}