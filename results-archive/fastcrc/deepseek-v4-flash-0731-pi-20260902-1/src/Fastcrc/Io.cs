using System.IO;

namespace Fastcrc;

/// <summary>
/// File I/O. The only module that touches the file system.
/// </summary>
public static class Io
{
    /// <summary>
    /// Reads the entire file at <paramref name="path"/> into a byte array.
    /// Throws when the file is missing or cannot be read (BCL semantics).
    /// </summary>
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}