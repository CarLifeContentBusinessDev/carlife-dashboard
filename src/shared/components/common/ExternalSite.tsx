type ExternalSiteProps = {
  src: string;
  title: string;
};

const ExternalSite = ({ src, title }: ExternalSiteProps) => {
  return (
    <div className='flex flex-col w-full h-full'>
      <iframe
        src={src}
        title={title}
        width='100%'
        height='100%'
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default ExternalSite;
