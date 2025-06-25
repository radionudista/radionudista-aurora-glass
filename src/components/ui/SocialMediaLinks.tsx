/**
 * Social Media Links Component
 * 
 * Follows SOLID Principles:
 * - SRP: Single responsibility for rendering social media links
 * - OCP: Extensible through props
 * - DRY: Reusable social media component
 */

import React from 'react';
import { SOCIAL_MEDIA_LINKS } from '../../utils/socialMedia';

interface SocialMediaLinksProps {
  className?: string;
  iconClassName?: string;
  linkClassName?: string;
}

const SocialMediaLinks: React.FC<SocialMediaLinksProps> = ({
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

export default SocialMediaLinks;
