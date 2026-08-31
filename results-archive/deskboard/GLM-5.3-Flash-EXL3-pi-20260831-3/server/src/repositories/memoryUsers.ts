import type { StoredUser, UserRepository } from './userRepository.js';

/** In-memory user store. Emails are case-insensitive keys. */
export class MemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, StoredUser>();
  private readonly byEmail = new Map<string, StoredUser>();

  async findById(id: string): Promise<StoredUser | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }

  async create(user: StoredUser): Promise<StoredUser> {
    if (this.byId.has(user.id)) {
      throw new Error(`user id already exists: ${user.id}`);
    }
    const stored = { ...user, email: user.email.toLowerCase() };
    this.byId.set(stored.id, stored);
    this.byEmail.set(stored.email, stored);
    return stored;
  }
}
