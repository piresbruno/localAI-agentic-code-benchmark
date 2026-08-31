import type { Role, RoomFeature, StoredBookingStatus } from '@deskboard/shared';

/** Persisted user record (password never leaves the server). */
export interface UserEntity {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

export interface RoomEntity {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
}

export interface BookingEntity {
  id: string;
  roomId: string;
  title: string;
  organizerId: string;
  /** Naive local ISO at minutes precision, exactly as booked. */
  start: string;
  end: string;
  status: StoredBookingStatus;
  attendees: number;
  createdAt: string;
}

export interface UserRepository {
  findByEmail(email: string): UserEntity | undefined;
  findById(id: string): UserEntity | undefined;
  create(user: UserEntity): UserEntity;
}

export interface RoomRepository {
  all(): RoomEntity[];
  findById(id: string): RoomEntity | undefined;
  /** Case-insensitive lookup backing the unique-name rule. */
  findByName(name: string): RoomEntity | undefined;
  create(room: RoomEntity): RoomEntity;
  update(room: RoomEntity): RoomEntity;
}

export interface BookingRepository {
  findById(id: string): BookingEntity | undefined;
  findByRoom(roomId: string): BookingEntity[];
  findByOrganizer(userId: string): BookingEntity[];
  create(booking: BookingEntity): BookingEntity;
  update(booking: BookingEntity): BookingEntity;
}
