import company from '../config/company.json' with {type:'json'};
import cars from '../config/cars.json' with {type:'json'};
export const statuses={hold:'Ожидает Telegram',pending:'На проверке',confirmed:'Подтверждена',active:'Авто выдано',completed:'Завершена',cancelled:'Отменена',expired:'Истекла'};
export class Failure extends Error{constructor(status,message){super(message);this.status=status;}}
export function configuration(env=process.env){
 const demo=env.DEMO_MODE!=='false',publicUrl=(env.PUBLIC_URL||'https://pronovichiok.github.io/my_first_app').replace(/\/$/,'');
 if(!demo)throw new Error('Рабочий приём документов отключён для Neon. Эта версия предназначена для учебной демонстрации.');
 if(!/^[a-f\d]{64}$/i.test(env.DATA_KEY||'')||(env.ADMIN_TOKEN||'').length<32)throw new Error('Настройте DATA_KEY и ADMIN_TOKEN в секретах функции.');
 return {demo,company,cars,publicUrl,adminToken:env.ADMIN_TOKEN,key:env.DATA_KEY,botToken:env.BOT_TOKEN||'',botUsername:env.BOT_USERNAME||'CarArendaKLNGBot',webhookSecret:env.TELEGRAM_WEBHOOK_SECRET||'',databaseUrl:env.DATABASE_URL_UNPOOLED||env.DATABASE_URL,allowedOrigin:new URL(publicUrl).origin};
}
export const publicCatalog=()=>({demo:true,brand:company.brand,cars:cars.map(({vin,plate,sts,insurance,...car})=>car),company:Object.fromEntries(['minAge','minExperienceYears','mileagePerDay','extraKmPrice','pickupAddress','phone','email'].map(k=>[k,company[k]])),consentVersion:company.consentVersion});
