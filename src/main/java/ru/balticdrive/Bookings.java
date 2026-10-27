package ru.balticdrive;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.time.*;
import java.time.format.*;
import java.time.temporal.*;
import java.util.*;
import static ru.balticdrive.Json.*;
import static ru.balticdrive.Database.*;
public final class Bookings {
 public static final ZoneId ZONE=ZoneId.of("Europe/Kaliningrad");
 public static final Map<String,String> STATUSES=new LinkedHashMap<>();
 static{STATUSES.put("hold","Ожидает Telegram");STATUSES.put("pending","На проверке");STATUSES.put("confirmed","Подтверждена");STATUSES.put("active","Авто выдано");STATUSES.put("completed","Завершена");STATUSES.put("cancelled","Отменена");STATUSES.put("expired","Истекла");}
 private final Config c;private final Database db;
 public Bookings(Config c,Database db){this.c=c;this.db=db;}
 public static String iso(Instant date){return new DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(date);}
 public static ObjectNode dates(String start,String end,Instant now){
  try{
   if(!start.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}")||!end.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}"))throw new Exception();
   Instant a=LocalDateTime.parse(start).atZone(ZONE).toInstant(),b=LocalDateTime.parse(end).atZone(ZONE).toInstant();long duration=Duration.between(a,b).toMillis();
   if(a.isBefore(now.plusSeconds(900)))throw new Failure(400,"Выдача — минимум через 15 минут.");
   if(a.isAfter(now.plus(366,ChronoUnit.DAYS))||duration<3600000||duration>90L*86400000)throw new Failure(400,"Срок аренды: от 1 часа до 90 суток; бронирование на год вперёд.");
   return obj("start",iso(a),"end",iso(b),"days",(duration+86400000-1)/86400000);
  }catch(Failure e){throw e;}catch(Exception e){throw new Failure(400,"Проверьте дату и время.");}
 }
 public static ObjectNode view(JsonNode b){ObjectNode out=M.createObjectNode();for(String key:List.of("id","car","start","end","days","total","deposit","status","expires"))out.set(key,b.get(key));return out;}
 public ObjectNode create(JsonNode input){
  if(!input.isObject()||input.size()!=3||!input.has("car")||!input.has("start")||!input.has("end"))throw new Failure(400,"Проверьте автомобиль, даты и время.");
  JsonNode car=c.car(s(input,"car"));ObjectNode dates=dates(s(input,"start"),s(input,"end"),Instant.now());
  return db.tx(()->{
   if(db.overlaps(s(car,"id"),s(dates,"start"),s(dates,"end"),""))throw new Failure(409,"На эти даты автомобиль занят. Выберите другие даты или автомобиль.");
   String id=UUID.randomUUID().toString(),claim=token();long created=System.currentTimeMillis(),days=num(dates,"days");
   var terms=obj("price",car.path("price"),"mileagePerDay",c.company.path("mileagePerDay"),"extraKmPrice",c.company.path("extraKmPrice"),"car",car,"company",c.company);
   db.execute("INSERT INTO bookings(id,car,start,end,days,total,deposit,status,expires,created,claim_hash,terms) VALUES(?,?,?,?,?,?,?,'hold',?,?,?,?)",id,s(car,"id"),s(dates,"start"),s(dates,"end"),days,days*num(car,"price"),num(car,"deposit"),created+1800000,created,hash(claim),str(terms));
   db.audit(id,"created");ObjectNode out=view(db.get(id));out.put("telegramUrl","https://t.me/"+c.botUsername+"?start="+claim);return out;
  });
 }
 public ObjectNode claim(String raw,String chat){
  return db.tx(()->{db.expire();ObjectNode b=db.one("SELECT * FROM bookings WHERE claim_hash=?",hash(raw));
   if(b==null||!s(b,"status").equals("hold")||num(b,"expires")<System.currentTimeMillis())throw new Failure(410,"Заявка истекла или уже оформлена. Выберите автомобиль на сайте.");
   if(!s(b,"chat_hash").isBlank()&&!s(b,"chat_hash").equals(hash(chat)))throw new Failure(403,"Эта заявка уже связана с другим аккаунтом.");
   String form=token();db.execute("UPDATE bookings SET chat_hash=?,chat_enc=?,form_hash=?,form_expires=? WHERE id=?",hash(chat),db.encrypt(chat),hash(form),Math.min(System.currentTimeMillis()+1800000,num(b,"expires")),s(b,"id"));db.audit(s(b,"id"),"telegram_linked");
   ObjectNode out=view(b);out.put("formUrl",c.publicUrl+"/#apply="+form);return out;});
 }
 public ObjectNode form(String raw){synchronized(db){db.expire();ObjectNode b=db.one("SELECT * FROM bookings WHERE form_hash=?",hash(raw));if(b==null||!s(b,"status").equals("hold")||num(b,"form_expires")<System.currentTimeMillis()||num(b,"expires")<System.currentTimeMillis())throw new Failure(410,"Ссылка недействительна или истекла. Начните бронирование заново.");return b;}}
 private LocalDate date(JsonNode p,String key){try{String text=s(p,key);LocalDate d=LocalDate.parse(text);if(!d.toString().equals(text))throw new Exception();return d;}catch(Exception e){throw new Failure(400,"Проверьте даты документов.");}}
 private void person(JsonNode p,JsonNode b){
  Set<String> fields=Set.of("fullName","birthDate","phone","passportSeries","passportNumber","passportIssuedBy","passportIssuedDate","passportCode","registrationAddress","licenseNumber","licenseIssuedDate","licenseExpires","drivingSince","categoryB","consent","consentVersion");
  if(!p.isObject()||p.size()!=fields.size())throw new Failure(400,"Проверьте поля анкеты.");
  p.fieldNames().forEachRemaining(k->{if(!fields.contains(k))throw new Failure(400,"Неизвестное поле анкеты.");});
  for(String key:List.of("fullName","passportIssuedBy","registrationAddress")){String v=s(p,key).strip();if(!p.path(key).isTextual()||v.length()<2||v.length()>300||v.chars().anyMatch(x->x<32))throw new Failure(400,"Проверьте ФИО, адрес и орган выдачи.");}
  Map<String,String> patterns=Map.of("phone","\\+7\\d{10}","passportSeries","\\d{4}","passportNumber","\\d{6}","passportCode","\\d{3}-\\d{3}","licenseNumber","\\d{10}");
  patterns.forEach((key,re)->{if(!p.path(key).isTextual()||!s(p,key).matches(re))throw new Failure(400,"Проверьте реквизиты документов и телефон +7.");});
  if(!p.path("consent").isBoolean()||!p.path("consent").asBoolean()||!p.path("categoryB").isBoolean()||!p.path("categoryB").asBoolean())throw new Failure(400,"Нужны категория B и отдельное согласие.");
  if(!s(p,"consentVersion").equals(s(c.company,"consentVersion")))throw new Failure(400,"Согласие обновилось. Откройте форму заново.");
  LocalDate today=LocalDate.now(ZONE),birth=date(p,"birthDate"),passport=date(p,"passportIssuedDate"),issued=date(p,"licenseIssuedDate"),expires=date(p,"licenseExpires"),since=date(p,"drivingSince");
  long age=ChronoUnit.YEARS.between(birth,today),experience=ChronoUnit.YEARS.between(since,today);
  if(age<num(c.company,"minAge")||age>100)throw new Failure(400,"Возраст не соответствует условиям аренды.");
  if(experience<num(c.company,"minExperienceYears"))throw new Failure(400,"Недостаточный водительский стаж.");
  if(passport.isAfter(today)||passport.isBefore(birth)||issued.isAfter(today)||since.isBefore(birth)||since.isAfter(issued)||expires.isBefore(Instant.parse(s(b,"end")).atZone(ZONE).toLocalDate())||!expires.isAfter(issued))throw new Failure(400,"Проверьте даты. Права должны действовать до окончания аренды.");
 }
 public ObjectNode submit(String raw,JsonNode input){
  if(c.demo)throw new Failure(403,"Демонстрационный режим: настоящие документы не принимаются. Посмотрите пример в кабинете владельца.");
  return db.tx(()->{ObjectNode b=form(raw);person(input,b);if(db.overlaps(s(b,"car"),s(b,"start"),s(b,"end"),s(b,"id")))throw new Failure(409,"Автомобиль уже занят.");
   ObjectNode p=(ObjectNode)input.deepCopy();for(String field:List.of("fullName","passportIssuedBy","registrationAddress"))p.put(field,s(p,field).strip());
   var consent=obj("at",iso(Instant.now()),"version",c.company.path("consentVersion"),"privacyVersion",c.company.path("privacyVersion"),"text",Legal.consent(c.company),"method","Отдельный непредустановленный checkbox и отправка формы по одноразовой ссылке","scope","Заявка; не подпись договора");
   db.execute("UPDATE bookings SET pii=?,consent=?,status='pending',expires=?,form_hash=NULL,claim_hash=NULL WHERE id=?",db.encrypt(p),str(consent),System.currentTimeMillis()+86400000,s(b,"id"));db.audit(s(b,"id"),"application_submitted");return view(db.get(s(b,"id")));
  });
 }
 public ObjectNode status(String id,String next){
  Map<String,List<String>> transitions=Map.of("hold",List.of("cancelled"),"pending",List.of("confirmed","cancelled"),"confirmed",List.of("active","cancelled"),"active",List.of("completed"));
  return db.tx(()->{db.expire();ObjectNode b=db.get(id);if(b==null)throw new Failure(404,"Заявка не найдена.");if(!transitions.getOrDefault(s(b,"status"),List.of()).contains(next))throw new Failure(409,"Недопустимый переход статуса.");
   if(next.equals("confirmed")&&(s(b,"pii").isBlank()||db.overlaps(s(b,"car"),s(b,"start"),s(b,"end"),id)))throw new Failure(409,"Нет анкеты или есть пересечение дат.");
   db.execute("UPDATE bookings SET status=?,closed=?,claim_hash=NULL,form_hash=NULL WHERE id=?",next,List.of("cancelled","completed").contains(next)?System.currentTimeMillis():null,id);db.audit(id,"status:"+next);return view(db.get(id));
  });
 }
 public void payment(String id,JsonNode input){db.tx(()->{ObjectNode b=db.get(id);if(b==null)throw new Failure(404,"Заявка не найдена.");JsonNode amount=input.path("amount");if(!amount.isIntegralNumber()||!amount.canConvertToLong()||amount.asLong()<0||amount.asLong()>num(b,"total"))throw new Failure(400,"Укажите полученную сумму аренды от 0 до стоимости договора, без залога.");db.execute("UPDATE bookings SET paid=? WHERE id=?",amount.asLong(),id);db.audit(id,"payment_updated");return null;});}
 public String seed(){
  if(!c.demo)throw new Failure(403,"Только в демо-режиме.");return db.tx(()->{
   String id="demo-example";if(db.get(id)!=null)return id;JsonNode car=c.cars.get(0);
   var person=obj("fullName","ДЕМО — Иван Примеров","birthDate","1990-01-01","phone","+70000000000","passportSeries","0000","passportNumber","000000","passportIssuedBy","Вымышленный орган — образец","passportIssuedDate","2010-01-01","passportCode","000-000","registrationAddress","Демонстрационный адрес","licenseNumber","0000000000","licenseIssuedDate","2020-01-01","licenseExpires","2035-01-01","drivingSince","2010-01-01");
   var terms=obj("price",car.path("price"),"mileagePerDay",c.company.path("mileagePerDay"),"extraKmPrice",c.company.path("extraKmPrice"),"car",car,"company",c.company);
   db.execute("INSERT INTO bookings(id,car,start,end,days,total,deposit,status,expires,created,pii,consent,terms) VALUES(?,?,?,?,?,?,?,'pending',?,?,?,?,?)",id,s(car,"id"),iso(Instant.now().plus(3,ChronoUnit.DAYS)),iso(Instant.now().plus(6,ChronoUnit.DAYS)),3,num(car,"price")*3,num(car,"deposit"),System.currentTimeMillis()+86400000,System.currentTimeMillis(),db.encrypt(person),str(obj("at",iso(Instant.now()),"version",c.company.path("consentVersion"),"text",Legal.consent(c.company),"demo",true)),str(terms));db.audit(id,"demo_created");return id;
  });
 }
}