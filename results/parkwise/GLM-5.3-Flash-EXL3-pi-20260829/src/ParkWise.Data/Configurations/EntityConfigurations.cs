using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ParkWise.Contracts;
using ParkWise.Data.Entities;

namespace ParkWise.Data.Configurations;

/// <summary>Explicit EF configuration for <see cref="Bay"/>.</summary>
public class BayConfiguration : IEntityTypeConfiguration<Bay>
{
    public void Configure(EntityTypeBuilder<Bay> builder)
    {
        builder.ToTable("bays");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Level).IsRequired();
        builder.Property(b => b.Type).HasConversion<string>().HasMaxLength(16);
        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(16);
        builder.HasIndex(b => new { b.Status, b.Type });
        builder.HasIndex(b => b.CurrentTicketId).IsUnique();
    }
}

/// <summary>Explicit EF configuration for <see cref="Ticket"/>.</summary>
public class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Plate).IsRequired().HasMaxLength(16);
        builder.Property(t => t.VehicleType).HasConversion<string>().HasMaxLength(16);
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(16);
        builder.Property(t => t.PermitCode).HasMaxLength(32);
        builder.HasOne(t => t.Bay).WithMany().HasForeignKey(t => t.BayId);
        builder.HasIndex(t => t.Plate);
        builder.HasIndex(t => t.Status);
    }
}

/// <summary>Explicit EF configuration for <see cref="Payment"/>.</summary>
public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Amount).HasPrecision(10, 2);
        builder.Property(p => p.Method).HasConversion<string>().HasMaxLength(8);
        builder.HasOne(p => p.Ticket).WithMany().HasForeignKey(p => p.TicketId);
        builder.HasIndex(p => p.PaidAt);
    }
}

/// <summary>Explicit EF configuration for <see cref="Permit"/>.</summary>
public class PermitConfiguration : IEntityTypeConfiguration<Permit>
{
    public void Configure(EntityTypeBuilder<Permit> builder)
    {
        builder.ToTable("permits");
        builder.HasKey(p => p.Code);
        builder.Property(p => p.Plate).IsRequired().HasMaxLength(16);
        builder.HasIndex(p => p.Plate);
    }
}

/// <summary>Explicit EF configuration for <see cref="OperatorUser"/>.</summary>
public class OperatorUserConfiguration : IEntityTypeConfiguration<OperatorUser>
{
    public void Configure(EntityTypeBuilder<OperatorUser> builder)
    {
        builder.ToTable("operators");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Username).IsRequired().HasMaxLength(64);
        builder.HasIndex(u => u.Username).IsUnique();
        builder.Property(u => u.Role).HasMaxLength(16);
        builder.Property(u => u.PasswordHash).IsRequired();
    }
}
