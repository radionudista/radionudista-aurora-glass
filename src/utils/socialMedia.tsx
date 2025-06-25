/**
 * Social Media Configuration
 * 
 * Follows DRY Principle:
 * - Centralized social media links and configurations
 * - Consistent social media handling across components
 */

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
    icon: ({ className }) => (
      <div className={`w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center ${className}`}>
        <span className="text-white text-sm font-bold">D</span>
      </div>
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

/**
 * Social media links component
 */
interface SocialMediaLinksProps {
  className?: string;
  iconClassName?: string;
  linkClassName?: string;
}

export const SocialMediaLinks: React.FC<SocialMediaLinksProps> = ({
  className = 'flex space-x-4',
  iconClassName = 'w-8 h-8',
  linkClassName = 'social-icon-large'
}) => {
  return (
    <div className={className}>
      {SOCIAL_MEDIA_LINKS.map(({ id, url, icon: Icon, ariaLabel }) => (
        <a 
          key={id}
          href={url} 
          className={linkClassName}
          aria-label={ariaLabel}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon className={iconClassName} />
        </a>
      ))}
    </div>
  );
};
