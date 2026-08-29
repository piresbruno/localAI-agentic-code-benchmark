import type { User } from 'shared';
import { InMemoryStore } from './in-memory-store.js';

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(user: User): Promise<User>;
}

/** In-memory user store; email lookups are case-insensitive. */
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new InMemoryStore<User>();

  async create(user: User): Promise<User> {
    return this.store.insert(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.toLowerCase();
    const users = await this.store.getAll();
    return users.find((u) => u.email.toLowerCase() === needle) ?? null;
  }

  async update(user: User): Promise<User> {
    return this.store.update(user);
  }
}
