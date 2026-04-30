using CommunityToolkit.Mvvm.ComponentModel;
using MA_FH5Trainer.Models;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;

public partial class CameraViewModel : ObservableObject
{
    public bool IsFh5 => GameVerPlat.GetInstance().Type == GameVerPlat.GameType.Fh5;
    
    [ObservableProperty]
    private bool _areScanPromptLimiterUiElementsVisible = true;
    
    [ObservableProperty]
    private bool _areScanningLimiterUiElementsVisible;
    
    [ObservableProperty]
    private bool _areLimiterUiElementsVisible;
    
    [ObservableProperty]
    private bool _areCameraHookUiElementsEnabled = false;
    
    [ObservableProperty]
    private bool _areCameraOffsetUiElementsEnabled = false;

    [ObservableProperty] 
    private bool _fovEnabled = false;
    
    [ObservableProperty] 
    private bool _offsetEnabled = false;
    
}