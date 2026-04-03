import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MenuButton from './MenuButton';
import type { MenuChild } from '../../constants/sidebarMenus';

interface MenuGroupItemProps {
  label: string;
  icon: React.ReactNode;
  isSidebarOpen: boolean;
  isActive: boolean;
  items: MenuChild[];
}

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width={24}
    height={24}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
  >
    <polyline points='6 9 12 15 18 9' />
  </svg>
);

const MenuGroupItem = ({
  label,
  icon,
  isSidebarOpen,
  isActive,
  items,
}: MenuGroupItemProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [floatingMenuPos, setFloatingMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isSidebarOpen && isHovered && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setFloatingMenuPos({
        top: rect.top,
        left: rect.right,
      });
    }
  }, [isSidebarOpen, isHovered]);

  return (
    <div
      className='relative'
      onMouseEnter={() => !isSidebarOpen && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        ref={buttonRef}
        type='button'
        aria-disabled={!isSidebarOpen}
        onClick={() => isSidebarOpen && setIsExpanded((prev) => !prev)}
        className={`w-full flex items-center p-4 text-gray-400 hover:text-white hover:bg-white/5 transition-colors ${
          isSidebarOpen
            ? 'justify-between cursor-pointer'
            : 'justify-center cursor-pointer'
        }`}
      >
        <div className='flex items-center gap-3'>
          {icon && icon}
          {isSidebarOpen && (
            <span
              className={`text-md font-semibold ${isActive ? 'text-white' : ''}`}
            >
              {label}
            </span>
          )}
        </div>
        {isSidebarOpen && <ChevronIcon isOpen={isExpanded} />}
      </button>

      {/* 사이드바 열렸을 때: 인라인 서브메뉴 */}
      {isSidebarOpen && (
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          } bg-[#000c17]`}
        >
          <div>
            {items.map((item) => (
              <MenuButton key={item.id} to={item.to} isOpen={true}>
                {item.icon && item.icon}
                <span className='pl-10'>{item.label}</span>
              </MenuButton>
            ))}
          </div>
        </div>
      )}

      {/* 사이드바 접혔을 때: 호버 시 플로팅 서브메뉴 (포탈을 통해 렌더링) */}
      {!isSidebarOpen &&
        isHovered &&
        createPortal(
          <div
            className='fixed w-48 bg-[#1B1E2F] z-[9999] rounded-r-md shadow-lg border border-gray-700 overflow-hidden'
            style={{
              top: `${floatingMenuPos.top}px`,
              left: `${floatingMenuPos.left}px`,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {items.map((item) => (
              <MenuButton key={item.id} to={item.to} isOpen={true}>
                {item.icon && item.icon}
                <span>{item.label}</span>
              </MenuButton>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default MenuGroupItem;
