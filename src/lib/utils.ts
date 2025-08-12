import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as XLSX from 'xlsx';
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const generateFileName = (base: string, userName?: string, dateRange?: { from?: Date; to?: Date }) => {
    const userPart = userName ? `_${userName.replace(/\s+/g, '_')}` : '';
    const datePart = dateRange?.from
        ? `_${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to || dateRange.from, 'yyyy-MM-dd')}`
        : '';
    return `${base}${userPart}${datePart}`;
}
