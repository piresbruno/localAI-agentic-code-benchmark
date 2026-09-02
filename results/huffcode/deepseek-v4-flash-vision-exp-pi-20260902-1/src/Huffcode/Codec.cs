using System.Text;

namespace Huffcode;

/// S1: frequencies, deterministic Huffman construction, bit codec. Pure BCL only.
public static class Codec
{
    public static Dictionary<byte, int> ByteFrequencies(byte[] data)
    {
        var freqs = new Dictionary<byte, int>();
        foreach (byte b in data)
        {
            freqs[b] = freqs.TryGetValue(b, out int n) ? n + 1 : 1;
        }
        return freqs;
    }

    public static Dictionary<byte, string> BuildCodeTable(Dictionary<byte, int> freqs)
    {
        var table = new Dictionary<byte, string>();
        if (freqs is null || freqs.Count == 0)
        {
            return table;
        }

        var pq = new PriorityQueue<Node, (int Frequency, int Tag)>();
        foreach (var kv in freqs)
        {
            if (kv.Value <= 0)
            {
                continue;
            }
            pq.Enqueue(new Node(kv.Key, kv.Value, kv.Key), (kv.Value, kv.Key));
        }

        if (pq.Count == 0)
        {
            return table;
        }

        while (pq.Count > 1)
        {
            Node left = pq.Dequeue();
            Node right = pq.Dequeue();
            var parent = new Node(-1, left.Frequency + right.Frequency, Math.Min(left.Tag, right.Tag))
            {
                Left = left,
                Right = right,
            };
            pq.Enqueue(parent, (parent.Frequency, parent.Tag));
        }

        AssignCodes(pq.Dequeue(), string.Empty, table);
        return table;
    }

    public static string EncodeBits(byte[] data, Dictionary<byte, string> table)
    {
        var sb = new StringBuilder();
        foreach (byte b in data)
        {
            if (!table.TryGetValue(b, out string? code))
            {
                throw new InvalidOperationException($"no code for byte {b}");
            }
            sb.Append(code);
        }
        return sb.ToString();
    }

    public static byte[] DecodeBits(string bits, Dictionary<byte, string> table)
    {
        var root = new TrieNode();
        foreach (var kv in table)
        {
            var cur = root;
            foreach (char c in kv.Value)
            {
                if (c == '0')
                {
                    cur.Left ??= new TrieNode();
                    cur = cur.Left;
                }
                else if (c == '1')
                {
                    cur.Right ??= new TrieNode();
                    cur = cur.Right;
                }
                else
                {
                    throw new InvalidOperationException("unknown code prefix");
                }
            }
            cur.Symbol = kv.Key;
        }

        var result = new List<byte>();
        var node = root;
        foreach (char c in bits)
        {
            if (c == '0')
            {
                node = node.Left;
            }
            else if (c == '1')
            {
                node = node.Right;
            }
            else
            {
                throw new InvalidOperationException("unknown code prefix");
            }

            if (node is null)
            {
                throw new InvalidOperationException("unknown code prefix");
            }

            if (node.Symbol is byte sym)
            {
                result.Add(sym);
                node = root;
            }
        }

        if (node != root)
        {
            throw new InvalidOperationException("unknown code prefix");
        }

        return result.ToArray();
    }

    private static void AssignCodes(Node node, string prefix, Dictionary<byte, string> table)
    {
        if (node.Symbol >= 0)
        {
            table[(byte)node.Symbol] = prefix;
            return;
        }
        if (node.Left != null)
        {
            AssignCodes(node.Left, prefix + "0", table);
        }
        if (node.Right != null)
        {
            AssignCodes(node.Right, prefix + "1", table);
        }
    }

    private sealed class Node
    {
        public Node(int symbol, int frequency, int tag)
        {
            Symbol = symbol;
            Frequency = frequency;
            Tag = tag;
        }

        public int Symbol { get; }
        public int Frequency { get; }
        public int Tag { get; }
        public Node? Left { get; set; }
        public Node? Right { get; set; }
    }

    private sealed class TrieNode
    {
        public byte? Symbol { get; set; }
        public TrieNode? Left { get; set; }
        public TrieNode? Right { get; set; }
    }
}
