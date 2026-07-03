import { NavLink } from 'react-router-dom';

interface MenuButtonProps {
  children: React.ReactNode;
  to: string;
  isOpen: boolean;
  openInNewTab?: boolean;
}

const MenuButton = ({
  children,
  to,
  isOpen,
  openInNewTab = false,
}: MenuButtonProps) => {
  const activeLinkClass = 'bg-indigo-500 text-white font-bold text-sm';
  const defaultLinkClass =
    'text-gray-400 hover:bg-gray-700 hover:text-white text-sm';
  const disabledClass = 'text-gray-600 cursor-not-allowed opacity-60 text-sm';
  const baseClass = `flex items-center ${isOpen ? 'p-4 gap-3' : 'p-4 justify-center'} transition-colors duration-200 text-sm`;
  if (!to) {
    return <div className={`${baseClass} ${disabledClass}`}>{children}</div>;
  }

  const isExternal = typeof to === 'string' && /^https?:\/\//.test(to);

  if (isExternal || openInNewTab) {
    return (
      <a
        href={to}
        target='_blank'
        rel='noopener noreferrer'
        className={`${baseClass} ${defaultLinkClass}`}
      >
        {children}
      </a>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseClass} ${isActive ? activeLinkClass : defaultLinkClass}`
      }
    >
      {children}
    </NavLink>
  );
};

export default MenuButton;
