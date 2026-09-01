using System.IO;
using Xunit;

namespace Tripsplit.Cli.Tests;

public sealed class CliErrorTests
{
    [Fact]
    public void reports_ledger_not_found()
    {
        string path = CliTestHelpers.MissingPath();
        var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
        Assert.Equal(1, exit);
        Assert.Equal("", stdout);
        Assert.Equal(CliTestHelpers.Envelope("LEDGER_NOT_FOUND", $"ledger file not found: '{path}'"), stderr);
    }

    [Fact]
    public void reports_invalid_ledger_when_amount_is_non_integer()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice"], "expenses": [ { "payer": "alice", "amountCents": 12.5, "participants": ["alice"] } ] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"LEDGER_INVALID\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_invalid_ledger_when_members_not_array()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": "alice", "expenses": [] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"LEDGER_INVALID\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_invalid_ledger_when_required_field_missing()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice"], "expenses": [ { "payer": "alice", "participants": ["alice"] } ] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"LEDGER_INVALID\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_members_empty()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": [], "expenses": [] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"MEMBERS_EMPTY\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_member_invalid_for_blank_name()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": [" "], "expenses": [] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"MEMBER_INVALID\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_member_duplicate_case_insensitively()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice", "ALICE"], "expenses": [] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("balance", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"MEMBER_DUPLICATE\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_member_unknown_with_spec_message()
    {
        string path = CliTestHelpers.WriteJson(
            """{ "members": ["alice", "bob"], "expenses": [ { "payer": "alice", "amountCents": 100, "participants": ["alice"] }, { "payer": "bob", "amountCents": 100, "participants": ["bob", "zed"] } ] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Equal(CliTestHelpers.Envelope("MEMBER_UNKNOWN", "expense 2: participant 'zed' is not a declared member"), stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_amount_invalid_for_zero_cents()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice"], "expenses": [ { "payer": "alice", "amountCents": 0, "participants": ["alice"] } ] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"AMOUNT_INVALID\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_participants_empty()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice"], "expenses": [ { "payer": "alice", "amountCents": 100, "participants": [] } ] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"PARTICIPANTS_EMPTY\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void reports_participant_duplicate_case_insensitively()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice"], "expenses": [ { "payer": "alice", "amountCents": 100, "participants": ["alice", "ALICE"] } ] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(1, exit);
            Assert.Equal("", stdout);
            Assert.Contains("\"code\":\"PARTICIPANT_DUPLICATE\"", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void usage_error_on_bad_format_value()
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", "x.json", "--format", "yaml");
        Assert.Equal(2, exit);
        Assert.Equal("", stdout);
        Assert.Contains("\"code\":\"USAGE\"", stderr);
    }

    [Fact]
    public void usage_error_on_missing_ledger()
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run("balance", "--format", "json");
        Assert.Equal(2, exit);
        Assert.Equal("", stdout);
        Assert.Contains("\"code\":\"USAGE\"", stderr);
    }

    [Fact]
    public void usage_error_on_unknown_subcommand()
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run("frobnicate");
        Assert.Equal(2, exit);
        Assert.Equal("", stdout);
        Assert.Contains("\"code\":\"USAGE\"", stderr);
    }

    [Fact]
    public void usage_error_on_unknown_flag()
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", "x.json", "--bogus");
        Assert.Equal(2, exit);
        Assert.Equal("", stdout);
        Assert.Contains("\"code\":\"USAGE\"", stderr);
    }

    [Fact]
    public void usage_error_on_no_args()
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run();
        Assert.Equal(2, exit);
        Assert.Equal("", stdout);
        Assert.Contains("\"code\":\"USAGE\"", stderr);
    }
}
