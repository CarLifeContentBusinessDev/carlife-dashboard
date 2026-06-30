interface FormFieldProps {
  label: React.ReactNode;
  children?: React.ReactNode;
  hint?: string;
}

const FormField = ({ label, children, hint }: FormFieldProps) => {
  return (
    <div className='flex flex-col gap-1.5'>
      <label className='text-xs font-semibold uppercase tracking-widest text-gray-400'>
        {label}
      </label>
      {children}

      {hint && <p className='text-xs text-gray-400'>{hint}</p>}
    </div>
  );
};

export default FormField;
