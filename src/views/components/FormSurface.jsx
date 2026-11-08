'use client';
import {CalendarDays,ClipboardList,FilePenLine,LockKeyhole,Package,UserRound} from 'lucide-react';
export default function FormSurface({title,subtitle,code,children}){
 const name=`${title} ${code}`.toLowerCase();
 const Icon=/karyawan|profil|akun/.test(name)?UserRound:/izin|ijin|cuti|jadwal|shift/.test(name)?CalendarDays:/stok|bahan|produk|opname/.test(name)?Package:/laporan|review/.test(name)?ClipboardList:FilePenLine;
 return <section className="ais-form-surface" data-form={code}><header className="ais-form-heading"><span className="form-feature-icon"><Icon size={25} strokeWidth={1.8}/></span><div className="ais-form-heading-copy"><span className="form-eyebrow">{code}</span><h2>{title}</h2><p>{subtitle}</p></div><span className="form-private"><LockKeyhole size={13}/>Internal</span></header><div className="ais-form-body">{children}</div><footer className="ais-form-foot"><LockKeyhole size={14}/><span>Periksa kembali isian Anda sebelum dikirim.</span><span className="form-foot-brand">AIS People</span></footer></section>;
}
export function Field({label,hint,children}){return <label className="ais-field"><span className="ais-field-label">{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
