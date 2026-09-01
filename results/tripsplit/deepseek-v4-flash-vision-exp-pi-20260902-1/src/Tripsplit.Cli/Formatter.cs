using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Tripsplit.Core;

namespace Tripsplit.Cli;

internal static class Formatter
{
    internal const string Version = "tripsplit 1.0.0\n";

    internal const string Help = """
tripsplit 1.0.0 - group-expense settlement

Usage:
  tripsplit settle  --ledger <file> [--format table|json]
  tripsplit balance --ledger <file> [--format table|json]
  tripsplit --help | -h
  tripsplit --version | -v

Commands:
  settle   Compute and print a minimal settlement plan (transfers).
  balance  Print each member's net balance.

Options:
  --ledger <file>  Path to the ledger JSON file (required).
  --format <fmt>   Output format: table (default) or json.
  -h, --help       Show this help and exit.
  -v, --version    Show the version and exit.

Ledger schema (amounts are integer cents):
{
  "members": ["alice", "bob"],
  "expenses": [
    { "payer": "alice", "amountCents": 1000, "participants": ["alice", "bob"] }
  ]
}
Unknown keys are ignored. A full example is committed at sample/ledger.json:
{
  "members": ["alice", "bob", "carol", "dave"],
  "expenses": [
    { "payer": "alice", "amountCents": 4000, "participants": ["alice", "bob", "carol", "dave"] },
    { "payer": "bob", "amountCents": 2500, "participants": ["bob", "carol"] },
    { "payer": "carol", "amountCents": 999, "participants": ["alice", "dave"] }
  ]
}

Worked example:
  $ tripsplit settle --ledger sample/ledger.json
  dave   -> alice  €14.99
  carol  -> alice  €10.01
  carol  -> bob    €2.50
  settled €27.50 in 3 transfers (4 members)

Errors are printed as one JSON line to stderr:
  {"error":{"code":"<CODE>","message":"<MESSAGE>"}}

Exit codes:
  0  success
  1  data/validation error (LEDGER_NOT_FOUND, LEDGER_INVALID, MEMBER_*, AMOUNT_*, PARTICIPANT_*)
  2  usage error (USAGE)
""";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    internal static string FormatBalance(Ledger ledger, long[] nets, string format)
        => format == "json" ? BalanceJson(ledger.Members, nets) : BalanceTable(ledger.Members, nets);

    internal static string FormatSettle(Ledger ledger, List<Transfer> transfers, string format)
        => format == "json" ? SettleJson(ledger.Members.Length, transfers) : SettleTable(ledger.Members, transfers);

    private static string BalanceTable(string[] members, long[] nets)
    {
        int width = members.Max(m => m.Length);
        var sb = new StringBuilder();
        for (int i = 0; i < members.Length; i++)
            sb.Append(members[i].PadRight(width)).Append("  ").Append(FormatSigned(nets[i])).Append('\n');
        return sb.ToString();
    }

    private static string SettleTable(string[] members, List<Transfer> transfers)
    {
        int width = members.Max(m => m.Length);
        var sb = new StringBuilder();
        long total = 0;
        foreach (Transfer t in transfers)
        {
            total += t.AmountCents;
            sb.Append(t.From.PadRight(width)).Append("  -> ").Append(t.To.PadRight(width)).Append("  ").Append(FormatUnsigned(t.AmountCents)).Append('\n');
        }

        return sb.Append("settled ").Append(FormatUnsigned(total)).Append(" in ").Append(transfers.Count).Append(" transfers (").Append(members.Length).Append(" members)\n").ToString();
    }

    private static string Euro(long amount)
        => $"€{amount / 100}.{amount % 100:00}";

    private static string FormatSigned(long net)
        => (net < 0 ? "-" : "+") + Euro(Math.Abs(net));

    private static string FormatUnsigned(long amount)
        => Euro(amount);

    private static string BalanceJson(string[] members, long[] nets)
    {
        var items = members.Select((m, i) => new { member = m, netCents = nets[i] }).ToArray();
        return JsonSerializer.Serialize(new { balances = items }, JsonOptions) + "\n";
    }

    private static string SettleJson(int memberCount, List<Transfer> transfers)
    {
        var items = transfers.Select(t => new { from = t.From, to = t.To, amountCents = t.AmountCents }).ToArray();
        long total = transfers.Sum(t => t.AmountCents);
        return JsonSerializer.Serialize(new { transfers = items, totalCents = total, memberCount }, JsonOptions) + "\n";
    }
}
