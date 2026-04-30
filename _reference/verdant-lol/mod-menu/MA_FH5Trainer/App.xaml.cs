using System.Windows;
using MA_FH5Trainer.Cheats;
using MA_FH5Trainer.Models;
using MA_FH5Trainer.Resources;
using MA_FH5Trainer.Resources.Keybinds;
using MA_FH5Trainer.Services;
using MA_FH5Trainer.ViewModels.Windows;
using MA_FH5Trainer.Views.Windows;
using MahApps.Metro.Controls;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using static MA_FH5Trainer.Resources.Cheats;

namespace MA_FH5Trainer;

public partial class App
{
    private const string MutexName = "{(4A771E61-6684-449F-8952-B31582A8877E)}";
    private Mutex _mutex = null!;

    private static readonly IHost Host = Microsoft.Extensions.Hosting.Host.CreateDefaultBuilder()
        .ConfigureAppConfiguration(c =>
        {
            c.SetBasePath(AppContext.BaseDirectory);
        }).
        ConfigureServices((_, services) =>
        {
            services.AddHostedService<ApplicationHostService>();
            services.AddSingleton<MetroWindow, MainWindow>();
        }).Build();
    
    public static T GetRequiredService<T>() where T : class
    {
        return Host.Services.GetRequiredService<T>();
    }
    
    private async void App_OnStartup(object sender, StartupEventArgs e)
    {
        await Host.StartAsync();
        //HotkeysManager.SetupSystemHook();
    }

    private async void App_OnExit(object sender, ExitEventArgs e)
    {
        //HotkeysManager.ShutdownSystemHook();
        DisconnectFromGame();
        
        await Host.StopAsync();
        Host.Dispose();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        _mutex = new Mutex(true, MutexName, out var createdNew);

        if (createdNew)
        {
            base.OnStartup(e);
            SetupExceptionHandling();
        }
        else
        {
            MessageBox.Show("Another instance of the tool is already running.", "Information", MessageBoxButton.OK, MessageBoxImage.Asterisk);
            Current.Shutdown();
        }
    }
    
    // https://stackoverflow.com/a/46804709
    private void SetupExceptionHandling()
    {
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
            ReportException((Exception)e.ExceptionObject, "AppDomain.CurrentDomain.UnhandledException");

        DispatcherUnhandledException += (_, e) =>
        {
            ReportException(e.Exception, "Application.Current.DispatcherUnhandledException");
            e.Handled = true;
        };

        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            ReportException(e.Exception, "TaskScheduler.UnobservedTaskException");
            e.SetObserved();
        };
    }
    
    private static void ReportException(Exception exception, string source)
    {
        MessageBox.Show(
            $"An unexpected error happened.\nThe application will terminate after you press \"OK\".\n\n\nPlease (Press Ctrl+C) to copy, and make an issue on the github repository or post the copied text in our discord server (discord.gg/rHzev9brJ3)\n\nSource:{source}\nException:{exception.Message}\nException Callstack:{exception.StackTrace}\n\nTool Version: {System.Reflection.Assembly.GetExecutingAssembly().GetName().Version}\nGame: {GameVerPlat.GetInstance().Name}\nGame Version: {GameVerPlat.GetInstance().Update}\nPlatform: {GameVerPlat.GetInstance().Platform}",
            "MA_FH5Trainer - Error",
            0,
            MessageBoxImage.Error
        );
        
        Environment.Exit(1);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try
        {
            _mutex.ReleaseMutex();
        }
        catch (ApplicationException)
        {
        }
        finally
        {
            _mutex.Dispose();
        }
        
        base.OnExit(e);
    }

    private static void DisconnectFromGame()
    {
        foreach (var cheatInstance in g_CachedInstances.Where(kv => typeof(ICheatsBase).IsAssignableFrom(kv.Key)))
        {
            ((ICheatsBase)cheatInstance.Value).Cleanup();
        }
        _ = Imports.CloseHandle(MA_FH5Trainer.Resources.Memory.GetInstance().MProc.Handle);
    }
}