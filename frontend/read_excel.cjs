const xlsx = require('xlsx');

try {
  const workbook = xlsx.readFile('C:\\Users\\jonhy\\Downloads\\Bico Legal\\Planejado por Unidade .xlsx');
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  
  // Imprimir os primeiros 10 registros para entender a estrutura
  console.log(JSON.stringify(data.slice(0, 10), null, 2));
} catch (e) {
  console.error("Error reading file:", e);
}
