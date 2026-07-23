import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Button from '@/shared/components/common/Button';
import {
  PICKLE_MENU_GROUPS,
  PICKNOW_MENU_GROUPS,
  PICKSERIES_MENU_GROUPS,
} from '@/constants/sidebarMenus';
import MenuGroupItem from './components/MenuGroupItem';
import MenuButton from './components/MenuButton';
import { useServiceStore } from '@/shared/store/useServiceStore';
import closeIcon from '@/assets/close.svg';
import openIcon from '@/assets/open.svg';

const Sidebar = () => {
  const { pathname } = useLocation();
  const { selectedService } = useServiceStore();
  const [isOpen, setIsOpen] = useState(true);

  const menuGroups =
    selectedService === 'picknow'
      ? PICKNOW_MENU_GROUPS
      : selectedService === 'pickseries'
        ? PICKSERIES_MENU_GROUPS
        : PICKLE_MENU_GROUPS;

  return (
    <aside
      className={`h-screen shrink-0 bg-[#1B1E2F] shadow-md transition-all duration-300 flex flex-col ${
        isOpen ? 'w-75' : 'w-20'
      }`}
    >
      <div className='flex justify-end my-3 px-3 shrink-0'>
        <Button
          className='border-none! px-4!'
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <img
            src={isOpen ? closeIcon : openIcon}
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
        {menuGroups.map((group, index) => {
          const isActive = group.children
            ? group.children.some((item) => item.to === pathname)
            : pathname === group.to;

          return (
            <div key={group.id}>
              {index > 0 && <hr className='mx-4' />}

              {group.children ? (
                <MenuGroupItem
                  label={group.label}
                  icon={group.icon}
                  isSidebarOpen={isOpen}
                  isActive={isActive}
                  items={group.children}
                  isFirstGroup={index === 0}
                />
              ) : (
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
