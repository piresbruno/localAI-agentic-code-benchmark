using System.Text.Json;
using Tripsplit.Core;

namespace Tripsplit.Cli;

internal static class LedgerLoader
{
    private static readonly JsonSerializerOptions DeserializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static readonly LedgerError Invalid
        = new("LEDGER_INVALID", "ledger file is invalid");

    internal static (Ledger? Ledger, LedgerError? Error) Load(string path)
    {
        string json;
        try
        {
            json = File.ReadAllText(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return (null, new LedgerError("LEDGER_NOT_FOUND", $"ledger file not found: '{path}'"));
        }

        LedgerDto? dto;
        try
        {
            dto = JsonSerializer.Deserialize<LedgerDto>(json, DeserializeOptions);
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or NotSupportedException)
        {
            return (null, Invalid);
        }

        if (dto is null)
        {
            return (null, Invalid);
        }

        return Build(dto);
    }

    private static (Ledger? Ledger, LedgerError? Error) Build(LedgerDto dto)
    {
        if (dto.Members is null || dto.Members.Any(m => m is null)
            || dto.Expenses is null || dto.Expenses.Any(e => e is null))
        {
            return (null, Invalid);
        }

        var members = dto.Members;
        var expenses = new Expense[dto.Expenses.Length];
        for (int i = 0; i < dto.Expenses.Length; i++)
        {
            ExpenseDto e = dto.Expenses[i];
            if (e.Payer is null || e.Participants is null || e.Participants.Any(p => p is null))
            {
                return (null, Invalid);
            }

            expenses[i] = new Expense(e.Payer.Trim(), e.AmountCents, e.Participants.Select(p => p.Trim()).ToArray());
        }

        var ledger = new Ledger(members.Select(m => m.Trim()).ToArray(), expenses);
        LedgerError? error = LedgerValidator.Validate(ledger);
        return error is null ? (ledger, null) : (null, error);
    }

    private sealed class LedgerDto
    {
        public required string[] Members { get; init; }
        public required ExpenseDto[] Expenses { get; init; }
    }

    private sealed class ExpenseDto
    {
        public required string Payer { get; init; }
        public required long AmountCents { get; init; }
        public required string[] Participants { get; init; }
    }
}
