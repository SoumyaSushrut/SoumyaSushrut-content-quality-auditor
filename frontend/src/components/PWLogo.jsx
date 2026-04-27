import React from 'react';
import logoImage from '../assets/Screenshot 2026-04-28 002752.png';

const PWLogo = ({ className = "w-12 h-12" }) => {
  return (
    <img 
      src={logoImage} 
      alt="PW Logo" 
      className={`${className} object-contain`}
    />
  );
};

export default PWLogo;
