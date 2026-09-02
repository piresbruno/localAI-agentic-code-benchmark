using System.IO;

namespace Fastcrc;

/// <summary>The only file-I/O module.</summary>
public static class Io
{
    /// <summary>Read all bytes of a file. Throws on missing/inaccessible.</summary>
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
