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
 private final Config c;private final Database db;private final Bookings service;private final Transport transport;private volatile boolean stopped;private Thread thread;
 public Bot(Config c,Database db,Bookings service){this(c,db,service,null);}
 public Bot(Config c,Database db,Bookings service,Transport testTransport){
  this.c=c;this.db=db;this.service=service;HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  transport=testTransport!=null?testTransport:(method,payload)->{HttpRequest request=HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot"+c.botToken+"/"+method)).timeout(Duration.ofSeconds(40)).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofByteArray(bytes(payload))).build();HttpResponse<String> response=client.send(request,HttpResponse.BodyHandlers.ofString());JsonNode data=parse(response.body());if(response.statusCode()!=200||!data.path("ok").asBoolean())throw new IllegalStateException("Telegram API request failed");return data.get("result");};
 }
 private void send(String chat,String text,JsonNode keyboard)throws Exception{ObjectNode data=obj("chat_id",chat,"text",text,"protect_content",true,"link_preview_options",obj("is_disabled",true));if(keyboard!=null)data.set("reply_markup",keyboard);transport.post("sendMessage",data);}
 private JsonNode keyboard(String label,String url){return obj("inline_keyboard",List.of(List.of(obj("text",label,"url",url))));}
 public void handle(JsonNode update)throws Exception{
  JsonNode m=update.path("message");if(!m.path("chat").path("type").asText().equals("private")||m.path("from").path("is_bot").asBoolean())return;
  String chat=m.path("chat").path("id").asText(),text=s(m,"text");
  if(text.startsWith("/start ")){
   try{ObjectNode b=service.claim(text.split("\\s+")[1],chat);JsonNode car=c.car(s(b,"car"));send(chat,(c.demo?"ДЕМО. Реальные документы не принимаются.\n\n":"")+"Заявка "+s(b,"id").substring(0,8)+"\n"+s(car,"name")+"\n"+Documents.fmt(s(b,"start"))+" → "+Documents.fmt(s(b,"end"))+" (Калининград)\nАренда: "+num(b,"total")+" ₽, залог отдельно: "+num(b,"deposit")+" ₽.\n\nНе присылайте паспорт и права в чат. Заполните анкету на защищённом сайте. Ссылка действует до 30 минут. Бронь подтверждает владелец после проверки.",keyboard(c.demo?"Открыть демонстрационную форму":"Заполнить анкету",s(b,"formUrl")));}catch(Failure e){send(chat,e.getMessage(),null);}return;
  }
  if(text.equals("/status")){db.expire();List<ObjectNode> rows=db.rows("SELECT * FROM bookings WHERE chat_hash=? ORDER BY created DESC LIMIT 5",hash(chat));StringJoiner status=new StringJoiner("\n");for(JsonNode b:rows)status.add(s(b,"id").substring(0,8)+": "+Bookings.STATUSES.get(s(b,"status")));send(chat,rows.isEmpty()?"Связанных заявок нет. Начните с каталога.":status.toString(),null);return;}
  send(chat,"Аренда авто в Калининграде. Выберите автомобиль и даты на сайте.\n/status — статус заявки.\nПаспорт, права и фотографии документов в этот чат не отправляйте. Вопросы по данным: "+s(c.company,"email"),keyboard("Выбрать автомобиль",c.publicUrl));
 }
 public void start(){
  thread=Thread.ofVirtual().name("telegram-bot").start(()->{
   try{
    if(c.botToken.isBlank()||!c.publicUrl.startsWith("https://"))throw new IllegalStateException();
    JsonNode me=transport.post("getMe",obj());if(!s(me,"username").equalsIgnoreCase(c.botUsername))throw new IllegalStateException();
    if(!s(transport.post("getWebhookInfo",obj()),"url").isBlank())throw new IllegalStateException();
    System.out.println("Telegram-бот запущен: @"+c.botUsername);
   }catch(Exception e){System.err.println("Бот не запущен. Проверьте BOT_TOKEN, HTTPS PUBLIC_URL, username и отсутствие старого webhook/polling.");return;}
   while(!stopped){
    try{JsonNode row=db.one("SELECT value FROM meta WHERE key='telegram_offset'");long offset=row==null?0:Long.parseLong(s(row,"value"));JsonNode updates=transport.post("getUpdates",obj("offset",offset,"timeout",25,"allowed_updates",List.of("message")));
     for(JsonNode u:updates){if(stopped)break;handle(u);db.execute("INSERT INTO meta(key,value) VALUES('telegram_offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",String.valueOf(u.path("update_id").asLong()+1));}
    }catch(Exception e){if(stopped||Thread.currentThread().isInterrupted())return;System.err.println("Telegram временно недоступен; повтор через 5 секунд.");try{Thread.sleep(5000);}catch(InterruptedException ex){return;}}
   }
  });
 }
 public void notifyStatus(JsonNode b){if(s(b,"chat_enc").isBlank())return;Thread.ofVirtual().start(()->{try{send(db.decrypt(s(b,"chat_enc")).asText(),"Заявка "+s(b,"id").substring(0,8)+": "+Bookings.STATUSES.get(s(b,"status"))+". Подписание договора и выдача — после проверки оригиналов.",null);}catch(Exception e){try{db.audit(s(b,"id"),"telegram_notification_failed");}catch(Exception ignored){}}});}
 public void stop(){stopped=true;if(thread!=null)thread.interrupt();}
}