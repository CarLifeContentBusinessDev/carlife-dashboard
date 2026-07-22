import carSvg from '@/assets/car.svg';
import pickleLogo from '@/assets/pickle_logo.svg';
import picknowLogo from '@/assets/picknow_logo.svg';
import pickseriesLogo from '@/assets/pickseries_logo.svg';
import { EntryButton } from '@/feature/service-entry/components/EntryButton';
import type { ServiceType } from '@/shared/store/useServiceStore';
import { useServiceStore } from '@/shared/store/useServiceStore';
import { useNavigate } from 'react-router-dom';

const SERVICE_HOME: Record<ServiceType, string> = {
  pickle: '/pickle/episodes',
  picknow: '/picknow/excel-sync',
  pickseries: '/pickseries/operation/weekly',
};

const ENTRY_MENU: Record<
  ServiceType,
  { logo: string; title: string; description: string }
> = {
  pickle: {
    logo: pickleLogo,
    title: 'Pickle',
    description: '콘텐츠 관리 및 RSS/썸네일 생성',
  },
  picknow: {
    logo: picknowLogo,
    title: 'Picknow',
    description: 'Configuration 추출',
  },
  pickseries: {
    logo: pickseriesLogo,
    title: 'Pick Series',
    description: '운영 통합 대시보드 관리',
  },
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
        {Object.entries(ENTRY_MENU).map(
          ([service, { logo, title, description }]) => (
            <EntryButton
              key={service}
              handleSelect={() => handleSelect(service as ServiceType)}
              logo={logo}
              title={title}
              description={description}
            />
          )
        )}
      </div>
    </div>
  );
}
