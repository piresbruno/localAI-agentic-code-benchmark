import type { User } from '@deskboard/shared';

/** User as persisted: a wire `User` plus the password hash (never leaves the server). */
export interface StoredUser extends User {
  passwordHash: string;
}

/**
 * Persistence port for users. The in-memory implementation lives in
 * `repositories/memoryUsers.ts`; a SQL adapter would implement the same interface.
 */
export interface UserRepository {
  findById(id: string): Promise<StoredUser | null>;
  findByEmail(email: string): Promise<StoredUser | null>;
  create(user: StoredUser): Promise<StoredUser>;
}
