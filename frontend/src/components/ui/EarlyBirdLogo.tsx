import React from 'react';

interface EarlyBirdLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number;
  className?: string;
}

export const EarlyBirdLogo: React.FC<EarlyBirdLogoProps> = ({
  size = 36,
  className = '',
  alt = 'EarlyBird Logo',
  ...props
}) => {
  return (
    <img
      src="/earlybird-logo.png"
      width={size}
      height={size}
      alt={alt}
      className={`inline-block object-contain drop-shadow-[0_0_15px_rgba(56,189,248,0.35)] transition-all ${className}`}
      {...props}
    />
  );
};

export default EarlyBirdLogo;
