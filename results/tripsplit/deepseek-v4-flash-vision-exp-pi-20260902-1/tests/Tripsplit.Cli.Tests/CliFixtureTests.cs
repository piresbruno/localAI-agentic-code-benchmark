using System.IO;
using Xunit;

namespace Tripsplit.Cli.Tests;

public sealed class CliFixtureTests
{
    private const string Fixture = """
{
  "members": ["alice", "bob", "carol", "dave"],
  "expenses": [
    { "payer": "alice", "amountCents": 4000, "participants": ["alice", "bob", "carol", "dave"] },
    { "payer": "bob", "amountCents": 2500, "participants": ["bob", "carol"] },
    { "payer": "carol", "amountCents": 999, "participants": ["alice", "dave"] }
  ]
}
""";

    private const string SettleTable
        = "dave   -> alice  €14.99\ncarol  -> alice  €10.01\ncarol  -> bob    €2.50\nsettled €27.50 in 3 transfers (4 members)\n";

    private const string BalanceTable
        = "alice  +€25.00\nbob    +€2.50\ncarol  -€12.51\ndave   -€14.99\n";

    private const string SettleJson
        = "{\"transfers\":[{\"from\":\"dave\",\"to\":\"alice\",\"amountCents\":1499},{\"from\":\"carol\",\"to\":\"alice\",\"amountCents\":1001},{\"from\":\"carol\",\"to\":\"bob\",\"amountCents\":250}],\"totalCents\":2750,\"memberCount\":4}\n";

    private const string BalanceJson
        = "{\"balances\":[{\"member\":\"alice\",\"netCents\":2500},{\"member\":\"bob\",\"netCents\":250},{\"member\":\"carol\",\"netCents\":-1251},{\"member\":\"dave\",\"netCents\":-1499}]}\n";

    [Fact]
    public void settle_table_matches_golden_output()
    {
        string path = CliTestHelpers.WriteJson(Fixture);
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(0, exit);
            Assert.Equal(SettleTable, stdout);
            Assert.Equal("", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void balance_table_matches_golden_output()
    {
        string path = CliTestHelpers.WriteJson(Fixture);
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("balance", "--ledger", path);
            Assert.Equal(0, exit);
            Assert.Equal(BalanceTable, stdout);
            Assert.Equal("", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void settle_json_matches_golden_output()
    {
        string path = CliTestHelpers.WriteJson(Fixture);
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path, "--format", "json");
            Assert.Equal(0, exit);
            Assert.Equal(SettleJson, stdout);
            Assert.Equal("", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void balance_json_matches_golden_output()
    {
        string path = CliTestHelpers.WriteJson(Fixture);
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("balance", "--ledger", path, "--format", "json");
            Assert.Equal(0, exit);
            Assert.Equal(BalanceJson, stdout);
            Assert.Equal("", stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        string path = CliTestHelpers.WriteJson(Fixture);
        try
        {
            var (e1, settle1, _) = CliTestHelpers.Run("settle", "--ledger", path, "--format", "table");
            var (e2, settle2, _) = CliTestHelpers.Run("settle", "--ledger", path, "--format", "table");
            Assert.Equal(e1, e2);
            Assert.Equal(settle1, settle2);

            var (e3, settleJson1, _) = CliTestHelpers.Run("settle", "--ledger", path, "--format", "json");
            var (e4, settleJson2, _) = CliTestHelpers.Run("settle", "--ledger", path, "--format", "json");
            Assert.Equal(e3, e4);
            Assert.Equal(settleJson1, settleJson2);

            var (e5, balance1, _) = CliTestHelpers.Run("balance", "--ledger", path, "--format", "table");
            var (e6, balance2, _) = CliTestHelpers.Run("balance", "--ledger", path, "--format", "table");
            Assert.Equal(e5, e6);
            Assert.Equal(balance1, balance2);

            var (e7, balanceJson1, _) = CliTestHelpers.Run("balance", "--ledger", path, "--format", "json");
            var (e8, balanceJson2, _) = CliTestHelpers.Run("balance", "--ledger", path, "--format", "json");
            Assert.Equal(e7, e8);
            Assert.Equal(balanceJson1, balanceJson2);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void all_zero_ledger_settles_to_empty_plan()
    {
        string path = CliTestHelpers.WriteJson("""{ "members": ["alice", "bob", "carol"], "expenses": [] }""");
        try
        {
            var (exit, stdout, stderr) = CliTestHelpers.Run("settle", "--ledger", path);
            Assert.Equal(0, exit);
            Assert.Equal("settled €0.00 in 0 transfers (3 members)\n", stdout);
            Assert.Equal("", stderr);

            var (jsonExit, jsonOut, jsonErr) = CliTestHelpers.Run("settle", "--ledger", path, "--format", "json");
            Assert.Equal(0, jsonExit);
            Assert.Equal("{\"transfers\":[],\"totalCents\":0,\"memberCount\":3}\n", jsonOut);
            Assert.Equal("", jsonErr);
        }
        finally
        {
            File.Delete(path);
        }
    }
}
