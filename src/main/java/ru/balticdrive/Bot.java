package ru.balticdrive;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import static ru.balticdrive.Json.*;
import static ru.balticdrive.Database.*;
public final class Bot {
 @FunctionalInterface public interface Transport {JsonNode post(String method,JsonNode payload)throws Exception;}
 private final Config c;private final Database db;private final Bookings service;private final Documents docs;private final Transport transport;private volatile boolean stopped;private Thread thread;
 private static final class TelegramError extends RuntimeException{final int code;TelegramError(int code){super("Telegram API error "+code);this.code=code;}}
 private static Transport connection(Config c){HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();return (method,payload)->{HttpRequest request=HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot"+c.botToken+"/"+method)).timeout(Duration.ofSeconds(40)).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofByteArray(bytes(payload))).build();HttpResponse<String> response=client.send(request,HttpResponse.BodyHandlers.ofString());JsonNode data=parse(response.body());if(response.statusCode()!=200||!data.path("ok").asBoolean())throw new TelegramError(data.path("error_code").asInt(response.statusCode()));return data.get("result");};}
 public Bot(Config c,Database db,Bookings service){this(c,db,service,new Documents(c,db),null);}
 public Bot(Config c,Database db,Bookings service,Documents docs){this(c,db,service,docs,null);}
 public Bot(Config c,Database db,Bookings service,Transport test){this(c,db,service,new Documents(c,db),test);}
 private Bot(Config c,Database db,Bookings service,Documents docs,Transport test){this.c=c;this.db=db;this.service=service;this.docs=docs;this.transport=test==null?connection(c):test;}
 public static JsonNode probe(Config c){try{if(c.botToken.isBlank())return obj("ok",false,"reason","BOT_TOKEN отсутствует");Transport t=connection(c);JsonNode me=t.post("getMe",obj()),hook=t.post("getWebhookInfo",obj());return obj("ok",true,"username",s(me,"username"),"usernameMatches",s(me,"username").equalsIgnoreCase(c.botUsername),"webhookConfigured",!s(hook,"url").isBlank(),"botEnabled",c.botEnabled,"siteUrl",c.botPublicUrl);}catch(TelegramError e){return obj("ok",false,"telegramCode",e.code);}catch(Exception e){return obj("ok",false,"reason","Нет соединения с Telegram");}}
 private void send(String chat,String text,JsonNode keyboard)throws Exception{ObjectNode payload=obj("chat_id",chat,"text",text,"protect_content",true,"link_preview_options",obj("is_disabled",true));if(keyboard!=null)payload.set("reply_markup",keyboard);transport.post("sendMessage",payload);}
 private JsonNode keyboard(String label,String url){return obj("inline_keyboard",List.of(List.of(obj("text",label,"url",url))));}
 private void demoReply(String chat,JsonNode b)throws Exception{
  try{docs.refresh(s(b,"id"));}catch(Exception e){db.audit(s(b,"id"),"file_generation_failed");}
  send(chat,"БАЛТИК ДРАЙВ · УЧЕБНАЯ ЗАЯВКА\n\n№ "+s(b,"id").substring(0,8)+"\n"+s(c.car(s(b,"car")),"name")+"\n"+Documents.fmt(s(b,"start"))+" → "+Documents.fmt(s(b,"end"))+" (Калининград, UTC+2)\n"+num(b,"days")+" сут. · аренда "+num(b,"total")+" ₽\nЗалог отдельно: "+num(b,"deposit")+" ₽\n\nВыбор передан боту. Это демонстрация: реальная бронь не создаётся, документы и оплата не запрашиваются. Для примера договора используются только вымышленные данные.\n/status — проверить статус.\nНе присылайте паспорт и права в чат.",keyboard("Вернуться к автомобилям",c.botPublicUrl));
 }
 public void handle(JsonNode update)throws Exception{
  JsonNode m=update.path("message");if(!m.path("chat").path("type").asText().equals("private")||m.path("from").path("is_bot").asBoolean())return;
  String chat=m.path("chat").path("id").asText(),text=s(m,"text").strip();
  if(text.startsWith("/start ")){
   String[] parts=text.split("\\s+");if(parts.length!=2){send(chat,"Ссылка не распознана. Выберите автомобиль на сайте.",keyboard("Открыть каталог",c.botPublicUrl));return;}
   try{
    if(parts[1].startsWith("d1-")){if(!c.demo)throw new Failure(400,"Учебная ссылка не подходит для рабочего режима. Начните бронирование на рабочем сайте.");demoReply(chat,service.acceptDemoLink(parts[1],chat));return;}
    ObjectNode b=service.claim(parts[1],chat);
    if(c.demo){demoReply(chat,service.completeDemo(s(b,"id")));return;}
    send(chat,"Заявка "+s(b,"id").substring(0,8)+"\n"+s(c.car(s(b,"car")),"name")+"\n"+Documents.fmt(s(b,"start"))+" → "+Documents.fmt(s(b,"end"))+" (Калининград)\nАренда: "+num(b,"total")+" ₽, залог отдельно: "+num(b,"deposit")+" ₽.\n\nНе присылайте паспорт и права в чат. Заполните анкету на защищённом сайте. Ссылка действует до 30 минут. Выдачу подтверждает владелец после проверки.",keyboard("Заполнить анкету",s(b,"formUrl")));
   }catch(Failure e){send(chat,e.getMessage(),keyboard("Выбрать автомобиль",c.botPublicUrl));}return;
  }
  if(text.equals("/status")){db.expire();List<ObjectNode> rows=db.rows("SELECT * FROM bookings WHERE chat_hash=? ORDER BY created DESC LIMIT 5",hash(chat));StringJoiner status=new StringJoiner("\n");for(JsonNode b:rows)status.add(s(b,"id").substring(0,8)+": "+Bookings.STATUSES.get(s(b,"status")));send(chat,rows.isEmpty()?"Связанных заявок нет. Выберите автомобиль на сайте.":(c.demo?"УЧЕБНЫЕ ЗАЯВКИ\n":"")+status.toString(),keyboard("Открыть каталог",c.botPublicUrl));return;}
  send(chat,(c.demo?"БАЛТИК ДРАЙВ · ДЕМОНСТРАЦИЯ\n\n":"БАЛТИК ДРАЙВ\n\n")+"Выберите автомобиль и даты на сайте, затем откройте ссылку Telegram из карточки и нажмите «Старт».\n/status — последние статусы.\n\n"+(c.demo?"Здесь не принимаются настоящие документы и оплата. Это учебный проект.\n":"")+"Паспорт, права и фотографии документов в этот чат не отправляйте.",keyboard("Выбрать автомобиль",c.botPublicUrl));
 }
 public void start(){thread=Thread.ofVirtual().name("telegram-bot").start(()->{
  try{if(c.botToken.isBlank()||!c.botPublicUrl.startsWith("https://"))throw new IllegalStateException();JsonNode me=transport.post("getMe",obj());if(!s(me,"username").equalsIgnoreCase(c.botUsername)||!s(transport.post("getWebhookInfo",obj()),"url").isBlank())throw new IllegalStateException();System.out.println("Telegram-бот запущен: @"+c.botUsername);}catch(Exception e){System.err.println("Бот не запущен. Выполните check-bot.cmd: проверьте токен, BOT_PUBLIC_URL и отсутствие webhook.");return;}
  while(!stopped){try{JsonNode row=db.one("SELECT value FROM meta WHERE key='telegram_offset'");long offset=row==null?0:Long.parseLong(s(row,"value"));JsonNode updates=transport.post("getUpdates",obj("offset",offset,"timeout",25,"allowed_updates",List.of("message")));for(JsonNode u:updates){if(stopped)break;handle(u);db.execute("INSERT INTO meta(key,value) VALUES('telegram_offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String.valueOf(u.path("update_id").asLong()+1));}}
   catch(Exception e){if(stopped||Thread.currentThread().isInterrupted())return;if(e instanceof TelegramError t&&(t.code==409||t.code==401)){System.err.println(t.code==409?"Бот остановлен: уже запущен другой polling-процесс. Оставьте один экземпляр.":"Бот остановлен: Telegram отклонил токен.");return;}System.err.println("Telegram временно недоступен; повтор через 5 секунд.");try{Thread.sleep(5000);}catch(InterruptedException ex){return;}}
  }
 });}
 public void notifyStatus(JsonNode b){if(s(b,"chat_enc").isBlank())return;Thread.ofVirtual().start(()->{try{send(db.decrypt(s(b,"chat_enc")).asText(),(c.demo?"Учебная заявка ":"Заявка ")+s(b,"id").substring(0,8)+": "+Bookings.STATUSES.get(s(b,"status"))+(c.demo?". Это демонстрация.":". Подписание договора и выдача — после проверки оригиналов."),null);}catch(Exception e){try{db.audit(s(b,"id"),"telegram_notification_failed");}catch(Exception ignored){}}});}
 public void stop(){stopped=true;if(thread!=null)thread.interrupt();}
}
