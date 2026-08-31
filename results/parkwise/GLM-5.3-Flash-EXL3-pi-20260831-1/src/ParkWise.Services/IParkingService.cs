using ParkWise.Contracts;
using ParkWise.Services.Domain;

namespace ParkWise.Services;

/// <summary>All parking business rules (spec §4): bay allocation, quotes, payments, exits.</summary>
public interface IParkingService
{
    Task<TicketDto> RegisterEntryAsync(string plate, VehicleType vehicleType, CancellationToken ct = default);
    Task<IReadOnlyList<TicketDto>> ListTicketsAsync(TicketStatus? status, CancellationToken ct = default);
    Task<TicketDto> GetTicketAsync(string ticketId, CancellationToken ct = default);
    Task<ExitResult> RequestExitAsync(string ticketId, CancellationToken ct = default);
    Task<PaymentDto> PayAsync(string ticketId, PaymentMethod method, CancellationToken ct = default);
    Task<PaymentDto> GetPaymentAsync(string paymentId, CancellationToken ct = default);
    Task<IReadOnlyList<OccupancyItem>> GetOccupancyAsync(CancellationToken ct = default);
    Task<TicketDto> MarkLostAsync(string ticketId, CancellationToken ct = default);
}
