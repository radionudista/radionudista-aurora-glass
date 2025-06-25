/**
 * Form Validation Utilities
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for validation logic
 * - OCP: Extensible validation rules
 * - DRY: Reusable validation functions
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate a single field value against rules
 */
export const validateField = (value: string, rules: ValidationRule): ValidationResult => {
  // Required validation
  if (rules.required && (!value || value.trim().length === 0)) {
    return { isValid: false, error: 'This field is required' };
  }

  // Skip other validations if field is empty and not required
  if (!value || value.trim().length === 0) {
    return { isValid: true };
  }

  // Min length validation
  if (rules.minLength && value.length < rules.minLength) {
    return { 
      isValid: false, 
      error: `Must be at least ${rules.minLength} characters long` 
    };
  }

  // Max length validation
  if (rules.maxLength && value.length > rules.maxLength) {
    return { 
      isValid: false, 
      error: `Must be no more than ${rules.maxLength} characters long` 
    };
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(value)) {
    return { isValid: false, error: 'Invalid format' };
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { isValid: false, error: customError };
    }
  }

  return { isValid: true };
};

/**
 * Validate multiple fields
 */
export const validateForm = (
  values: Record<string, string>, 
  rules: Record<string, ValidationRule>
): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {};

  Object.entries(rules).forEach(([fieldName, fieldRules]) => {
    const value = values[fieldName] || '';
    results[fieldName] = validateField(value, fieldRules);
  });

  return results;
};

/**
 * Check if form validation results are all valid
 */
export const isFormValid = (validationResults: Record<string, ValidationResult>): boolean => {
  return Object.values(validationResults).every(result => result.isValid);
};

/**
 * Common validation patterns
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[+]?[1-9][\d]{0,15}$/,
  URL: /^https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?$/
} as const;

/**
 * Common validation rules
 */
export const COMMON_RULES = {
  required: { required: true },
  email: { 
    required: true, 
    pattern: VALIDATION_PATTERNS.EMAIL 
  },
  name: { 
    required: true, 
    minLength: 2, 
    maxLength: 50 
  },
  message: { 
    required: true, 
    minLength: 10, 
    maxLength: 1000 
  },
  subject: { 
    required: true, 
    minLength: 5, 
    maxLength: 100 
  }
} as const;
