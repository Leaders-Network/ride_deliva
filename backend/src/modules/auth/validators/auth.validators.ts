import Joi from 'joi';
import { commonPatterns } from '@/shared/utils/validation';

// Registration validation schema
export const registerSchema = Joi.object({
  phoneNumber: commonPatterns.phoneNumber.required(),
  email: commonPatterns.email.optional(),
  firstName: commonPatterns.name.required(),
  lastName: commonPatterns.name.required(),
  password: commonPatterns.password.optional(),
  role: Joi.string().valid('customer', 'driver').required(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
});

// Login validation schema
export const loginSchema = Joi.object({
  phoneNumber: commonPatterns.phoneNumber.required(),
  password: Joi.string().min(1),
  verificationCode: Joi.string().length(6).pattern(/^\d+$/),
}).xor('password', 'verificationCode').messages({
  'object.xor': 'Either password or verificationCode must be provided, but not both',
});

// Send verification code validation schema
export const sendVerificationCodeSchema = Joi.object({
  phoneNumber: commonPatterns.phoneNumber.required(),
  type: Joi.string().valid('PHONE_VERIFICATION', 'PASSWORD_RESET').default('PHONE_VERIFICATION'),
});

// Verify phone validation schema
export const verifyPhoneSchema = Joi.object({
  phoneNumber: commonPatterns.phoneNumber.required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.pattern.base': 'Verification code must be 6 digits',
    'string.length': 'Verification code must be exactly 6 digits',
  }),
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

// Forgot password validation schema
export const forgotPasswordSchema = Joi.object({
  phoneNumber: commonPatterns.phoneNumber.required(),
});

// Reset password validation schema
export const resetPasswordSchema = Joi.object({
  phoneNumber: commonPatterns.phoneNumber.required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.pattern.base': 'Verification code must be 6 digits',
    'string.length': 'Verification code must be exactly 6 digits',
  }),
  newPassword: commonPatterns.password.required(),
});

// Change password validation schema
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
  newPassword: commonPatterns.password.required(),
});

// Session revocation validation schema
export const revokeSessionSchema = Joi.object({
  sessionId: commonPatterns.uuid.required(),
});

// Update profile validation schema
export const updateProfileSchema = Joi.object({
  firstName: commonPatterns.name.optional(),
  lastName: commonPatterns.name.optional(),
  email: commonPatterns.email.optional(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
  profilePicture: Joi.string().uri().optional(),
});

// Driver registration specific validation
export const driverRegistrationSchema = registerSchema.keys({
  role: Joi.string().valid('driver').required(),
  licenseNumber: Joi.string().min(5).max(50).required().messages({
    'string.min': 'License number must be at least 5 characters',
    'string.max': 'License number cannot exceed 50 characters',
  }),
  licenseExpiryDate: Joi.date().iso().greater('now').required().messages({
    'date.greater': 'License expiry date must be in the future',
  }),
  vehicleInfo: Joi.object({
    type: Joi.string().valid('SEDAN', 'SUV', 'HATCHBACK', 'MOTORCYCLE', 'BICYCLE', 'TRUCK', 'VAN').required(),
    make: Joi.string().min(2).max(50).required(),
    model: Joi.string().min(2).max(50).required(),
    year: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
    color: Joi.string().min(2).max(30).required(),
    licensePlate: Joi.string().min(3).max(20).required(),
  }).optional(),
});

// Validation for phone number format
export const phoneNumberValidation = {
  validate: (phoneNumber: string): { isValid: boolean; error?: string } => {
    // Nigerian phone number patterns
    const nigerianPatterns = [
      /^\+234[789][01]\d{8}$/, // International format
      /^0[789][01]\d{8}$/, // Local format
      /^[789][01]\d{8}$/, // Without leading 0
    ];

    // Check if it matches any Nigerian pattern
    const isValidNigerian = nigerianPatterns.some(pattern => pattern.test(phoneNumber));

    if (!isValidNigerian) {
      return {
        isValid: false,
        error: 'Invalid Nigerian phone number format. Use format: +2348xxxxxxxxx or 08xxxxxxxxx',
      };
    }

    return { isValid: true };
  },

  sanitize: (phoneNumber: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Convert local format to international
    if (cleaned.startsWith('0')) {
      cleaned = '+234' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+234' + cleaned;
    }

    return cleaned;
  },
};

// Password strength validation
export const passwordStrengthValidation = {
  validate: (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    // Check for common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', '12345678'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    // Check for sequential characters
    if (/123|abc|qwe/i.test(password)) {
      errors.push('Password should not contain sequential characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  generateSuggestions: (): string[] => {
    return [
      'Use a mix of uppercase and lowercase letters',
      'Include numbers and special characters',
      'Make it at least 8 characters long',
      'Avoid common words and patterns',
      'Consider using a passphrase with multiple words',
    ];
  },
};

// Custom validation for verification codes
export const verificationCodeValidation = {
  isExpired: (expiresAt: Date): boolean => {
    return new Date() > new Date(expiresAt);
  },

  isValidFormat: (code: string): boolean => {
    return /^\d{6}$/.test(code);
  },

  generateCode: (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },
};

// Role-based validation helpers
export const roleValidation = {
  isValidRole: (role: string): boolean => {
    const validRoles = ['customer', 'driver', 'admin'];
    return validRoles.includes(role.toLowerCase());
  },

  getRequiredFieldsForRole: (role: string): string[] => {
    switch (role.toLowerCase()) {
      case 'driver':
        return ['licenseNumber', 'licenseExpiryDate'];
      case 'customer':
        return [];
      case 'admin':
        return [];
      default:
        return [];
    }
  },
};

// Email validation helpers
export const emailValidation = {
  isValidDomain: (email: string): boolean => {
    // List of common email domains - you can expand this
    const validDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'icloud.com', 'aol.com', 'live.com', 'msn.com'
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? validDomains.includes(domain) : true; // Allow unknown domains
  },

  isDisposableEmail: (email: string): boolean => {
    // List of known disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
      'mailinator.com', 'yopmail.com', 'throwaway.email'
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? disposableDomains.includes(domain) : false;
  },
};
