'use client';
import {Children,Fragment,cloneElement,isValidElement,useState} from 'react';
import {ChevronDown,ArrowUpRight} from 'lucide-react';

// Keep the original cells and event handlers; reflow the same records on small screens.
export function tableChildren(children,prefix=''){
 const result=[];
 Children.forEach(children,(child,i)=>{
  if(!isValidElement(child))return;
  const key=`${prefix}/${child.key??i}`;
  if(child.type===Fragment)result.push(...tableChildren(child.props.children,key));
  else result.push({element:child,key});
 });
 return result;
}
function textOf(value){
 if(typeof value==='string'||typeof value==='number')return String(value);
 if(isValidElement(value))return textOf(value.props.children)||value.props['aria-label']||'';
 if(Array.isArray(value))return value.map(textOf).filter(Boolean).join(' ');
 return '';
}
function interactive(value){return tableChildren(value).some(({element:e})=>['input','button','select'].includes(e.type)||!!e.props.onClick||interactive(e.props.children));}
export function tableHeaderLabels(children){
 const head=tableChildren(children).find(({element:e})=>e.type==='thead')?.element;
 const rows=tableChildren(head?.props.children),grid=[];
 rows.forEach(({element:row},r)=>{
  grid[r]??=[];let col=0;
  tableChildren(row.props.children).forEach(({element:cell})=>{
   while(grid[r][col]!==undefined)col++;
   const label=textOf(cell.props.children).trim(),span=Number(cell.props.colSpan)||1,down=Number(cell.props.rowSpan)||1;
   for(let y=r;y<r+down;y++){grid[y]??=[];for(let x=col;x<col+span;x++)grid[y][x]=label;}
   col+=span;
  });
 });
 const width=Math.max(0,...grid.map(r=>r.length));
 return Array.from({length:width},(_,col)=>{
  const labels=[...new Set(grid.map(r=>r[col]).filter(Boolean))];
  return labels.join(' / ')||(col===width-1?'Aksi':col===0?'Pilihan':`Kolom ${col+1}`);
 });
}
function ResponsiveRow({row,labels,summary,section}){
 const [expanded,setExpanded]=useState(false);
 const cells=tableChildren(row.props.children);
 if(!cells.length||cells.some(({element:e})=>!['td','th'].includes(e.type)))return row;
 const fullRow=cells.length===1&&Number(cells[0].element.props.colSpan)>1;
 const titleIndex=Math.max(0,labels.findIndex(l=>/^(nama|karyawan|toko|lokasi|tanggal|bahan|produk|task|sku|kode)/i.test(l)));
 const title=textOf(cells[titleIndex]?.element.props.children).trim().slice(0,90)||'data ini';
 let offset=0;
 const columns=cells.map(({element,key},index)=>{const column=offset;offset+=Number(element.props.colSpan)||1;return {element,key,index,label:labels[column]||`Kolom ${column+1}`};});
 const action=c=>c.label==='Aksi';
 const candidates=columns.filter(c=>c.index!==titleIndex&&!action(c));
 const preferred=summary?candidates.filter(c=>summary.includes(c.label)):candidates.slice(0,3);
 if(!summary){const status=candidates.find(c=>/^status$/i.test(c.label));if(status&&!preferred.includes(status)){if(preferred.length===3)preferred.pop();preferred.push(status);}}
 const primary=new Set([titleIndex,...preferred.map(c=>c.index)]);
 const extras=fullRow?[]:columns.filter(c=>!primary.has(c.index)&&!action(c));
 const clickable=typeof row.props.onClick==='function';
 return cloneElement(row,{
  className:`${row.props.className||''} record-row`,
  'data-record-open':expanded?'true':'false',
  'data-record-full':fullRow?'true':undefined,
  'data-record-hidden':row.props.hidden||row.props.style?.display==='none'?'true':undefined,
  'data-record-section':section,
 },<>{columns.map(c=>cloneElement(c.element,{
  key:c.key,
  'data-record-title':!fullRow&&c.index===titleIndex?'true':undefined,
  'data-record-extra':extras.includes(c)?'true':undefined,
  'data-record-action':action(c)?'true':undefined,
  'data-column-label':c.label,
  'data-record-hidden':c.element.props.hidden||c.element.props.style?.display==='none'?'true':undefined,
 },<><span className="record-cell-label" aria-hidden="true">{c.label}</span><span className="record-cell-value">{c.element.props.children}</span></>))}
 {!fullRow&&(extras.length>0||clickable)&&<td className="record-row-disclosure" colSpan={Math.max(offset,1)}>
  {extras.length>0&&<button type="button" aria-expanded={expanded} aria-label={`${expanded?'Tutup':'Lihat'} rincian ${title}`} onClick={e=>{e.stopPropagation();setExpanded(!expanded);}}><span>{expanded?'Tutup rincian':'Lihat rincian'}<small>{extras.length} informasi</small></span><ChevronDown size={16}/></button>}
  {clickable&&<button type="button" className="record-open-detail" onClick={e=>{e.stopPropagation();row.props.onClick(e);}}>Buka detail<ArrowUpRight size={15}/></button>}
 </td>}</>);
}
export default function ResponsiveTable({children,className='',mobileSummary,...props}){
 const labels=tableHeaderLabels(children);
 return <table {...props} className={`${className} responsive-records`}>
  {tableChildren(children).map(({element:section,key})=>{
   if(section.type==='thead'){
    const controls=tableChildren(section.props.children).some(({element:r})=>tableChildren(r.props.children).some(({element:c})=>interactive(c.props.children)||!!c.props.onClick));
    return cloneElement(section,{key,'data-record-controls':controls?'true':undefined},tableChildren(section.props.children).map(({element:r,key:rk})=>cloneElement(r,{key:rk},tableChildren(r.props.children).map(({element:c,key:ck})=>cloneElement(c,{key:ck,'data-record-control':interactive(c.props.children)||c.props.onClick?'true':undefined},c.props.children)))));
   }
   if(['tbody','tfoot'].includes(section.type))return cloneElement(section,{key},tableChildren(section.props.children).map(({element:row,key:rk})=>row.type==='tr'?<ResponsiveRow key={rk} row={row} labels={labels} summary={mobileSummary} section={section.type}/>:row));
   return cloneElement(section,{key});
  })}
 </table>;
}
