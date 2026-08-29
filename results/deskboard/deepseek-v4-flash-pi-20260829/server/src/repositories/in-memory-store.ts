/**
 * In-memory keyed store used by every repository. Storage only — no business
 * decisions here. A real deployment swaps the repository implementations for
 * DB-backed ones behind the same interfaces.
 */
export class InMemoryStore<T extends { id: string }> {
  private readonly items = new Map<string, T>();

  async getAll(): Promise<T[]> {
    return [...this.items.values()];
  }

  async get(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  async insert(item: T): Promise<T> {
    this.items.set(item.id, item);
    return item;
  }

  async update(item: T): Promise<T> {
    if (!this.items.has(item.id)) throw new Error(`no such record ${item.id}`);
    this.items.set(item.id, item);
    return item;
  }

  async remove(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}
