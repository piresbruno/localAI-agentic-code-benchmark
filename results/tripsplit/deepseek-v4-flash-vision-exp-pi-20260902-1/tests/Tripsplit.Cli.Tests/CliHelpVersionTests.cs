using Xunit;

namespace Tripsplit.Cli.Tests;

public sealed class CliHelpVersionTests
{
    [Theory]
    [InlineData("--version")]
    [InlineData("-v")]
    public void prints_version_exactly(string flag)
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run(flag);
        Assert.Equal(0, exit);
        Assert.Equal("tripsplit 1.0.0\n", stdout);
        Assert.Equal("", stderr);
    }

    [Theory]
    [InlineData("--help")]
    [InlineData("-h")]
    public void help_exits_zero_and_documents_cli(string flag)
    {
        var (exit, stdout, stderr) = CliTestHelpers.Run(flag);
        Assert.Equal(0, exit);
        Assert.Equal("", stderr);
        Assert.Contains("settle", stdout);
        Assert.Contains("balance", stdout);
        Assert.Contains("--ledger", stdout);
        Assert.Contains("--format", stdout);
        Assert.Contains("table (default)", stdout);
        Assert.Contains("sample/ledger.json", stdout);
        Assert.Contains("settled €27.50 in 3 transfers (4 members)", stdout);
        Assert.Contains("Exit codes:", stdout);
        Assert.Contains("USAGE", stdout);
    }

    [Fact]
    public void help_text_contains_ledger_schema_example()
    {
        var (exit, stdout, _) = CliTestHelpers.Run("--help");
        Assert.Equal(0, exit);
        Assert.Contains("\"payer\": \"alice\", \"amountCents\": 1000", stdout);
        Assert.Contains("\"members\": [\"alice\", \"bob\", \"carol\", \"dave\"]", stdout);
    }
}
