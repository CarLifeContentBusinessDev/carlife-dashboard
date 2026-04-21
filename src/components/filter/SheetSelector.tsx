interface SheetSelectorProps {
  sheetList: { id: string; name: string }[];
  selectedSheet: string;
  isStaging: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const SheetSelector = ({
  sheetList,
  selectedSheet,
  isStaging,
  disabled,
  onChange,
}: SheetSelectorProps) => (
  <select
    value={selectedSheet}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className='w-fit appearance-none border border-gray-300 px-4 py-2 pr-10 rounded-lg bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition cursor-pointer'
  >
    <option value=''>시트 선택</option>
    {sheetList
      .filter((sheet) =>
        isStaging
          ? sheet.name.startsWith('stg_')
          : !sheet.name.startsWith('stg_')
      )
      .map((sheet) => (
        <option key={sheet.id} value={sheet.name}>
          {sheet.name}
        </option>
      ))}
  </select>
);

export default SheetSelector;
