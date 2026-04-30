using CommunityToolkit.Mvvm.ComponentModel;
using MA_FH5Trainer.Models;

namespace MA_FH5Trainer.ViewModels.SubPages.SelfVehicle;

public partial class MiscViewModel : ObservableObject
{
    public bool IsFh5 => GameVerPlat.GetInstance().Type == GameVerPlat.GameType.Fh5;
    
    [ObservableProperty]
    private bool _spooferUiElementsEnabled = true;
    
    [ObservableProperty]
    private bool _mainUiElementsEnabled = true;
    
    [ObservableProperty]
    private bool _spinPrizeScaleEnabled;
    
    [ObservableProperty]
    private bool _spinSellFactorEnabled;
    
    [ObservableProperty]
    private bool _skillScoreMultiplierEnabled;
    
    [ObservableProperty]
    private bool _driftScoreMultiplierEnabled;
    
    [ObservableProperty]
    private bool _skillTreeWideEditEnabled;
    
    [ObservableProperty]
    private bool _skillTreeCostEnabled;
    
    [ObservableProperty]
    private bool _missionTimeScaleEnabled;
    
    [ObservableProperty]
    private bool _trailblazerTimeScaleEnabled;
    
    [ObservableProperty]
    private bool _speedZoneMultiplierEnabled;
    
    [ObservableProperty]
    private float _spinPrizeScaleValue;
    
    [ObservableProperty]
    private bool _raceTimeScaleEnabled;
    
    [ObservableProperty]
    private bool _dangerSignMultiplierEnabled;
    
    [ObservableProperty]
    private bool _speedTrapMultiplierEnabled;
    
    [ObservableProperty]
    private bool _droneModeHeightEnabled;
    
    [ObservableProperty]
    private int _spinSellFactorValue = 999;
    
    [ObservableProperty]
    private int _skillScoreMultiplierValue = 10;
    
    [ObservableProperty]
    private float _driftScoreMultiplierValue = 5;
    
    [ObservableProperty]
    private float _skillTreeWideEditValue = 10000;
    
    [ObservableProperty]
    private int _skillTreeCostValue;
    
    [ObservableProperty]
    private float _missionTimeScaleValue = 0.5f;
    
    [ObservableProperty]
    private float _trailblazerTimeScaleValue = 0.5f;
    
    [ObservableProperty]
    private float _speedZoneMultiplierValue = 5;
    
    [ObservableProperty]
    private float _raceTimeScaleValue = 0.5f;
    
    [ObservableProperty]
    private float _dangerSignMultiplierValue = 5f;
    
    [ObservableProperty]
    private float _speedTrapMultiplierValue = 5f;
    
    [ObservableProperty]
    private float _droneModeHeightValue = 5f;
}
