namespace Huffcode;

using System.IO;

/// S3a: the only module doing file I/O.
public static class Io
{
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);

    public static void WriteAllBytes(string path, byte[] bytes)
    {
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
        File.WriteAllBytes(path, bytes);
    }
}
