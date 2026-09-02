using System.IO;

namespace Fastcrc;

/// <summary>The only file-I/O module in the application.</summary>
public static class Io
{
    /// <summary>Reads all bytes from <paramref name="path"/> (BCL semantics; throws when missing).</summary>
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
