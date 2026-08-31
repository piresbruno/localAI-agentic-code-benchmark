using Microsoft.EntityFrameworkCore;
using ParkWise.Services;
using ParkWise.Services.Domain;

namespace ParkWise.Data.Repositories;

/// <summary>EF Core implementation of the payment repository.</summary>
public sealed class EfPaymentRepository(AppDbContext db) : IPaymentRepository
{
    public Task<PaymentReceipt?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);

    public Task<PaymentReceipt?> FindByTicketIdAsync(Guid ticketId, CancellationToken ct = default) =>
        db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.TicketId == ticketId, ct);

    public async Task AddAsync(PaymentReceipt receipt, CancellationToken ct = default)
    {
        db.Payments.Add(receipt);
        await db.SaveChangesAsync(ct);
    }
}
