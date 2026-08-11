import Message from '@/shared/components/common/Message';
import { usePickleServerStore } from '@/shared/store/usePickleServerStore';

interface Props {
  serverId: string;
  serverLabel?: string;
}

const PickleLoginBanner = ({ serverId, serverLabel }: Props) => {
  const { isServerLoggedIn } = usePickleServerStore();
  if (isServerLoggedIn(serverId)) return null;

  const label = serverLabel ?? serverId;

  return (
    <div className='mx-10'>
      <Message
        message={
          <span>
            {label === '웹데모' && <span>조회 이외의 기능을 수행하려면 </span>}
            <strong>{label} 서버 </strong>
            로그인이 필요합니다. 헤더의 &quot;서버 연결&quot; 버튼에서
            연결해주세요.
          </span>
        }
        type='warning'
      />
    </div>
  );
};

export default PickleLoginBanner;
