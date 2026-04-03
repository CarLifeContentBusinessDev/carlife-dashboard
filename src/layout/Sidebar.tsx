import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Button from '../components/Button';
import { MENU_GROUPS } from '../constants/sidebarMenus';
import MenuGroupItem from './components/MenuGroupItem';
import MenuButton from './components/MenuButton';

const Sidebar = () => {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside
      className={`h-screen flex-shrink-0 bg-[#1B1E2F] shadow-md transition-all duration-300 flex flex-col ${
        isOpen ? 'w-80' : 'w-20'
      }`}
    >
      <div className='flex justify-end my-3 px-3 flex-shrink-0'>
        <Button
          className='!border-none !px-4'
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <img
            src={isOpen ? '/close.svg' : '/open.svg'}
            alt={isOpen ? '닫기' : '열기'}
            width={24}
            height={24}
          />
        </Button>
      </div>

      <nav
        className='flex-1 overflow-y-auto mt-5 flex flex-col gap-1 pb-40'
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          nav::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {MENU_GROUPS.map((group, index) => {
          const isActive = group.children
            ? group.children.some((item) => item.to === pathname)
            : pathname === group.to;

          return (
            <div key={group.id}>
              {index > 0 && <hr className='mx-4' />}

              {group.children ? (
                // 서브메뉴가 있는 경우
                <MenuGroupItem
                  label={group.label}
                  icon={group.icon}
                  isSidebarOpen={isOpen}
                  isActive={isActive}
                  items={group.children}
                />
              ) : (
                // 단일 메뉴 버튼인 경우
                <MenuButton
                  to={group.to!}
                  isOpen={isOpen}
                  openInNewTab={group.openInNewTab}
                >
                  {group.icon}
                  {isOpen && <span>{group.label}</span>}
                </MenuButton>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
