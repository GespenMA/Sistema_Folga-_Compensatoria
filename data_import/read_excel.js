const xlsx = require('xlsx');

const workbook = xlsx.readFile('C:\\Users\\jonhy\\Downloads\\Bico Legal\\Planejado por Unidade .xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Columns:', Object.keys(data[0] || {}));
console.log('First 3 rows:', data.slice(0, 3));
