using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using MA_FH5Trainer.Views.Windows;

namespace MA_FH5Trainer.ViewModels.SubPages;

public partial class MultipliersViewModel : ObservableObject
{
    [ObservableProperty]
    private bool m_driftComponentsEnabled = true;

    [ObservableProperty]
    private bool m_speedComponentsEnabled = true;

    [ObservableProperty]
    private bool m_signComponentsEnabled = true;

    [ObservableProperty]
    private bool m_trapComponentsEnabled = true;

}