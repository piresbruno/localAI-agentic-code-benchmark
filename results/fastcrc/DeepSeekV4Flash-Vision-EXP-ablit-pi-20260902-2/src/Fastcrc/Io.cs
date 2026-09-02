using System.IO;

namespace Fastcrc;

/// <summary>The only file-I/O module in the application.</summary>
public static class Io
{
    /// <summary>Reads all bytes from <paramref name="path"/>.</summary>
    /// <remarks>BCL <see cref="File.ReadAllBytes"/> semantics: throws when the file is missing.</remarks>
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
