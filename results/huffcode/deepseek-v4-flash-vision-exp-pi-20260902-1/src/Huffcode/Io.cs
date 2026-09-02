namespace Huffcode;

/// S3a: the only module doing file I/O.
public static class Io
{
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);

    public static void WriteAllBytes(string path, byte[] bytes)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, bytes);
    }
}
