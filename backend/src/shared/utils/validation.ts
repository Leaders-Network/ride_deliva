import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { createError } from '@/shared/middleware/error-handler';

// Custom validation error class
export class ValidationError extends Error {
  public details: any[];

  constructor(message: string, details?: any[]) {
    super(message);
    this.name = 'ValidationError';
    this.details = details || [];
  }
}

// Common validation patterns
export const commonPatterns = {
  uuid: Joi.string().uuid({ version: 'uuidv4' }),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  email: Joi.string().email().lowercase(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  name: Joi.string().min(1).max(100).trim(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  },
  coordinates: {
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  },
};

// Location validation schema
export const locationSchema = Joi.object({
  latitude: commonPatterns.coordinates.latitude,
  longitude: commonPatterns.coordinates.longitude,
  address: Joi.string().max(500),
  city: Joi.string().max(100),
  state: Joi.string().max(100),
  postalCode: Joi.string().max(20),
  country: Joi.string().max(100),
});

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all validation errors
      allowUnknown: false, // Don't allow unknown properties
      stripUnknown: true, // Remove unknown properties
    });

    if (error) {
      const validationDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value,
      }));

      return next(createError.validation('Validation failed', validationDetails));
    }

    // Replace the request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

// Sanitization utilities
export const sanitize = {
  phoneNumber: (phone: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Ensure it starts with + for international format
    if (!cleaned.startsWith('+')) {
      // Assume Nigerian number if no country code
      cleaned = '+234' + cleaned.replace(/^0/, '');
    }
    
    return cleaned;
  },

  name: (name: string): string => {
    return name.trim().replace(/\s+/g, ' ');
  },

  email: (email: string): string => {
    return email.toLowerCase().trim();
  },
};

// Custom validation functions
export const customValidators = {
  isValidVehicleType: (type: string): boolean => {
    const validTypes = ['SEDAN', 'SUV', 'HATCHBACK', 'MOTORCYCLE', 'BICYCLE', 'TRUCK', 'VAN'];
    return validTypes.includes(type.toUpperCase());
  },

  isValidRideType: (type: string): boolean => {
    const validTypes = ['STANDARD', 'PREMIUM', 'SHARED', 'SCHEDULE'];
    return validTypes.includes(type.toUpperCase());
  },

  isValidDeliveryType: (type: string): boolean => {
    const validTypes = ['STANDARD', 'EXPRESS', 'SCHEDULED', 'FRAGILE'];
    return validTypes.includes(type.toUpperCase());
  },

  isValidPaymentMethod: (method: string): boolean => {
    const validMethods = ['WALLET', 'CARD', 'BANK_TRANSFER', 'CASH'];
    return validMethods.includes(method.toUpperCase());
  },

  isWithinServiceArea: (latitude: number, longitude: number): boolean => {
    // Define service area boundaries (example for Lagos, Nigeria)
    const serviceBounds = {
      north: 6.7027,
      south: 6.4474,
      east: 3.6006,
      west: 3.1792,
    };

    return (
      latitude >= serviceBounds.south &&
      latitude <= serviceBounds.north &&
      longitude >= serviceBounds.west &&
      longitude <= serviceBounds.east
    );
  },

  isValidDistance: (distance: number): boolean => {
    // Maximum ride distance: 100km
    return distance > 0 && distance <= 100;
  },
};

// Async validation wrapper
export const validateAsync = (
  schema: Joi.ObjectSchema,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = await schema.validateAsync(req[property], {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      });

      req[property] = value;
      next();
    } catch (error: any) {
      const validationDetails = error.details?.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        value: detail.context?.value,
      }));

      next(createError.validation('Validation failed', validationDetails));
    }
  };
};
