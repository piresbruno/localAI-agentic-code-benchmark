using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ParkWise.Services.Domain;

namespace ParkWise.Data.Configurations;

public sealed class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public void Configure(EntityTypeBuilder<Ticket> builder)
    {
        builder.ToTable("tickets");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Plate).HasMaxLength(12).IsRequired();
        builder.HasIndex(t => t.Plate);
        builder.Property(t => t.BayId).HasMaxLength(8).IsRequired();
        builder.Property(t => t.EntryAtUtc).IsRequired();
        builder.Property(t => t.Status).HasConversion<string>().HasMaxLength(10);
        builder.Property(t => t.VehicleType).HasConversion<string>().HasMaxLength(12);
        builder.Property(t => t.BayType).HasConversion<string>().HasMaxLength(12);
    }
}

public sealed class PaymentReceiptConfiguration : IEntityTypeConfiguration<PaymentReceipt>
{
    public void Configure(EntityTypeBuilder<PaymentReceipt> builder)
    {
        builder.ToTable("payments");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Amount).HasPrecision(10, 2);
        builder.Property(p => p.Method).HasConversion<string>().HasMaxLength(6);
        builder.Property(p => p.PaidAtUtc).IsRequired();
        builder.HasIndex(p => p.TicketId);
        builder.HasOne<Ticket>().WithMany().HasForeignKey(p => p.TicketId);
    }
}
