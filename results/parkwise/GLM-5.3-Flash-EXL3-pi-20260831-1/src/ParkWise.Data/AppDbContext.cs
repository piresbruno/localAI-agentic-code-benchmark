using Microsoft.EntityFrameworkCore;
using ParkWise.Services.Domain;

namespace ParkWise.Data;

/// <summary>EF Core context for the garage store; schema is created automatically on boot.</summary>
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<PaymentReceipt> Payments => Set<PaymentReceipt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
