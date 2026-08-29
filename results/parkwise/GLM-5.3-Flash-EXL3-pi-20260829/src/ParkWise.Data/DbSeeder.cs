using Microsoft.EntityFrameworkCore;
using ParkWise.Contracts;
using ParkWise.Data.Entities;
using ParkWise.Services;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Options;

namespace ParkWise.Data;

/// <summary>Idempotent seeder: bays from GarageOptions, seeded operators, one demo permit.</summary>
public static class DbSeeder
{
    public static async Task SeedAsync(ParkWiseDbContext db, GarageOptions garage, AuthOptions auth, IPasswordHasher hasher, CancellationToken ct = default)
    {
        if (!await db.Bays.AnyAsync(ct))
        {
            foreach (var spec in garage.Bays)
            {
                if (!Enum.TryParse<BayType>(spec.Type, ignoreCase: true, out var type))
                {
                    continue; // validation already rejected unknown types at boot
                }
                for (var i = 0; i < spec.Count; i++)
                {
                    db.Bays.Add(new Bay { Id = Guid.NewGuid(), Level = spec.Level, Type = type, Status = BayStatus.Free });
                }
            }
        }

        await EnsureOperatorAsync(db, auth.AdminUsername, auth.AdminPassword, "admin", hasher, ct);
        await EnsureOperatorAsync(db, auth.AttendantUsername, auth.AttendantPassword, "attendant", hasher, ct);

        if (!await db.Permits.AnyAsync(ct))
        {
            var now = DateTime.UtcNow;
            db.Permits.Add(new Permit
            {
                Code = "PERMIT-001",
                Plate = "AB-123-CD",
                ValidFrom = now.AddDays(-30),
                ValidUntil = now.AddDays(330),
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task EnsureOperatorAsync(ParkWiseDbContext db, string username, string password, string role, IPasswordHasher hasher, CancellationToken ct)
    {
        if (await db.Operators.AnyAsync(u => u.Username == username, ct))
        {
            return;
        }
        db.Operators.Add(new OperatorUser
        {
            Id = Guid.NewGuid(),
            Username = username,
            Role = role,
            PasswordHash = hasher.Hash(password),
        });
    }
}
