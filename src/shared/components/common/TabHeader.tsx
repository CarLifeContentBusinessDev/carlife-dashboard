type TabType = 'data' | 'sync';

interface TabHeaderProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

const TabHeader = ({ activeTab, onChange }: TabHeaderProps) => (
  <div className='flex border-b border-gray-200 shrink-0'>
    <button
      onClick={() => onChange('data')}
      className={`px-6 py-4 text-sm font-semibold transition cursor-pointer ${
        activeTab === 'data'
          ? 'text-point-color border-b-2 border-point-color'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      데이터 조회
    </button>
    <button
      onClick={() => onChange('sync')}
      className={`px-6 py-4 text-sm font-semibold transition cursor-pointer ${
        activeTab === 'sync'
          ? 'text-point-color border-b-2 border-point-color'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      Excel 동기화
    </button>
  </div>
);

export default TabHeader;
