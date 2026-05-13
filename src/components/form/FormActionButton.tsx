import { toast } from 'react-toastify';
import { useAccessTokenStore } from '../../store/useAccessTokenStore';

interface FormActionsButtonProps {
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
}

const FormActionsButton = ({
  saving,
  error,
  onCancel,
  onSave,
}: FormActionsButtonProps) => {
  const { accessToken } = useAccessTokenStore();

  const handleSave = () => {
    if (!accessToken) {
      toast.warn('웹데모 로그인이 필요합니다.');
      return;
    }
    onSave();
  };
  return (
    <>
      <div className='flex justify-center items-center gap-3 mt-auto'>
        {error && <div className='text-red-500 text-sm'>{error}</div>}

        <button
          onClick={onCancel}
          className='px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50'
        >
          취소
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className='px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2'
        >
          {saving && (
            <div className='w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin' />
          )}
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </>
  );
};

export default FormActionsButton;
