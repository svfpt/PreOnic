/**
 * Validation & parsing helper functions
 */

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{10,11}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const isStrongPassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
  return passwordRegex.test(password);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

/** Check truthy values from various sources (form checkbox, JSON boolean, etc.) */
export const isTruthy = (val: unknown): boolean => {
  return val === true || val === 'true' || val === 'on' || val === 1 || val === '1';
};

/** Parse a full name string into firstName and lastName */
export const parseFullName = (fullName: string): { firstName: string; lastName: string } => {
  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts.length === 1) {
    return { firstName: '', lastName: nameParts[0] };
  }
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts.slice(0, -1).join(' ');
  return { firstName, lastName };
};
