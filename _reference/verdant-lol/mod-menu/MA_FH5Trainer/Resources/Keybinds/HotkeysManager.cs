using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;

namespace MA_FH5Trainer.Resources.Keybinds;

public static partial class HotkeysManager
{
    private static readonly List<GlobalHotkey> s_hotkeys = [];
    private static readonly LowLevelKeyboardProc s_lowLevelProc = HookCallback;
    private static IntPtr s_hookId = IntPtr.Zero;
    private static readonly object s_hookLock = new object();
    private static bool s_isCheckingHotkeys = false;
    private static int s_hookRetryCount = 0;
    private const int MAX_HOOK_RETRIES = 3;

    public static void SaveAll()
    {
        foreach (var hotkey in s_hotkeys)
        {
            hotkey.Save();
        }
    }

    /// <summary>
    /// Sets up the system hook to capture keyboard events
    /// </summary>
    /// <returns>True if the hook was successfully set up, false otherwise</returns>
    public static bool SetupSystemHook()
    {
        lock (s_hookLock)
        {
            if (s_hookId != IntPtr.Zero)
            {
                return true;
            }

            s_hookRetryCount = 0;
            return AttemptHookSetup();
        }
    }

    private static bool AttemptHookSetup()
    {
        s_hookRetryCount++;
        if (s_hookRetryCount >= MAX_HOOK_RETRIES)
        {
            MessageBox.Show($"Failed to setup hotkeys after {MAX_HOOK_RETRIES} attempts. Hotkeys will not work!\n\nLast error: {GetLastWin32ErrorMessage()}",
                "MA_FH5Trainer - Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }

        try
        {
            if (s_hookId != IntPtr.Zero)
            {
                UnhookWindowsHookEx(s_hookId);
                s_hookId = IntPtr.Zero;
            }

            s_hookId = SetHook(s_lowLevelProc);
            if (s_hookId != IntPtr.Zero)
            {
                return true;
            }

            if (s_hookRetryCount >= MAX_HOOK_RETRIES)
            {
                return false;
            }
                
            bool result = false;
            Task.Delay(500).ContinueWith(_ => 
            {
                result = AttemptHookSetup();
            });
                    
            return result;

        }
        catch (Exception ex)
        {
            if (s_hookRetryCount < MAX_HOOK_RETRIES)
            {
                bool result = false;
                Task.Delay(500).ContinueWith(_ => 
                {
                    result = AttemptHookSetup();
                });
                    
                return result;
            }
                
            MessageBox.Show($"Exception setting up hotkeys: {ex.Message}",
                "MA_FH5Trainer - Error", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    /// <summary>
    /// Gets a human-readable message for the last Win32 error
    /// </summary>
    private static string GetLastWin32ErrorMessage()
    {
        int error = Marshal.GetLastWin32Error();
        if (error == 0)
        {
            return "No error";
        }

        return new Win32Exception(error).Message;
    }

    /// <summary>
    /// Shuts down the system hook and releases resources
    /// </summary>
    public static bool ShutdownSystemHook()
    {
        lock (s_hookLock)
        {
            if (s_hookId == IntPtr.Zero)
            {
                return true;
            }

            try
            {
                bool result = UnhookWindowsHookEx(s_hookId);
                int error = Marshal.GetLastWin32Error();
                    
                if (!result && error != 0)
                {
                    return false;
                }
                    
                s_hookId = IntPtr.Zero;
                return true;
            }
            catch (Exception)
            {
                s_hookId = IntPtr.Zero;
                return false;
            }
        }
    }

    public static void Register(GlobalHotkey hotkey)
    {
        ArgumentNullException.ThrowIfNull(hotkey);
        s_hotkeys.Add(hotkey);
        hotkey.Load();
    }

    public static bool CheckExists(Key key, ModifierKeys modifierKeys)
    {
        return s_hotkeys.Any(globalHotkey => globalHotkey.Key == key && globalHotkey.Modifier == modifierKeys);
    }

    private static readonly object s_checkLock = new object();

    private static async void CheckHotkeys()
    {
        lock (s_checkLock)
        {
            if (s_isCheckingHotkeys)
            {
                return;
            }

            s_isCheckingHotkeys = true;
        }

        try
        {
            await Application.Current.Dispatcher.InvokeAsync(async () =>
            {
                foreach (var hotkey in s_hotkeys)
                {
                    if (Keyboard.Modifiers == hotkey.Modifier && hotkey.Key != Key.None && hotkey.CanExecute)
                    {
                        if (hotkey.IsPressed)
                        {
                            continue;
                        }
                            
                        hotkey.IsPressed = true;
                        while (Keyboard.IsKeyDown(hotkey.Key))
                        {
                            hotkey.Callback();
                            await Task.Delay(hotkey.Interval);
                        }
                        hotkey.IsPressed = false;
                    }
                }
            });
        }
        catch (TaskCanceledException)
        {
            // Ignore task cancellation
        }
        catch (Exception)
        {
            // ignored
        }
        finally
        {
            s_isCheckingHotkeys = false;
        }
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc)
    {
        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule;
            
        if (curModule == null)
        {
            return IntPtr.Zero;
        }
            
        IntPtr moduleHandle = GetModuleHandle(curModule.ModuleName);
        if (moduleHandle == IntPtr.Zero)
        {
            return IntPtr.Zero;
        }
            
        const int WH_KEYBOARD_LL = 13;
        IntPtr hookId = SetWindowsHookEx(WH_KEYBOARD_LL, proc, moduleHandle, 0);
        return hookId;
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode < 0)
        {
            return CallNextHookEx(s_hookId, nCode, wParam, lParam);
        }
            
        const int WM_KEYDOWN = 0x0100;
        const int WM_SYSKEYDOWN = 0x0104;
                
        int msgType = wParam.ToInt32();
        if (msgType != WM_KEYDOWN && msgType != WM_SYSKEYDOWN)
        {
            return CallNextHookEx(s_hookId, nCode, wParam, lParam);
        }

        if (!s_isCheckingHotkeys)
        {
            Task.Run(CheckHotkeys);
        }

        return CallNextHookEx(s_hookId, nCode, wParam, lParam);
    }
        
    #region Native Methods

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [LibraryImport("user32.dll", EntryPoint = "SetWindowsHookExW", SetLastError = true)]
    private static partial IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool UnhookWindowsHookEx(IntPtr hhk);

    [LibraryImport("user32.dll", SetLastError = true)]
    private static partial IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [LibraryImport("kernel32.dll", EntryPoint = "GetModuleHandleW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    private static partial IntPtr GetModuleHandle(string lpModuleName);

    #endregion
}