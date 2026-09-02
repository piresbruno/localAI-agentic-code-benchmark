namespace Fastcrc;

/// The only module doing file I/O.
public static class Io
{
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
