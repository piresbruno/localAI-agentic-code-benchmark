using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Tripsplit.Core;

namespace Tripsplit.Cli;

public static class Program
{
    private static readonly JsonSerializerOptions EnvelopeOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static int Main(string[] args)
    {
        // Byte-determinism: digit/label formatting must not depend on the host culture.
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

        (Arguments? parsed, LedgerError? argError) = Arguments.Parse(args);
        if (argError is not null)
        {
            Console.Error.Write(Envelope(argError));
            return 2;
        }

        Arguments options = parsed!;

        if (options.Command == Command.Help)
        {
            Console.Out.Write(Formatter.Help);
            return 0;
        }

        if (options.Command == Command.Version)
        {
            Console.Out.Write(Formatter.Version);
            return 0;
        }

        (Ledger? ledger, LedgerError? loadError) = LedgerLoader.Load(options.LedgerPath!);
        if (loadError is not null)
        {
            Console.Error.Write(Envelope(loadError));
            return 1;
        }

        Ledger loaded = ledger!;

        if (options.Command == Command.Balance)
        {
            long[] nets = Settlement.ComputeNets(loaded);
            Console.Out.Write(Formatter.FormatBalance(loaded, nets, options.Format));
        }
        else
        {
            List<Transfer> transfers = Settlement.Settle(loaded);
            Console.Out.Write(Formatter.FormatSettle(loaded, transfers, options.Format));
        }

        return 0;
    }

    private static string Envelope(LedgerError error)
        => JsonSerializer.Serialize(new { error = new { code = error.Code, message = error.Message } }, EnvelopeOptions) + "\n";
}
