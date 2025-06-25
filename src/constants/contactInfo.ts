/**
 * Contact Information Configuration
 * 
 * Follows DRY Principle:
 * - Centralized contact information
 * - Easy to update across the application
 */

export interface ContactInfo {
  type: string;
  label: string;
  value: string;
  href?: string;
}

export const CONTACT_INFORMATION: ContactInfo[] = [
  {
    type: 'email',
    label: 'Email',
    value: 'contact@radionudista.com',
    href: 'mailto:contact@radionudista.com'
  },
  {
    type: 'phone',
    label: 'Phone',
    value: '+1 (555) 123-4567',
    href: 'tel:+15551234567'
  },
  {
    type: 'address',
    label: 'Address',
    value: '123 Music Street\nRadio City, RC 12345'
  }
];

/**
 * Company information
 */
export const COMPANY_INFO = {
  name: 'RadioNudista',
  fullName: 'RadioNudista - Internet Radio Station',
  description: 'A platform for emerging and established artists to showcase their talent while delivering an exceptional listening experience to our global audience.',
  established: '2024',
  website: 'https://radionudista.com'
} as const;

/**
 * Stream configuration URLs
 */
export const STREAM_CONFIG = {
  streamUrl: 'https://servidor30.brlogic.com:7024/live',
  statusUrl: 'https://d36nr0u3xmc4mm.cloudfront.net/index.php/api/streaming/status/7024/2348c62ead2082a25b4573ed601473a3/SV1BR',
  twitchChannel: 'radionudista'
} as const;
