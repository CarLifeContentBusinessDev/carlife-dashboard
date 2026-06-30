import { useState } from 'react';

const ImageCell = ({ url }: { url: string }) => {
  const [error, setError] = useState(false);

  if (!url) return null;

  return (
    <div className='h-20 w-20 flex items-center justify-center rounded shadow border border-gray-200'>
      {!error ? (
        <img
          src={url}
          className='h-full max-w-full object-contain'
          onError={() => setError(true)}
        />
      ) : (
        <span className='text-gray-400 text-xs text-center'>
          이미지 <br />
          불러올 수 없음
        </span>
      )}
    </div>
  );
};

export default ImageCell;
