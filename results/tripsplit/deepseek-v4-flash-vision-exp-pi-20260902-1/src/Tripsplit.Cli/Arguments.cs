using Tripsplit.Core;

namespace Tripsplit.Cli;

internal enum Command
{
    Settle,
    Balance,
    Help,
    Version,
}

internal sealed record Arguments(Command Command, string? LedgerPath, string Format)
{
    private static readonly LedgerError UsageError
        = new("USAGE", "usage: tripsplit <command> --ledger <file> [--format table|json]");

    internal static (Arguments? Parsed, LedgerError? Error) Parse(string[] args)
    {
        if (args.Length == 0)
            return (null, UsageError);

        switch (args[0])
        {
            case "--help" or "-h":
                return (new Arguments(Command.Help, null, "table"), null);
            case "--version" or "-v":
                return (new Arguments(Command.Version, null, "table"), null);
            case "settle":
                return ParseSubcommand(Command.Settle, args);
            case "balance":
                return ParseSubcommand(Command.Balance, args);
            default:
                return (null, UsageError);
        }
    }

    private static (Arguments? Parsed, LedgerError? Error) ParseSubcommand(Command command, string[] args)
    {
        string? ledger = null;
        string format = "table";
        for (int i = 1; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--ledger":
                    if (!TryReadValue(args, ref i, out string? ledgerValue))
                        return (null, UsageError);
                    ledger = ledgerValue;
                    break;
                case "--format":
                    if (!TryReadValue(args, ref i, out string? formatValue) || formatValue is not ("table" or "json"))
                        return (null, UsageError);
                    format = formatValue;
                    break;
                default:
                    return (null, UsageError);
            }
        }

        if (ledger is null)
            return (null, UsageError);

        return (new Arguments(command, ledger, format), null);
    }

    private static bool TryReadValue(string[] args, ref int i, out string? value)
    {
        if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
        {
            value = null;
            return false;
        }

        value = args[i + 1];
        i++;
        return true;
    }
}
