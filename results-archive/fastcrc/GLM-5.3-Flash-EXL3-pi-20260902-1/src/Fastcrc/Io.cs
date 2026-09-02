namespace Fastcrc;

/// <summary>The only module performing file I/O.</summary>
public static class Io
{
    /// <summary>Reads all bytes of <paramref name="path"/>; BCL <c>File.ReadAllBytes</c> semantics (throws when the file is missing).</summary>
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
