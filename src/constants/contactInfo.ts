/**
 * Contact Information Configuration
 */

export interface ContactInfo {
  type: string;
  label: string;
  value: string;
  href?: string;
}

export const CONTACT_EMAIL = 'contact@radionudista.com';

export const JOIN_PROGRAM_EMAIL = 'correonudista@gmail.com';

export const CONTACT_INFORMATION: ContactInfo[] = [
  {
    type: 'email',
    label: 'Email',
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
];

export const COMPANY_INFO = {
  name: 'RadioNudista',
  fullName: 'RadioNudista - Internet Radio Station',
  description:
    'A platform for emerging and established artists to showcase their talent while delivering an exceptional listening experience to our global audience.',
  established: '2024',
  website: 'https://radionudista.com',
} as const;
