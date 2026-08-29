using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

namespace ParkWise.UnitTests;

/// <summary>Payment, permit, and auth service rules (spec §4/§6).</summary>
public class PaymentAndPermitServiceTests
{
    private static readonly DateTime Entry = new(2026, 3, 10, 9, 0, 0, DateTimeKind.Utc);

    private readonly FakeTicketRepository _tickets = new();
    private readonly FakePaymentRepository _payments = new();
    private readonly FakePermitRepository _permits = new();
    private readonly FixedClock _clock = FixedClock.At(2026, 3, 10, 11, 0); // 2h after entry
    private readonly PaymentService _service;
    private readonly PermitService _permitService;

    public PaymentAndPermitServiceTests()
    {
        var fees = new FeeOptions();
        _service = new PaymentService(_tickets, _payments, _permits, new FeeCalculator(fees), fees, _clock);
        _permitService = new PermitService(_permits, _clock);
    }

    private async Task<TicketRecord> SeedOpenTicket(VehicleType type = VehicleType.Standard)
    {
        var ticket = new TicketRecord(Guid.NewGuid(), "AA-123-BB", type, Guid.NewGuid(), "Standard", 1,
            Entry, null, TicketStatus.Open, null, null);
        await _tickets.AddAsync(ticket);
        return ticket;
    }

    [Fact]
    public async Task payment_marks_ticket_paid_and_returns_receipt()
    {
        var ticket = await SeedOpenTicket(); // 2h standard → 6.00
        var payment = await _service.PayAsync(ticket.Id, "card", false);
        Assert.Equal(6.00m, payment.Amount);
        Assert.Equal(PaymentMethod.Card, payment.Method);
        Assert.Equal(TicketStatus.Paid, (await _tickets.GetByIdAsync(ticket.Id))!.Status);
    }

    [Fact]
    public async Task ev_charging_surcharge_applies_only_when_flagged()
    {
        var evTicket = new TicketRecord(Guid.NewGuid(), "AA-123-BB", VehicleType.Ev, Guid.NewGuid(), "Ev", 1,
            Entry, null, TicketStatus.Open, null, null);
        await _tickets.AddAsync(evTicket);

        var without = await _service.PayAsync(evTicket.Id, "card", false);
        Assert.Equal(7.00m, without.Amount); // 2 × 3.50

        var evTicket2 = evTicket with { Id = Guid.NewGuid(), Status = TicketStatus.Open };
        await _tickets.AddAsync(evTicket2);
        var with = await _service.PayAsync(evTicket2.Id, "card", true);
        Assert.Equal(9.50m, with.Amount); // 2 × 3.50 + 2.50
        Assert.True(with.EvChargingUsed);
    }

    [Fact]
    public async Task ev_charging_surcharge_not_applied_to_non_ev_tickets()
    {
        var ticket = await SeedOpenTicket();
        var payment = await _service.PayAsync(ticket.Id, "cash", true); // flag set but not an EV
        Assert.Equal(6.00m, payment.Amount);
        Assert.False(payment.EvChargingUsed);
    }

    [Fact]
    public async Task rejects_unknown_payment_method()
    {
        var ticket = await SeedOpenTicket();
        await Assert.ThrowsAsync<PaymentMethodInvalidException>(() => _service.PayAsync(ticket.Id, "bitcoin", false));
    }

    [Fact]
    public async Task blocks_payment_on_already_paid_ticket()
    {
        var ticket = await SeedOpenTicket();
        await _service.PayAsync(ticket.Id, "card", false);
        await Assert.ThrowsAsync<TicketNotOpenException>(() => _service.PayAsync(ticket.Id, "card", false));
    }

    [Fact]
    public async Task payment_on_lost_ticket_charges_flat_fee()
    {
        var ticket = new TicketRecord(Guid.NewGuid(), "AA-123-BB", VehicleType.Standard, Guid.NewGuid(), "Standard", 1,
            Entry, null, TicketStatus.Lost, null, Entry.AddHours(1));
        await _tickets.AddAsync(ticket);
        var payment = await _service.PayAsync(ticket.Id, "app", false);
        Assert.Equal(25.00m, payment.Amount);
    }

    [Fact]
    public async Task permit_covered_payment_is_zero_and_flagged()
    {
        await _permits.AddAsync(new PermitRecord("PERMIT-9", "AA-123-BB", Entry.AddDays(-1), Entry.AddDays(1)));
        var ticket = new TicketRecord(Guid.NewGuid(), "AA-123-BB", VehicleType.Standard, Guid.NewGuid(), "Standard", 1,
            Entry, null, TicketStatus.Open, "PERMIT-9", null);
        await _tickets.AddAsync(ticket);
        var payment = await _service.PayAsync(ticket.Id, "card", false);
        Assert.Equal(0.00m, payment.Amount);
        Assert.True(payment.PermitExempt);
    }

    [Fact]
    public async Task refund_within_window_succeeds_once()
    {
        var ticket = await SeedOpenTicket();
        var payment = await _service.PayAsync(ticket.Id, "card", false);
        var refunded = await _service.RefundAsync(payment.Id);
        Assert.NotNull(refunded.RefundedAtUtc);
        await Assert.ThrowsAsync<AlreadyRefundedException>(() => _service.RefundAsync(payment.Id));
    }

    [Fact]
    public async Task refund_after_24h_is_rejected()
    {
        var ticket = await SeedOpenTicket();
        var payment = await _service.PayAsync(ticket.Id, "card", false);
        _clock.SetTo(payment.PaidAtUtc.AddHours(25));
        await Assert.ThrowsAsync<RefundWindowClosedException>(() => _service.RefundAsync(payment.Id));
    }

    [Fact]
    public async Task refund_unknown_payment_is_not_found()
    {
        await Assert.ThrowsAsync<PaymentNotFoundException>(() => _service.RefundAsync(Guid.NewGuid()));
    }
}

/// <summary>Permit service rules.</summary>
public class PermitServiceTests
{
    private readonly FakePermitRepository _permits = new();
    private readonly FixedClock _clock = FixedClock.At(2026, 3, 10, 9, 0);
    private readonly PermitService _service;

    public PermitServiceTests()
    {
        _service = new PermitService(_permits, _clock);
    }

    [Fact]
    public async Task creates_permit_and_lists_active_flag()
    {
        await _service.CreateAsync("P1", "AA-123-BB", _clock.UtcNow.AddDays(-1), _clock.UtcNow.AddDays(1));
        var list = await _service.ListAsync();
        var permit = Assert.Single(list);
        Assert.Equal("P1", permit.Code);
        Assert.True(permit.Active);
    }

    [Fact]
    public async Task ExpiredPermitListsAsInactive()
    {
        await _service.CreateAsync("P2", "AA-123-BB", _clock.UtcNow.AddDays(-10), _clock.UtcNow.AddDays(-1));
        var permit = Assert.Single(await _service.ListAsync());
        Assert.False(permit.Active);
    }

    [Fact]
    public async Task validates_active_plate()
    {
        await _service.CreateAsync("P3", "AA-123-BB", _clock.UtcNow.AddDays(-1), _clock.UtcNow.AddDays(1));
        var result = await _service.ValidateAsync("AA-123-BB");
        Assert.True(result.Active);
        Assert.Equal("P3", result.PermitCode);
    }

    [Fact]
    public async Task expired_permit_validation_reports_permit_expired()
    {
        await _service.CreateAsync("P4", "AA-123-BB", _clock.UtcNow.AddDays(-10), _clock.UtcNow.AddDays(-1));
        var result = await _service.ValidateAsync("AA-123-BB");
        Assert.False(result.Active);
        Assert.Equal("PERMIT_EXPIRED", result.Reason);
    }

    [Fact]
    public async Task unknown_plate_reports_no_permit()
    {
        var result = await _service.ValidateAsync("ZZ-999-ZZ");
        Assert.False(result.Active);
    }

    [Fact]
    public async Task malformed_plate_is_rejected_on_validate()
    {
        await Assert.ThrowsAsync<PlateInvalidException>(() => _service.ValidateAsync("nope"));
    }

    [Fact]
    public async Task duplicate_code_is_rejected()
    {
        await _service.CreateAsync("DUP", "AA-123-BB", _clock.UtcNow.AddDays(-1), _clock.UtcNow.AddDays(1));
        await Assert.ThrowsAsync<PermitDuplicateException>(
            () => _service.CreateAsync("dup", "ZZ-999-ZZ", _clock.UtcNow.AddDays(-1), _clock.UtcNow.AddDays(1)));
    }

    [Fact]
    public async Task invalid_window_is_rejected()
    {
        await Assert.ThrowsAsync<ValidationException>(
            () => _service.CreateAsync("P5", "AA-123-BB", _clock.UtcNow.AddDays(1), _clock.UtcNow));
    }

    [Fact]
    public async Task delete_removes_permit_and_unknown_code_is_not_found()
    {
        await _service.CreateAsync("P6", "AA-123-BB", _clock.UtcNow.AddDays(-1), _clock.UtcNow.AddDays(1));
        await _service.DeleteAsync("P6");
        await Assert.ThrowsAsync<PermitNotFoundException>(() => _service.DeleteAsync("P6"));
    }
}

/// <summary>AuthService rules with fakes.</summary>
public class AuthServiceTests
{
    private readonly FakeOperatorRepository _operators = new();
    private readonly IPasswordHasher _hasher = new Pbkdf2PasswordHasher();
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _service = new AuthService(_operators, _hasher, new StubTokenService());
        _operators.Seed(new OperatorRecord(Guid.NewGuid(), "admin", "admin", _hasher.Hash("admin123")));
    }

    private sealed class StubTokenService : ITokenService
    {
        public string Issue(OperatorRecord user) => $"token-for-{user.Username}";
    }

    [Fact]
    public async Task valid_credentials_return_token_and_role()
    {
        var response = await _service.LoginAsync("admin", "admin123");
        Assert.Equal("token-for-admin", response.Token);
        Assert.Equal("admin", response.Role);
    }

    [Fact]
    public async Task wrong_password_is_unauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedException>(() => _service.LoginAsync("admin", "wrong"));
    }

    [Fact]
    public async Task unknown_user_is_unauthorized_with_same_message()
    {
        await Assert.ThrowsAsync<UnauthorizedException>(() => _service.LoginAsync("ghost", "whatever"));
    }

    [Fact]
    public async Task password_hasher_roundtrips_and_rejects()
    {
        var hash = _hasher.Hash("s3cret!");
        Assert.True(_hasher.Verify("s3cret!", hash));
        Assert.False(_hasher.Verify("wrong", hash));
        Assert.False(_hasher.Verify("s3cret!", "garbage"));
    }
}
