export const buildSheetRange = (sheetName: string, range: string): string => {
  const escapedSheetName = sheetName.replace(/'/g, "''");
  return `'${escapedSheetName}'!${range}`;
};
