const xlsx = require('xlsx');

try {
  const workbook = xlsx.readFile('C:\\Users\\jonhy\\Downloads\\Bico Legal\\Planejado por Unidade .xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log("Total rows:", data.length);
  console.log("First 5 rows:");
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
} catch (e) {
  console.error(e);
}
