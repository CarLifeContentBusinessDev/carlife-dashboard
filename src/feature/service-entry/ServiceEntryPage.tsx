import { useNavigate } from 'react-router-dom';
import { useServiceStore, getServiceToken } from '../../store/useServiceStore';
import type { ServiceType } from '../../store/useServiceStore';

const SERVICE_HOME: Record<ServiceType, string> = {
  pickle: '/episode-list',
  picknow: '/picknow/excel-sync',
};

export function ServiceEntryPage() {
  const navigate = useNavigate();
  const { setSelectedService } = useServiceStore();

  const handleSelect = (service: ServiceType) => {
    setSelectedService(service);
    const existingToken = getServiceToken(service);
    navigate(existingToken ? SERVICE_HOME[service] : `/${service}/login`);
  };

  return (
    <div className='min-h-screen bg-[#F6F7FA] flex flex-col items-center justify-center gap-10'>
      <div className='text-center'>
        <img
          src='/car.svg'
          alt='CarLife Admin'
          width={64}
          height={64}
          className='mx-auto mb-4'
        />
        <div className='flex flex-col gap-2'>
          <h1 className='text-4xl font-bold text-[#1B1E2F]'>
            Car Life Content Business
          </h1>
          <h1 className='text-4xl font-bold text-[#1B1E2F]'>Admin Page</h1>
        </div>
      </div>

      <div className='flex gap-6'>
        <button
          onClick={() => handleSelect('pickle')}
          className='w-64 h-52 rounded-2xl bg-[#1B1E2F] text-white flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform cursor-pointer'
        >
          <img src='/pickle_logo.svg' alt='pickle' width={48} height={48} />
          <span className='text-2xl font-bold'>Pickle</span>
          <span className='text-sm text-gray-400'>상용 & 데모 콘텐츠 관리</span>
        </button>

        <button
          onClick={() => handleSelect('picknow')}
          className='w-64 h-52 rounded-2xl bg-[#1B1E2F] text-white flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-transform cursor-pointer'
        >
          <img src='/picknow_logo.svg' alt='picknow' width={48} height={48} />
          <span className='text-2xl font-bold'>Picknow</span>
          <span className='text-sm text-gray-400'>Configuration 추출</span>
        </button>
      </div>
    </div>
  );
}
