declare module 'dxf-parser';
declare module 'dxf-writer';
declare module 'pdf-parse';
declare module 'pdfkit';
declare module 'exceljs' {
  namespace ExcelJS {
    interface Worksheet {
      [key: string]: any;
    }
    interface Workbook {
      [key: string]: any;
    }
  }
  class Workbook {
    [key: string]: any;
  }
  export = ExcelJS;
  export { Workbook };
}
