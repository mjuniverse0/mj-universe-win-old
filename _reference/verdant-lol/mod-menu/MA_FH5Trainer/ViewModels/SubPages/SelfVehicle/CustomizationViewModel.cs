using CommunityToolkit.Mvvm.ComponentModel;
using MA_FH5Trainer.Models;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;

public partial class CustomizationViewModel : ObservableObject
{
    public bool IsFh5 => GameVerPlat.GetInstance().Type == GameVerPlat.GameType.Fh5;
    
    [ObservableProperty]
    private bool _areMainUiElementsEnabled = true;
    
    [ObservableProperty]
    private bool _areHeadlightUiElementsEnabled = false;
    
    [ObservableProperty]
    private bool _areBackfireUiElementsEnabled = false;
    
    [ObservableProperty]
    private bool _dirtEnabled;
    
    [ObservableProperty]
    private float _dirtValue;

    [ObservableProperty]
    private bool _mudEnabled;
    
    [ObservableProperty]
    private float _mudValue;

    [ObservableProperty]
    private bool _glowingPaintIsOn;
    
    [ObservableProperty]
    private bool _glowingPaintEnabled;
    
    [ObservableProperty]
    private float _glowingPaintValue;

    [ObservableProperty]
    private bool _forceLodEnabled;
    
    [ObservableProperty]
    private int _forceLodValue;
}