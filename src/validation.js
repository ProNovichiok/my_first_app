import {z} from 'zod';
export const bookingSchema=z.object({car:z.string().min(1).max(40),start:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),end:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)}).strict();
export function period(start,end,now=Date.now()){
 function parse(s){const n=Date.parse(s+':00+02:00');if(!Number.isFinite(n)||new Date(n+7200000).toISOString().slice(0,16)!==s)throw Error('Некорректная дата.');return n;}
 const a=parse(start),b=parse(end);
 if(a<now+15*60000)throw Error('Выдача — минимум через 15 минут.');
 if(a>now+366*86400000||b<=a||b-a<3600000||b-a>90*86400000)throw Error('Срок аренды: от 1 часа до 90 суток; бронирование на год вперёд.');
 return {start:new Date(a).toISOString(),end:new Date(b).toISOString(),days:Math.ceil((b-a)/86400000)};
}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;},'Некорректная дата');
const text=z.string().trim().min(2).max(300).refine(s=>!/[\x00-\x1f]/.test(s),'Недопустимые символы');
export const personSchema=z.object({fullName:text,birthDate:date,phone:z.string().regex(/^\+7\d{10}$/,'Телефон +7 и 10 цифр'),passportSeries:z.string().regex(/^\d{4}$/),passportNumber:z.string().regex(/^\d{6}$/),passportIssuedBy:text,passportIssuedDate:date,passportCode:z.string().regex(/^\d{3}-\d{3}$/),registrationAddress:text,licenseNumber:z.string().regex(/^\d{10}$/),licenseIssuedDate:date,licenseExpires:date,drivingSince:date,categoryB:z.literal(true),consent:z.literal(true),consentVersion:z.string().max(50)}).strict();
export function validatePerson(p,company,booking){
 const today=new Date().toISOString().slice(0,10);
 function years(s){const d=new Date(s);const t=new Date();return t.getUTCFullYear()-d.getUTCFullYear()-(t.toISOString().slice(5,10)<s.slice(5)?1:0);}
 if(years(p.birthDate)<company.minAge||years(p.birthDate)>100)throw Error('Возраст не соответствует условиям аренды.');
 if(years(p.drivingSince)<company.minExperienceYears)throw Error('Недостаточный водительский стаж.');
 if(p.passportIssuedDate>today||p.passportIssuedDate<p.birthDate||p.licenseIssuedDate>today||p.drivingSince<p.birthDate||p.drivingSince>p.licenseIssuedDate||p.licenseExpires<booking.end.slice(0,10)||p.licenseExpires<=p.licenseIssuedDate)throw Error('Проверьте даты документов. Права должны действовать до окончания аренды.');
 if(p.consentVersion!==company.consentVersion)throw Error('Текст согласия обновился. Откройте форму заново.');
 return p;
}