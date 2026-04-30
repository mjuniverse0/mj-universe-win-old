using CommunityToolkit.Mvvm.ComponentModel;
using MA_FH5Trainer.Models;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;

public partial class HandlingViewModel : ObservableObject
{
    [ObservableProperty]
    private bool _areUiElementsEnabled = true;

    [ObservableProperty]
    private double _accelValue;
    
    [ObservableProperty]
    private double _gravityValue;

    [ObservableProperty]
    private bool _isAccelEnabled;
    
    [ObservableProperty]
    private bool _isGravityEnabled;
}