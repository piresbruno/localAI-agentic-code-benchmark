using ParkWise.Contracts;
using ParkWise.Services.Abstractions;

namespace ParkWise.Services;

/// <summary>Permit management: admin-managed records granting fee-free stays while valid.</summary>
public class PermitService
{
    private readonly IPermitRepository _permits;
    private readonly IClock _clock;

    public PermitService(IPermitRepository permits, IClock clock)
    {
        _permits = permits;
        _clock = clock;
    }

    /// <summary>Creates a permit. Codes are unique (case-insensitive); overlapping windows
    /// for the same code are rejected by the repository's primary key.</summary>
    public async Task<PermitRecord> CreateAsync(string code, string plate, DateTime validFromUtc, DateTime validUntilUtc, CancellationToken ct = default)
    {
        code = code?.Trim().ToUpperInvariant() ?? string.Empty;
        plate = plate?.Trim().ToUpperInvariant() ?? string.Empty;
        if (code.Length == 0 || plate.Length == 0)
        {
            throw new ValidationException( "Permit code and plate are required.", 422);
        }
        if (validUntilUtc <= validFromUtc)
        {
            throw new ValidationException( "Permit ValidUntil must be after ValidFrom.", 422);
        }
        if (await _permits.GetByCodeAsync(code, ct) is not null)
        {
            throw new PermitDuplicateException(code);
        }

        var permit = new PermitRecord(code, plate, validFromUtc, validUntilUtc);
        await _permits.AddAsync(permit, ct);
        return permit;
    }

    /// <summary>All permits with their current active flag.</summary>
    public async Task<IReadOnlyList<PermitResponse>> ListAsync(CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        var permits = await _permits.GetAllAsync(ct);
        return permits
            .OrderBy(p => p.Code, StringComparer.OrdinalIgnoreCase)
            .Select(p => ToResponse(p, now))
            .ToList();
    }

    /// <summary>Attendant-facing validation: is a plate currently covered by an active permit?</summary>
    public async Task<PermitValidationResponse> ValidateAsync(string plate, CancellationToken ct = default)
    {
        plate = plate?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!TicketService.PlateRegex.IsMatch(plate))
        {
            throw new PlateInvalidException(plate);
        }

        var now = _clock.UtcNow;
        var permit = await _permits.GetActiveByPlateAsync(plate, now, ct);
        if (permit is not null)
        {
            return new PermitValidationResponse(plate, Active: true, permit.Code, permit.ValidUntilUtc, Reason: null);
        }

        // No active permit — distinguish "none at all" from "expired" for attendants.
        var latest = await _permits.GetLatestByPlateAsync(plate, ct);
        if (latest is null)
        {
            return new PermitValidationResponse(plate, Active: false, PermitCode: null, ValidUntil: null, Reason: "No permit for this plate");
        }
        if (now < latest.ValidFromUtc)
        {
            return new PermitValidationResponse(plate, Active: false, latest.Code, latest.ValidUntilUtc, Reason: "Permit not yet valid");
        }
        return new PermitValidationResponse(plate, Active: false, latest.Code, latest.ValidUntilUtc, Reason: ErrorCodes.PermitExpired);
    }

    /// <summary>Deletes a permit (admin).</summary>
    public async Task DeleteAsync(string code, CancellationToken ct = default)
    {
        code = code?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!await _permits.DeleteAsync(code, ct))
        {
            throw new PermitNotFoundException(code);
        }
    }

    private static PermitResponse ToResponse(PermitRecord permit, DateTime now) => new(
        permit.Code,
        permit.Plate,
        permit.ValidFromUtc,
        permit.ValidUntilUtc,
        Active: permit.ValidFromUtc <= now && now <= permit.ValidUntilUtc);
}
