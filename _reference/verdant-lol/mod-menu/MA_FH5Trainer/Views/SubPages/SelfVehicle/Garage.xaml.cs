using System.Windows.Controls;
using MA_FH5Trainer.Resources.Theme;
using MA_FH5Trainer.ViewModels.Pages;
using MA_FH5Trainer.Views.Windows;
using MahApps.Metro.Controls;

namespace MA_FH5Trainer.Views.SubPages.SelfVehicle;

public partial class Garage : Page
{
    public Garage()
    {
        ViewModel = new AutoshowViewModel();
        DataContext = this;
        InitializeComponent();
    }
    
    public AutoshowViewModel ViewModel { get; }
}