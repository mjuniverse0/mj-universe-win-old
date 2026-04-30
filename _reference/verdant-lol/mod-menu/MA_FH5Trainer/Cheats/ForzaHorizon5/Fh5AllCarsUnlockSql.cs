namespace MA_FH5Trainer.Cheats.ForzaHorizon5;

/// <summary>SQL for Autoshow unlock + “all cars in garage” (FH5 in-memory SQL API).</summary>
public static class Fh5AllCarsUnlockSql
{
    public const string AllCarsOn =
        "CREATE TABLE AutoshowTable AS SELECT * FROM Data_Car; UPDATE Data_Car SET NotAvailableInAutoshow = 0; DROP VIEW Drivable_Data_Car; CREATE VIEW Drivable_Data_Car AS SELECT * FROM Data_Car; CREATE TABLE BucketsOriginal AS SELECT * FROM Data_Car_Buckets; INSERT INTO Data_Car_Buckets(CarId) SELECT Id FROM Data_Car WHERE Id NOT IN (SELECT CarId FROM Data_Car_Buckets); UPDATE Data_Car_Buckets SET CarBucket=0, BucketHero=0 WHERE CarBucket IS NULL;";

    public const string AllCarsOff =
        "UPDATE Data_Car SET NotAvailableInAutoshow = (SELECT NotAvailableInAutoshow FROM AutoshowTable WHERE Data_Car.Id == AutoshowTable.Id); DROP TABLE AutoshowTable; DELETE FROM Data_Car_Buckets; INSERT INTO Data_Car_Buckets SELECT * FROM BucketsOriginal; DROP TABLE BucketsOriginal; DROP VIEW Drivable_Data_Car; CREATE VIEW Drivable_Data_Car AS SELECT Data_Car.* FROM Data_Car WHERE Id NOT IN (SELECT Ordinal FROM UnobtainableCars);";

    /// <summary>Inserts one garage row per car the profile does not already own (uses default columns).</summary>
    public const string AddAllCarsToGarage =
        "INSERT INTO Profile0_Career_Garage (CarId) SELECT Id FROM Data_Car WHERE Id NOT IN (SELECT CarId FROM Profile0_Career_Garage);";

    /// <summary>Autoshow (alle biler i handelen) + rad i garasjen for hver bil — «alle biler i spillet» for én profil.</summary>
    public static string AddAllCarsToGame => $"{AllCarsOn}{AddAllCarsToGarage}";
}
