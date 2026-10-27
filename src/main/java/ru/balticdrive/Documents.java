package ru.balticdrive;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.io.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import static ru.balticdrive.Json.*;
public final class Documents {
 private final Config c;private final Database db;
 public Documents(Config c,Database db){this.c=c;this.db=db;}
 public static String fmt(String date){return DateTimeFormatter.ofPattern("dd.MM.uuuu, HH:mm",Locale.forLanguageTag("ru")).withZone(Bookings.ZONE).format(Instant.parse(date));}
 public static String fmt(long millis){return fmt(Bookings.iso(Instant.ofEpochMilli(millis)));}
 private void save(Path file,byte[] content)throws IOException{Files.createDirectories(file.getParent());Permissions.directory(c.filesDir);Permissions.directory(file.getParent());Path tmp=file.resolveSibling(file.getFileName()+".tmp");Files.write(tmp,content);Permissions.file(tmp);try{Files.move(tmp,file,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException e){Files.move(tmp,file,StandardCopyOption.REPLACE_EXISTING);}}
 private void save(Path p,String s)throws IOException{save(p,s.getBytes(StandardCharsets.UTF_8));}
 public synchronized Path contract(String id)throws Exception{
  ObjectNode b=db.get(id);if(b==null)throw new Failure(404,"Заявка не найдена.");if(s(b,"pii").isBlank())throw new Failure(409,"Анкета отсутствует.");
  JsonNode p=db.decrypt(s(b,"pii")),terms=parse(s(b,"terms")),company=terms.has("company")?terms.get("company"):c.company,car=terms.has("car")?terms.get("car"):c.car(s(b,"car"));
  Map<String,String> values=new HashMap<>();b.properties().forEach(e->values.put(e.getKey(),e.getValue().asText()));
  for(var entry:Map.of("person",p,"company",company,"car",car).entrySet())entry.getValue().properties().forEach(e->values.put(entry.getKey()+"."+e.getKey(),e.getValue().asText()));
  for(String k:List.of("vin","plate","sts","insurance"))if(values.getOrDefault("car."+k,"").isBlank())values.put("car."+k,"ЗАПОЛНИТЬ И ПРОВЕРИТЬ");
  for(String k:List.of("price","mileagePerDay","extraKmPrice"))values.put(k,s(terms,k));
  values.put("start",fmt(s(b,"start")));values.put("end",fmt(s(b,"end")));values.put("demo",c.demo?"ДЕМОНСТРАЦИОННЫЙ ОБРАЗЕЦ · ":"");
  String template=Legal.resource("/templates/contract-copy.html");values.put("copy","1");String first=Legal.template(template,values,true);values.put("copy","2");String second=Legal.template(template,values,true);
  String html="""
<!doctype html><html lang="ru"><meta charset="utf-8"><title>Договор — два экземпляра</title><style>
@page{size:A4;margin:16mm}body{font:11pt Georgia,serif;color:#111;max-width:180mm;margin:auto;line-height:1.4}h1{font-size:17pt}h2{font-size:12pt;margin-bottom:4px}header{font:10pt Arial;border-bottom:1px solid;padding:12px 0}header span{float:right}.draft{border:1px solid;padding:8px;font:bold 10pt Arial}.copy+.copy{break-before:page}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:8px;text-align:left}tr{break-inside:avoid}.toolbar{padding:20px;background:#eee;font:12px Arial}@media print{.toolbar{display:none}}</style>
<div class="toolbar">Два экземпляра + акты. Для печати: Ctrl+P → Сохранить как PDF или принтер. Проект требует проверки.</div>
"""+first+second+"</html>";
  Path file=c.filesDir.resolve("contracts").resolve(id+".html");save(file,html);
  ObjectNode consent=(ObjectNode)parse(s(b,"consent"));consent.put("booking",id);save(c.filesDir.resolve("consents").resolve(id+".json"),M.writerWithDefaultPrettyPrinter().writeValueAsString(consent));return file;
 }
 private void row(Sheet s,Object... values){Row row=s.createRow(s.getLastRowNum()==0&&s.getPhysicalNumberOfRows()==0?0:s.getLastRowNum()+1);for(int i=0;i<values.length;i++){Cell cell=row.createCell(i);if(values[i] instanceof Number n)cell.setCellValue(n.doubleValue());else cell.setCellValue(String.valueOf(values[i]==null?"":values[i]));}}
 private void header(Workbook w,Sheet s,int columns){Row r=s.getRow(0);CellStyle style=w.createCellStyle();style.setFillForegroundColor(IndexedColors.DARK_TEAL.getIndex());style.setFillPattern(FillPatternType.SOLID_FOREGROUND);Font font=w.createFont();font.setBold(true);font.setColor(IndexedColors.WHITE.getIndex());style.setFont(font);r.setHeightInPoints(25);for(Cell cell:r)cell.setCellStyle(style);s.createFreezePane(0,1);s.setAutoFilter(new CellRangeAddress(0,Math.max(0,s.getLastRowNum()),0,columns-1));}
 public synchronized Path report()throws Exception{
  db.expire();List<ObjectNode> bookings=db.rows("SELECT * FROM bookings ORDER BY created DESC");
  try(XSSFWorkbook book=new XSSFWorkbook()){
   book.getProperties().getCoreProperties().setCreator("Балтик Драйв / Java");
   Sheet sheet=book.createSheet("Заявки");row(sheet,"Номер","Создана","Клиент","Телефон","Автомобиль","Выдача UTC+2","Возврат UTC+2","Суток","Аренда ₽","Залог ₽","Получено аренды ₽","Статус");
   Set<String> clients=new HashSet<>();long paid=0;Map<String,long[]> months=new TreeMap<>();
   for(JsonNode b:bookings){JsonNode p=db.decrypt(s(b,"pii"));if(!s(p,"phone").isBlank())clients.add(s(p,"phone"));paid+=num(b,"paid");String month=Instant.parse(s(b,"start")).atZone(Bookings.ZONE).toLocalDate().toString().substring(0,7);long[] stats=months.computeIfAbsent(month,k->new long[3]);stats[0]++;if(List.of("confirmed","active","completed").contains(s(b,"status")))stats[1]++;stats[2]+=num(b,"paid");
    row(sheet,s(b,"id"),fmt(num(b,"created")),s(p,"fullName").isBlank()?"Анкета не заполнена":s(p,"fullName"),s(p,"phone"),s(c.car(s(b,"car")),"name"),fmt(s(b,"start")),fmt(s(b,"end")),num(b,"days"),num(b,"total"),num(b,"deposit"),num(b,"paid"),Bookings.STATUSES.get(s(b,"status")));
   }
   int[] widths={38,23,32,21,26,23,23,10,16,16,24,24};for(int i=0;i<widths.length;i++)sheet.setColumnWidth(i,widths[i]*256);header(book,sheet,12);
   CellStyle currency=book.createCellStyle();currency.setDataFormat(book.createDataFormat().getFormat("#,##0 \"₽\""));for(int r=1;r<=sheet.getLastRowNum();r++)for(int col=8;col<=10;col++)sheet.getRow(r).getCell(col).setCellStyle(currency);
   Sheet summary=book.createSheet("Статистика");row(summary,"Показатель","Значение");row(summary,"Все заявки",bookings.size());row(summary,"Уникальные клиенты по телефону",clients.size());row(summary,"Получено за аренду, ₽",paid);row(summary,"Залог не входит в выручку","Да");row(summary,"Сформирован UTC+2",fmt(System.currentTimeMillis()));for(var e:Bookings.STATUSES.entrySet())row(summary,e.getValue(),bookings.stream().filter(b->s(b,"status").equals(e.getKey())).count());summary.setColumnWidth(0,44*256);summary.setColumnWidth(1,27*256);header(book,summary,2);
   Sheet monthly=book.createSheet("По месяцам");row(monthly,"Месяц выдачи UTC+2","Заявок","Подтверждено / выдано / завершено","Получено аренды ₽");months.forEach((m,v)->row(monthly,m,v[0],v[1],v[2]));for(int i=0;i<4;i++)monthly.setColumnWidth(i,(i==2?40:25)*256);header(book,monthly,4);
   Path file=c.filesDir.resolve("reports/clients.xlsx");try(var buffer=new ByteArrayOutputStream()){book.write(buffer);save(file,buffer.toByteArray());}return file;
  }
 }
 public synchronized void refresh(String id)throws Exception{if(id!=null&&!s(db.get(id),"pii").isBlank())contract(id);report();}
 public synchronized void erase(String id)throws Exception{JsonNode b=db.get(id);if(b==null)throw new Failure(404,"Заявка не найдена.");if(!List.of("cancelled","expired").contains(s(b,"status")))throw new Failure(409,"Удаление доступно для отменённой или истёкшей заявки. По договору нужно оценить основания хранения.");Files.deleteIfExists(c.filesDir.resolve("contracts").resolve(id+".html"));Files.deleteIfExists(c.filesDir.resolve("consents").resolve(id+".json"));db.execute("UPDATE bookings SET pii=NULL,consent=NULL,chat_enc=NULL,chat_hash=NULL,claim_hash=NULL,form_hash=NULL WHERE id=?",id);db.audit(id,"personal_data_deleted");report();}
 public synchronized void purge()throws Exception{db.expire();long cutoff=System.currentTimeMillis()-num(c.company,"applicationRetentionDays")*86400000;for(JsonNode b:db.rows("SELECT id FROM bookings WHERE status IN ('expired','cancelled') AND COALESCE(closed,created) < ? AND (pii IS NOT NULL OR chat_enc IS NOT NULL)",cutoff))erase(s(b,"id"));}
}