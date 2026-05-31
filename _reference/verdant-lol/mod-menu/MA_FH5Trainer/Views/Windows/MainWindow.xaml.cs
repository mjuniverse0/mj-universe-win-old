using System.ComponentModel;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Navigation;
using MA_FH5Trainer.Models;
using MA_FH5Trainer.Resources.Keybinds;
using MA_FH5Trainer.Resources.Theme;
using MA_FH5Trainer.ViewModels.Windows;

namespace MA_FH5Trainer.Views.Windows;

public partial class MainWindow
{
    private readonly GlobalHotkey _stateInfoHotkey = new("State Info", ModifierKeys.None, Key.F3, ShowStateInfo, 500, true);

    public MainWindow()
    {
        Instance = this;
        ViewModel = new MainWindowViewModel();
        DataContext = this;
        Loaded += (_, _) =>
        {
            ViewModel.HotkeysEnabled = HotkeysManager.SetupSystemHook();
            set.IsEnabled = ViewModel.HotkeysEnabled;
        };

        ViewModel.MakeExpandersView();
        InitializeComponent();

        HotkeysManager.Register(_stateInfoHotkey);
        ViewModel.Hotkeys.Add(_stateInfoHotkey);
    }
    
    protected override void OnClosed(EventArgs e)
    {
        HotkeysManager.ShutdownSystemHook();
        base.OnClosed(e);
    }

    public static MainWindow? Instance { get; private set; } = null;
    public MainWindowViewModel ViewModel { get; }
    public Theming Theming => Theming.GetInstance();

    private void MainWindow_OnMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (WindowState != WindowState.Normal)
        {
            return;
        }

        var isLeftButton = e.ChangedButton == MouseButton.Left;
        if (!isLeftButton)
        {
            return;
        }

        Point position = e.GetPosition(this);
        bool isWithinTopArea = position.Y < 80;
        if (!isWithinTopArea)
        {
            return;
        }

        DragMove();
    }

    private void WindowStateAction_OnClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button button)
        {
            return;
        }

        switch (button.Tag)
        {
            case "1":
            {
                SystemCommands.MinimizeWindow(this);
                break;
            }
            case "2":
            {
                SystemCommands.CloseWindow(this);
                break;
            }
        }
    }

    private void MainWindow_OnClosing(object? sender, CancelEventArgs e)
    {
        ViewModel.Close();
    }

    private void Hyperlink_OnRequestNavigate(object sender, RequestNavigateEventArgs e)
    {
        Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true });
        e.Handled = true;
    }

    private void ButtonBase_OnClick(object sender, RoutedEventArgs e)
    {
        var button = sender as Button;
        var dataContext = button?.DataContext;
        if (dataContext is not GlobalHotkey hotkey)
        {
            MessageBox.Show("No hotkey selected", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }

        if (HotKeyBox.HotKey == null)
        {
            MessageBox.Show("No hotkey selected", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }
        
        if (HotkeysManager.CheckExists(HotKeyBox.HotKey.Key, HotKeyBox.HotKey.ModifierKeys))
        {
            MessageBox.Show("Hotkey already exists!", "Warning", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        
        hotkey.Key = HotKeyBox.HotKey.Key;
        hotkey.Modifier = HotKeyBox.HotKey.ModifierKeys;
        hotkey.Hotkey = HotKeyBox.HotKey;
    }

    private void Button_Click(object sender, RoutedEventArgs e)
    {
        HotkeysManager.SaveAll();
    }

    private void ComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (sender is not ComboBox box)
        {
            return;
        }

        GlobalHotkey? hotkey = ((GlobalHotkey?)box.SelectedItem);
        if (hotkey != null && HotKeyBox != null)
        {
            HotKeyBox.HotKey = hotkey.Hotkey;
        }
    }

    private static void ShowStateInfo()
    {
        var main = Instance;
        var vm = main?.ViewModel;
        var gvp = GameVerPlat.GetInstance();

        string attached = vm?.Attached == true ? "Attached" : "Not attached";
        string name = string.IsNullOrWhiteSpace(gvp.Name) ? "Unknown" : gvp.Name;
        string platform = string.IsNullOrWhiteSpace(gvp.Platform) ? "Unknown" : gvp.Platform;
        string version = string.IsNullOrWhiteSpace(gvp.Update) ? "Unknown" : gvp.Update;

        MessageBox.Show(
            $"State info (F3)\n\n" +
            $"Attached: {attached}\n" +
            $"Game: {name}\n" +
            $"Platform: {platform}\n" +
            $"Game Version: {version}\n" +
            $"Trainer Version: {vm?.TrainerVersion ?? "Unknown"}",
            "Verdant Mod Menu - state",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }
}