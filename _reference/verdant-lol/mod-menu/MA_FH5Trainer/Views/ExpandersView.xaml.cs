using System.Windows.Controls;
using MA_FH5Trainer.Converters;
using MA_FH5Trainer.Resources.Theme;
using MA_FH5Trainer.ViewModels.Windows;
using MA_FH5Trainer.Views.Windows;

namespace MA_FH5Trainer.Views;

public partial class ExpandersView : Page
{
    public ExpandersView()
    {
        DataContext = this;
        ViewModel = MainWindow.Instance!.ViewModel;
        Theming = Theming.GetInstance();
        InitializeComponent();
    }
    
    public MainWindowViewModel ViewModel { get; }
    public Theming Theming { get; }
}