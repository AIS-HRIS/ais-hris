import {EMPLOYEES} from './referenceData';
// A single mapping for the existing demo accounts; do not invent IDs for new records.
const demoNiks=new Map(EMPLOYEES.map((employee,index)=>[employee.id,`2026${String(index+1).padStart(4,'0')}`]));
export function employeeNik(employee){
 const supplied=typeof employee?.nik==='string'?employee.nik.trim():typeof employee?.nik==='number'?String(employee.nik):'';
 return supplied||demoNiks.get(employee?.id)||'';
}
