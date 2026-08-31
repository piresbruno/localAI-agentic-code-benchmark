import { Room, Role, User } from '@deskboard/shared';

/** User as persisted: password hash never leaves the data layer. */
export interface StoredUser extends User {
  passwordHash: string;
}

/** Booking as persisted: times as Dates, status limited to stored states, room name joined on read. */
export interface StoredBooking {
  id: string;
  roomId: string;
  title: string;
  organizerId: string;
  start: Date;
  end: Date;
  status: 'confirmed' | 'cancelled';
  attendees: number;
  createdAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<StoredUser | undefined>;
  create(user: StoredUser): Promise<StoredUser>;
}

export interface RoomRepository {
  list(): Promise<Room[]>;
  findById(id: string): Promise<Room | undefined>;
  findByNameIgnoreCase(name: string): Promise<Room | undefined>;
  create(room: Room): Promise<Room>;
  update(room: Room): Promise<Room>;
}

export interface BookingRepository {
  create(booking: StoredBooking): Promise<StoredBooking>;
  findById(id: string): Promise<StoredBooking | undefined>;
  update(booking: StoredBooking): Promise<StoredBooking>;
  listByRoom(roomId: string): Promise<StoredBooking[]>;
  listByOrganizer(organizerId: string): Promise<StoredBooking[]>;
}
