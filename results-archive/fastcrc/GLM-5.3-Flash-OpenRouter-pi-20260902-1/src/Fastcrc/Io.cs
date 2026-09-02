namespace Fastcrc;

public static class Io
{
    public static byte[] ReadAllBytes(string path) => File.ReadAllBytes(path);
}
