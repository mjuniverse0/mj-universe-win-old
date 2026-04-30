namespace MA_FH5Trainer.Models;

/// <summary>One card on the mod dashboard; opens a subpage <see cref="PageType" /> when activated.</summary>
public sealed class ModFeatureItem
{
    public required string Title { get; init; }
    public required string Subtitle { get; init; }
    public required string IconKind { get; init; }
    public required System.Type PageType { get; init; }
}
