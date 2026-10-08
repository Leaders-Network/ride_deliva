// Repository exports
import { UserRepository } from './user.repository';
import { RideRepository } from './ride.repository';
export { BaseRepository } from './base.repository';
export { UserRepository } from './user.repository';
export { RideRepository } from './ride.repository';

// Repository instances
export const userRepository = new UserRepository();
export const rideRepository = new RideRepository();
