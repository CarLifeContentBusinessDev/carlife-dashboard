interface CardBodyStatusProps {
  isConnected: boolean;
  state: { loading: boolean; error: string | null };
  isEmpty: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

const CardBodyStatus = ({
  isConnected,
  state,
  isEmpty,
  emptyMessage = '항목이 없습니다',
  children,
}: CardBodyStatusProps) => {
  const emptyClass = 'px-4 py-8 text-center text-sm';

  if (!isConnected)
    return <div className={`${emptyClass} text-gray-400`}>서버 미연결</div>;
  if (state.loading)
    return <div className={`${emptyClass} text-gray-400`}>불러오는 중...</div>;
  if (state.error)
    return <div className={`${emptyClass} text-red-400`}>{state.error}</div>;
  if (isEmpty)
    return <div className={`${emptyClass} text-gray-400`}>{emptyMessage}</div>;

  return <>{children}</>;
};

export default CardBodyStatus;
