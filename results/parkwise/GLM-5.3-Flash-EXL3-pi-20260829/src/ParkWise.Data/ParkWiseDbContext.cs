using Microsoft.EntityFrameworkCore;
using ParkWise.Data.Configurations;
using ParkWise.Data.Entities;

namespace ParkWise.Data;

/// <summary>EF Core database context for ParkWise. Storage only — no business decisions.</summary>
public class ParkWiseDbContext : DbContext
{
    public ParkWiseDbContext(DbContextOptions<ParkWiseDbContext> options)
        : base(options)
    {
    }

    public DbSet<Bay> Bays => Set<Bay>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Permit> Permits => Set<Permit>();
    public DbSet<OperatorUser> Operators => Set<OperatorUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new BayConfiguration());
        modelBuilder.ApplyConfiguration(new TicketConfiguration());
        modelBuilder.ApplyConfiguration(new PaymentConfiguration());
        modelBuilder.ApplyConfiguration(new PermitConfiguration());
        modelBuilder.ApplyConfiguration(new OperatorUserConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
