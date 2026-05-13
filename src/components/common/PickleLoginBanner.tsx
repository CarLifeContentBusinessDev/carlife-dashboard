import { usePickleServerStore } from '../../store/usePickleServerStore';

interface Props {
  serverId: string;
  serverLabel?: string;
}

const PickleLoginBanner = ({ serverId, serverLabel }: Props) => {
  const { isServerLoggedIn } = usePickleServerStore();
  if (isServerLoggedIn(serverId)) return null;

  const label = serverLabel ?? serverId;

  return (
    <div className='mx-10 mt-4 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-3 text-sm text-yellow-800'>
      <svg
        className='w-5 h-5 shrink-0 text-yellow-500'
        fill='none'
        viewBox='0 0 24 24'
        stroke='currentColor'
        strokeWidth={2}
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
        />
      </svg>
      <span>
        {label === '웹데모' && <span>조회 이외의 기능을 수행하려면 </span>}
        <strong>{label} 서버 </strong>
        로그인이 필요합니다. 헤더의 &quot;서버 연결&quot; 버튼에서 연결해주세요.
      </span>
    </div>
  );
};

export default PickleLoginBanner;
