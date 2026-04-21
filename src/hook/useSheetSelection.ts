import { useEffect, useState } from 'react';
import getSheetList from '../utils/api/getSheetList';

interface UseSheetSelectionParams {
  isStaging: boolean;
  loginToken: string;
  spreadsheetId: string;
  defaultSheetName: string;
  storageKey: string;
}

export function useSheetSelection({
  isStaging,
  loginToken,
  spreadsheetId,
  defaultSheetName,
  storageKey,
}: UseSheetSelectionParams) {
  const [sheetList, setSheetList] = useState<{ id: string; name: string }[]>(
    []
  );
  const [selectedSheet, setSelectedSheet] = useState(
    localStorage.getItem(storageKey) || defaultSheetName
  );

  useEffect(() => {
    if (loginToken) {
      getSheetList(spreadsheetId).then((list) => {
        setSheetList(list);

        const filteredSheets = list.filter((sheet) =>
          isStaging
            ? sheet.name.startsWith('stg_')
            : !sheet.name.startsWith('stg_')
        );
        const savedSheet = localStorage.getItem(storageKey);
        const isSavedSheetValid = filteredSheets.some(
          (sheet) => sheet.name === savedSheet
        );
        const hasDefaultSheet = filteredSheets.some(
          (sheet) => sheet.name === defaultSheetName
        );

        const nextSheet = isSavedSheetValid
          ? savedSheet!
          : hasDefaultSheet
            ? defaultSheetName
            : '';

        setSelectedSheet(nextSheet);
        if (nextSheet) {
          localStorage.setItem(storageKey, nextSheet);
        } else {
          localStorage.removeItem(storageKey);
        }
      });
    }
  }, [defaultSheetName, isStaging, loginToken, storageKey, spreadsheetId]);

  const handleSelectSheet = (value: string) => {
    setSelectedSheet(value);
    localStorage.setItem(storageKey, value);
  };

  return { sheetList, selectedSheet, setSelectedSheet, handleSelectSheet };
}
