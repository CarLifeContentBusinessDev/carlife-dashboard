import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string; // 링크 버튼용
  target?: string;
  rel?: string;
}

const Button = ({
  onClick,
  children,
  className = '',
  disabled = false,
  href,
  target,
  rel,
}: ButtonProps) => {
  const baseStyle = `border text-white shadow-[0_2px_0_rgba(72,5,255,0.06)]
                     px-5 py-2 rounded-md transition-colors duration-100
                     ${
                       disabled
                         ? 'bg-gray-400 cursor-not-allowed'
                         : 'bg-point-color cursor-pointer hover:bg-[#624ad9]'
                     }
                     ${className}`;

  if (href) {
    return (
      <a href={href} target={target} rel={rel}>
        <button className={baseStyle} disabled={disabled}>
          {children}
        </button>
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseStyle} disabled={disabled}>
      {children}
    </button>
  );
};

export default Button;
