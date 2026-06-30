import carSvg from '@/assets/car.svg';
import pickleLogo from '@/assets/pickle_logo.svg';
import picknowLogo from '@/assets/picknow_logo.svg';
import pickseriesLogo from '@/assets/pickseries_logo.svg';
import type { ServiceType } from '@/shared/store/useServiceStore';
import { useServiceStore } from '@/shared/store/useServiceStore';
import { useNavigate } from 'react-router-dom';

const SERVICE_HOME: Record<ServiceType, string> = {
  pickle: '/pickle/episodes',
  picknow: '/picknow/excel-sync',
  pickseries: '/pickseries/operation/weekly',
};

export default function ServiceEntryPage() {
  const navigate = useNavigate();
  const { setSelectedService } = useServiceStore();

  const handleSelect = (service: ServiceType) => {
    setSelectedService(service);
    navigate(SERVICE_HOME[service]);
  };

  return (
    <div className='min-h-screen bg-[#F6F7FA] flex flex-col items-center justify-center gap-10'>
      <div className='text-center'>
        <img
          src={carSvg}
          alt='CarLife Admin'
          width={64}
          height={64}
          className='mx-auto mb-4'
        />
        <div className='flex flex-col gap-2'>
          <h1 className='text-4xl font-bold text-[#1B1E2F]'>
            Car Life Content Business
          </h1>
          <h1 className='text-4xl font-bold text-[#1B1E2F]'>DashBoard</h1>
        </div>
      </div>

      <div className='flex gap-6'>
        {/* Pickle */}
        <button
          onClick={() => handleSelect('pickle')}
          className='w-64 h-52 rounded-2xl bg-[#1B1E2F] text-white flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform cursor-pointer'
        >
          <img src={pickleLogo} alt='pickle' width={48} height={48} />
          <span className='text-2xl font-bold'>Pickle</span>
          <span className='text-sm text-gray-400'>상용 & 데모 콘텐츠 관리</span>
        </button>

        {/* Picknow */}
        <button
          onClick={() => handleSelect('picknow')}
          className='w-64 h-52 rounded-2xl bg-[#1B1E2F] text-white flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform cursor-pointer'
        >
          <img src={picknowLogo} alt='picknow' width={48} height={48} />
          <span className='text-2xl font-bold'>Picknow</span>
          <span className='text-sm text-gray-400'>Configuration 추출</span>
        </button>

        {/* 픽시리즈 운영 */}
        <button
          onClick={() => handleSelect('pickseries')}
          className='w-64 h-52 rounded-2xl bg-[#1B1E2F] text-white flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform cursor-pointer'
        >
          <img src={pickseriesLogo} alt='pickseries' width={48} height={48} />
          <span className='text-2xl font-bold'>Pick Series</span>
          <span className='text-sm text-gray-400'>운영 통합 대시보드 관리</span>
        </button>
      </div>
    </div>
  );
}
