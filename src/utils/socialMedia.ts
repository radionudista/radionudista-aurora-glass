/**
 * Social Media Configuration
 * 
 * Follows DRY Principle:
 * - Centralized social media links and configurations
 * - Consistent social media handling across components
 */

import React from 'react';
import { Instagram, X } from 'lucide-react';

export interface SocialMediaLink {
  id: string;
  name: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  ariaLabel: string;
}

export const SOCIAL_MEDIA_LINKS: SocialMediaLink[] = [
  {
    id: 'discord',
    name: 'Discord',
    url: '#',
    icon: ({ className }) => React.createElement(
      'div',
      { className: `w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center ${className}` },
      React.createElement('span', { className: 'text-white text-sm font-bold' }, 'D')
    ),
    color: 'purple-500',
    ariaLabel: 'Follow us on Discord'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://instagram.com/radionudista',
    icon: Instagram,
    color: 'pink-500',
    ariaLabel: 'Follow us on Instagram'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    url: 'https://twitter.com/radionudista',
    icon: X,
    color: 'gray-900',
    ariaLabel: 'Follow us on Twitter'
  }
];

/**
 * Get social media link by ID
 */
export const getSocialMediaLink = (id: string): SocialMediaLink | undefined => {
  return SOCIAL_MEDIA_LINKS.find(link => link.id === id);
};
