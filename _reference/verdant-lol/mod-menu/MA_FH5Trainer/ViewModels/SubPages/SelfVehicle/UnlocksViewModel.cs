using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using MA_FH5Trainer.Cheats.ForzaHorizon5;
using static MA_FH5Trainer.Resources.Cheats;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;

public partial class UnlocksViewModel : ObservableObject
{
    [ObservableProperty]
    private bool _areUiElementsEnabled = true;

    [ObservableProperty]
    private bool _wasComboBoxLoaded;

    [ObservableProperty]
    private bool _isXpEnabled;
    
    [ObservableProperty]
    private bool _isCreditsEnabled;
    
    [ObservableProperty]
    private bool _isSkillPointsEnabled;
    
    [ObservableProperty]
    private bool _isWheelspinsEnabled;
    
    [ObservableProperty]
    private bool _isAccoladesEnabled;
    
    [ObservableProperty]
    private bool _isKudosEnabled;
    
    [ObservableProperty]
    private bool _isForzathonEnabled;
    
    [ObservableProperty]
    private bool _isSeriesEnabled;
    
    [ObservableProperty]
    private bool _isSeasonalEnabled;
    
    [ObservableProperty]
    private int _xpValue;
    
    [ObservableProperty]
    private int _creditsValue;
    
    [ObservableProperty]
    private int _skillPointsValue;
    
    [ObservableProperty]
    private int _wheelspinsValue;
    
    [ObservableProperty]
    private int _accoladesValue;
    
    [ObservableProperty]
    private int _kudosValue;
    
    [ObservableProperty]
    private int _forzathonValue;
    
    [ObservableProperty]
    private int _seriesValue;
    
    [ObservableProperty]
    private int _seasonalValue;

    [RelayCommand]
    private async Task InstantAdd(object param)
    {
        var (param1, param2) = (Tuple<object, object>)param;
        float value = (float)(double)param1;
        UnlocksCheats unl = GetClass<UnlocksCheats>();
        
        UnlocksCheats.EPerkType type = (int)param2 switch
        {
            0 => UnlocksCheats.EPerkType.Credits,
            1 => UnlocksCheats.EPerkType.XP,
            2 => UnlocksCheats.EPerkType.FP,
            _ => 0
        };
        await unl.CheatPerkPrize(value, type);
    }
}