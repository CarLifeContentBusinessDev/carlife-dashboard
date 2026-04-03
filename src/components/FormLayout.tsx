interface Props {
  title: string;
  id?: number | string;
  children: React.ReactNode;
}

const FormLayout = ({ title, id, children }: Props) => {
  return (
    <div className='p-10 pb-10 flex flex-col h-full min-h-0 '>
      <div className='flex items-center gap-3 mb-4'>
        <h1 className='text-3xl font-bold indent-1'>{title}</h1>

        {id && (
          <span className='ml-2 px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm font-mono'>
            ID #{id}
          </span>
        )}
      </div>

      <div className='w-full rounded-2xl bg-white mt-4 p-8 flex flex-col'>
        {children}
      </div>
    </div>
  );
};

export default FormLayout;
