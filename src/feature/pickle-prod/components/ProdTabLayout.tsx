import { useState } from 'react';
import PickleLoginBanner from '@/shared/components/common/PickleLoginBanner';
import TabHeader from '@/shared/components/common/TabHeader';

type TabType = 'data' | 'sync';

interface ProdTabLayoutProps {
  parentMenu: string;
  childMenu: string;
  isStaging: boolean;
  heightClass?: string;
  children: (activeTab: TabType) => React.ReactNode;
}

const ProdTabLayout = ({
  parentMenu,
  childMenu,
  isStaging,
  heightClass = 'h-full',
  children,
}: ProdTabLayoutProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('data');

  return (
    <div className={`flex flex-col ${heightClass}`}>
      <PickleLoginBanner
        serverId={isStaging ? 'pickle-stg' : 'pickle-prod'}
        serverLabel={isStaging ? 'STG' : '상용'}
      />
      <div className='p-10 flex flex-col h-full'>
        <h1 className='mb-4 indent-1 text-base'>
          <span className='text-gray-500'>{parentMenu} / </span>
          <span className='font-bold'>
            {childMenu}
            {isStaging ? ' (스테이징)' : ''}
          </span>
        </h1>

        <div className='w-full rounded-2xl bg-white mt-4 flex flex-col'>
          <TabHeader activeTab={activeTab} onChange={setActiveTab} />
          {children(activeTab)}
        </div>
      </div>
    </div>
  );
};

export default ProdTabLayout;
