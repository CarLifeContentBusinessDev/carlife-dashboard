interface LoadingOverlayProps {
  children?: React.ReactNode;
  progress?: string | number;
  vertical?: boolean;
  loading: boolean;
}

const LoadingOverlay = ({
  children,
  progress,
  vertical = true,
  loading,
}: LoadingOverlayProps) => {
  let boxStyle = 'flex-col flex-1 text-white bg-black/30 min-h-[400px]';
  let spinnerStyle = 'w-12 h-12 border-white';

  if (!vertical) {
    boxStyle = 'text-black flex-shrink-0 min-w-fit';
    spinnerStyle = 'w-8 h-8 border-black flex-shrink-0';
  }

  return (
    <>
      {loading && (
        <div
          className={`flex gap-4 items-center justify-center box-border ${boxStyle}`}
        >
          <p className='text-center font-bold whitespace-nowrap'>{children}</p>
          <div
            className={`border-4 ${spinnerStyle} border-t-transparent rounded-full animate-spin`}
          ></div>
          {progress && <span className='whitespace-nowrap'>{progress}</span>}
        </div>
      )}
    </>
  );
};

export default LoadingOverlay;
