import type { ReactNode } from 'react';
import type { PicknowServer } from '@/constants/servers';

interface ConfigurationStatusProps {
  loginToken: string;
  loggedInSelectedServers: PicknowServer[];
  loading: boolean;
  error: string | null;
  children: ReactNode;
}

export default function ConfigurationStatus({
  loginToken,
  loggedInSelectedServers,
  loading,
  error,
  children,
}: ConfigurationStatusProps) {
  if (!loginToken) {
    return (
      <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 flex flex-col gap-3'>
        <p className='text-gray-600 text-sm'>
          Google Sheets 로그인이 필요합니다.
        </p>
      </div>
    );
  }
  if (loggedInSelectedServers.length === 0) {
    return (
      <div className='rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 flex flex-col gap-3'>
        <p className='text-gray-600 text-sm'>서버를 선택해 주세요</p>
      </div>
    );
  }
  if (loading) {
    return <p className='text-sm text-gray-400'>데이터를 불러오는 중...</p>;
  }
  if (error) {
    return (
      <p className='text-sm text-red-500 bg-red-50 px-4 py-2 rounded-md'>
        {error}
      </p>
    );
  }
  return <>{children}</>;
}
