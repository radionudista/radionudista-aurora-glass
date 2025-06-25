/**
 * Form Components
 * 
 * Follows SOLID Principles:
 * - SRP: Each component has a single responsibility
 * - OCP: Extensible through props and variants
 * - DRY: Reusable form components
 */

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Form Container
interface FormContainerProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
}

export const FormContainer: React.FC<FormContainerProps> = ({
  children,
  onSubmit,
  className
}) => (
  <form 
    onSubmit={onSubmit}
    className={cn('space-y-6', className)}
  >
    {children}
  </form>
);

// Form Field
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  error,
  required = false,
  className
}) => (
  <div className={cn('space-y-2', className)}>
    <label className="block text-gray-200 mb-2">
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-red-400 text-sm mt-1">{error}</p>
    )}
  </div>
);

// Input variants
type InputVariant = 'default' | 'glass';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  error?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ variant = 'glass', error = false, className, ...props }, ref) => {
    const baseClasses = 'w-full px-3 py-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400';
    
    const variantClasses = {
      default: 'border border-gray-300 bg-white text-gray-900',
      glass: 'glass-input'
    };

    return (
      <input
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          error && 'border-red-400 focus:ring-red-400',
          className
        )}
        {...props}
      />
    );
  }
);

FormInput.displayName = 'FormInput';

// Textarea
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: InputVariant;
  error?: boolean;
  resize?: boolean;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ variant = 'glass', error = false, resize = false, className, ...props }, ref) => {
    const baseClasses = 'w-full px-3 py-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400';
    
    const variantClasses = {
      default: 'border border-gray-300 bg-white text-gray-900',
      glass: 'glass-input'
    };

    return (
      <textarea
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          error && 'border-red-400 focus:ring-red-400',
          !resize && 'resize-none',
          className
        )}
        {...props}
      />
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

// Submit Button
interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'glass';
  loading?: boolean;
  fullWidth?: boolean;
}

export const FormButton: React.FC<FormButtonProps> = ({
  variant = 'glass',
  loading = false,
  fullWidth = false,
  children,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'px-6 py-3 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    glass: 'glass-button'
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};
