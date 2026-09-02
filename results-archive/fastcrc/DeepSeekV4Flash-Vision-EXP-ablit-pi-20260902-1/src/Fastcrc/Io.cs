namespace Fastcrc;

/// <summary>The only file-I/O module in the program.</summary>
public static class Io
{
    /// <summary>Reads the entire file at <paramref name="path"/> (BCL semantics; throws when missing).</summary>
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
