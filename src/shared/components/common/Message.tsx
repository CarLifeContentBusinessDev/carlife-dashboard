const Message = ({
  message,
  type,
  className,
}: {
  message: React.ReactNode;
  type: 'info' | 'warning' | 'error';
  className?: string;
}) => {
  switch (type) {
    case 'info':
      return (
        <div
          className={`mt-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-800 ${className || ''}`}
        >
          <svg
            className='w-5 h-5 shrink-0 text-blue-800'
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='currentColor'
          >
            <path d='M5 18H19V11.0314C19 7.14806 15.866 4 12 4C8.13401 4 5 7.14806 5 11.0314V18ZM12 2C16.9706 2 21 6.04348 21 11.0314V20H3V11.0314C3 6.04348 7.02944 2 12 2ZM9.5 21H14.5C14.5 22.3807 13.3807 23.5 12 23.5C10.6193 23.5 9.5 22.3807 9.5 21Z'></path>
          </svg>

          {message}
        </div>
      );
    case 'warning':
      return (
        <div
          className={`mt-4 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-3 text-sm text-yellow-800 ${className || ''}`}
        >
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
          {message}
        </div>
      );
    case 'error':
      return <div></div>;
    default:
      return;
  }
};

export default Message;
