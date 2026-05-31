using System.IO;
using System.Text.Json;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using MahApps.Metro.Controls;

namespace MA_FH5Trainer.Resources.Keybinds;

// https://github.com/AngryCarrot789/KeyDownTester/blob/master/KeyDownTester/Keys/GlobalHotkey.cs
public partial class GlobalHotkey : ObservableObject
{
    public string Name { get; }
    public Action Callback { get; }

    public ModifierKeys Modifier { get; set; }
    public Key Key{ get; set; }

    public bool IsPressed { get; set; }
    public bool CanExecute { get; set; }
    public int Interval { get; set; }
    
    [ObservableProperty]
    private HotKey _hotkey = new(Key.None);

    public GlobalHotkey(string name, ModifierKeys modifier, Key key, Action callback, int interval = 250, bool canExecute = false)
    {
        Name = name;
        Modifier = modifier;
        Key = key;
        Callback = callback;
        Interval = interval;
        CanExecute = canExecute;
    }
    
    private class HotkeyData
    {
        public HotkeyData(string modifier, string key)
        {
            Modifier = modifier;
            Key = key;
        }

        public string Modifier { get; set; }
        public string Key { get; set; }
    }
    
    public void Save()
    {
        var data = new HotkeyData(Modifier.ToString(),Key.ToString());
        string json = JsonSerializer.Serialize(data);
        string path = GetSavePath();
        File.WriteAllText(path, json);
    }

    public void Load()
    {
        string path = GetSavePath();
        if (!File.Exists(path))
        {
            return;
        }

        string json = File.ReadAllText(path);
        var data = JsonSerializer.Deserialize<HotkeyData>(json);
        if (data == null)
        {
            return;
        }

        if (Enum.TryParse(data.Modifier, out ModifierKeys mod))
        {
            Modifier = mod;
        }

        if (Enum.TryParse(data.Key, out Key key))
        {
            Key = key;
        }

        Hotkey = new HotKey(Key, Modifier);
    }

    private string GetSavePath()
    {
        string tempDir = Path.Combine(Path.GetTempPath(), "GlobalHotkeys");
        Directory.CreateDirectory(tempDir);
        return Path.Combine(tempDir, $"{Name}.json");
    }
}