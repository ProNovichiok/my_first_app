package ru.balticdrive;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import static ru.balticdrive.Json.*;
public final class Web implements AutoCloseable {
 public final Config config;public final Database db;public final Bookings service;public final Documents docs;public final Bot bot;
 private final HttpServer server;private final ExecutorService executor=Executors.newVirtualThreadPerTaskExecutor();
 private final Limits limits=new Limits();
 public Web(Config c)throws Exception{config=c;db=new Database(c);service=new Bookings(c,db);docs=new Documents(c,db);bot=new Bot(c,db,service);server=HttpServer.create(new InetSocketAddress(c.host,c.port),128);server.setExecutor(executor);server.createContext("/",this::handle);}
 public void start(){server.start();}
 public int port(){return server.getAddress().getPort();}
 private String header(HttpExchange x,String name){return Optional.ofNullable(x.getRequestHeaders().getFirst(name)).orElse("");}
 private String bearer(HttpExchange x){String h=header(x,"Authorization");return h.startsWith("Bearer ")?h.substring(7):"";}
 private String ip(HttpExchange x){String ip=x.getRemoteAddress().getAddress().getHostAddress();if(config.trustProxy){String h=header(x,"X-Forwarded-For");if(!h.isBlank()){String[] parts=h.split(",");ip=parts[parts.length-1].strip();}}return ip.length()>128?ip.substring(0,128):ip;}
 private JsonNode body(HttpExchange x)throws IOException{byte[] b=x.getRequestBody().readNBytes(20481);if(b.length>20480)throw new Failure(413,"Слишком большой запрос.");return parse(new String(b,StandardCharsets.UTF_8));}
 private void security(HttpExchange x){
  Headers h=x.getResponseHeaders();h.set("X-Content-Type-Options","nosniff");h.set("X-Frame-Options","DENY");h.set("Referrer-Policy","no-referrer");h.set("Cross-Origin-Resource-Policy","same-origin");h.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  h.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"+(config.publicUrl.startsWith("https://")?"; upgrade-insecure-requests":""));
  if(config.publicUrl.startsWith("https://"))h.set("Strict-Transport-Security","max-age=31536000");
 }
 private void json(HttpExchange x,int status,Object data)throws IOException{send(x,status,"application/json; charset=utf-8",bytes(data));}
 private void html(HttpExchange x,String page)throws IOException{send(x,200,"text/html; charset=utf-8",page.getBytes(StandardCharsets.UTF_8));}
 private void send(HttpExchange x,int status,String type,byte[] bytes)throws IOException{x.getResponseHeaders().set("Content-Type",type);if(x.getRequestMethod().equals("HEAD")){x.sendResponseHeaders(status,-1);return;}x.sendResponseHeaders(status,bytes.length);x.getResponseBody().write(bytes);}
 private void download(HttpExchange x,Path file,String name)throws IOException{x.getResponseHeaders().set("Content-Disposition","attachment; filename=\""+name+"\"");send(x,200,name.endsWith(".xlsx")?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"text/html; charset=utf-8",Files.readAllBytes(file));}
 private void auth(HttpExchange x){if(!MessageDigest.isEqual(bearer(x).getBytes(StandardCharsets.UTF_8),config.adminToken.getBytes(StandardCharsets.UTF_8))){limits.check("auth:"+ip(x),20,900000);throw new Failure(401,"Неверный ключ владельца.");}}
 private void handle(HttpExchange x){
  try{
   security(x);String p=x.getRequestURI().getPath(),method=x.getRequestMethod();
   if(p.startsWith("/api/")){
    x.getResponseHeaders().set("Cache-Control","no-store");limits.check("api:"+ip(x),100,60000);
    if(!List.of("GET","HEAD","OPTIONS").contains(method)&&!header(x,"Origin").isBlank()&&!header(x,"Origin").equals(config.publicUrl))throw new Failure(403,"Недопустимый источник запроса.");
    if(p.startsWith("/api/admin/"))auth(x);
   }
   if(method.equals("GET")&&p.equals("/api/catalog")){
    ArrayNode cars=M.createArrayNode();for(JsonNode c:config.cars){ObjectNode out=c.deepCopy();out.remove(List.of("vin","plate","sts","insurance"));cars.add(out);}ObjectNode company=M.createObjectNode();for(String key:List.of("minAge","minExperienceYears","mileagePerDay","extraKmPrice","pickupAddress","phone","email"))company.set(key,config.company.get(key));json(x,200,obj("demo",config.demo,"brand",config.company.path("brand"),"cars",cars,"company",company,"consentVersion",config.company.path("consentVersion")));return;
   }
   if(method.equals("POST")&&p.equals("/api/bookings")){limits.check("booking:"+ip(x),8,1800000);json(x,201,service.create(body(x)));return;}
   if(method.equals("GET")&&p.equals("/api/form")){ObjectNode b=Bookings.view(service.form(bearer(x)));b.put("demo",config.demo);b.put("consent",Legal.consent(config.company));b.put("consentVersion",s(config.company,"consentVersion"));json(x,200,b);return;}
   if(method.equals("POST")&&p.equals("/api/form")){limits.check("booking:"+ip(x),8,1800000);ObjectNode b=service.submit(bearer(x),body(x));b.put("filesReady",refresh(s(b,"id")));json(x,201,b);return;}
   if(method.equals("GET")&&p.equals("/privacy")){html(x,Legal.page("Политика обработки данных",Legal.privacy(config.company),config.demo));return;}
   if(method.equals("GET")&&p.equals("/consent")){html(x,Legal.page("Отдельное согласие",Legal.consent(config.company),config.demo));return;}
   if(method.equals("GET")&&p.equals("/api/admin/bookings")){
    db.expire();List<ObjectNode> rows=db.rows("SELECT * FROM bookings ORDER BY created DESC LIMIT 1000");List<ObjectNode> bookings=new ArrayList<>();for(JsonNode b:rows){ObjectNode out=Bookings.view(b);JsonNode person=db.decrypt(s(b,"pii"));out.put("created",num(b,"created"));out.put("paid",num(b,"paid"));out.set("client",person.path("fullName").isMissingNode()?M.nullNode():person.path("fullName"));out.set("phone",person.path("phone").isMissingNode()?M.nullNode():person.path("phone"));out.put("hasPerson",!s(b,"pii").isBlank());bookings.add(out);}
    json(x,200,obj("demo",config.demo,"statuses",Bookings.STATUSES,"bookings",bookings,"filesDir",config.filesDir.toString()));return;
   }
   if(method.equals("GET")&&p.equals("/api/admin/report")){download(x,docs.report(),"clients.xlsx");return;}
   if(method.equals("GET")&&p.equals("/api/admin/audit")){json(x,200,db.rows("SELECT * FROM audit ORDER BY at DESC LIMIT 500"));return;}
   if(method.equals("POST")&&p.equals("/api/admin/demo")){String id=service.seed();docs.refresh(id);json(x,200,obj("ok",true,"id",id));return;}
   String[] parts=p.split("/");
   if(parts.length==6&&p.startsWith("/api/admin/bookings/")){
    String id=parts[4],action=parts[5];
    if(method.equals("POST")&&action.equals("status")){ObjectNode b=service.status(id,s(body(x),"status"));b.put("filesReady",refresh(id));if(config.botEnabled)bot.notifyStatus(db.get(id));json(x,200,b);return;}
    if(method.equals("POST")&&action.equals("payment")){service.payment(id,body(x));boolean ready=refresh(null);json(x,200,obj("ok",true,"filesReady",ready));return;}
    if(method.equals("GET")&&action.equals("contract")){download(x,docs.contract(id),id+".html");return;}
    if(method.equals("DELETE")&&action.equals("person")){docs.erase(id);json(x,200,obj("ok",true));return;}
   }
   if(!List.of("GET","HEAD").contains(method))throw new Failure(405,"Метод не поддерживается.");
   if(p.startsWith("/api")||p.contains("..")||p.contains("\\")||Arrays.stream(p.split("/")).anyMatch(s->s.startsWith(".")))throw new Failure(404,"Страница не найдена.");
   if(p.equals("/"))p="/index.html";try(InputStream in=Web.class.getResourceAsStream("/public"+p)){if(in==null)throw new Failure(404,"Страница не найдена.");String type=p.endsWith(".html")?"text/html; charset=utf-8":p.endsWith(".js")?"text/javascript; charset=utf-8":p.endsWith(".css")?"text/css; charset=utf-8":p.endsWith(".svg")?"image/svg+xml":"application/octet-stream";send(x,200,type,in.readAllBytes());}
  }catch(Failure e){try{json(x,e.status,obj("error",e.getMessage()));}catch(IOException ignored){}}
   catch(Exception e){System.err.println("Ошибка сервера; подробности скрыты для защиты данных.");try{json(x,500,obj("error","Внутренняя ошибка. Повторите позже."));}catch(IOException ignored){}}
  finally{x.close();}
 }
 private boolean refresh(String id){try{docs.refresh(id);return true;}catch(Exception e){db.audit(id,"file_generation_failed");return false;}}
 public void close()throws Exception{bot.stop();server.stop(1);executor.shutdownNow();executor.awaitTermination(5,TimeUnit.SECONDS);db.close();}
 private static final class Limits {
  private record Window(long at,int count){}
  private final Map<String,Window> windows=new HashMap<>();
  synchronized void check(String key,int max,long duration){long now=System.currentTimeMillis();Window old=windows.get(key);if(old==null||now-old.at>=duration)old=new Window(now,0);if(old.count>=max)throw new Failure(429,"Слишком много запросов. Попробуйте позже.");if(windows.size()>10000)windows.entrySet().removeIf(e->now-e.getValue().at>1800000);if(windows.size()>10000)throw new Failure(503,"Сервис занят. Повторите позже.");windows.put(key,new Window(old.at,old.count+1));}
 }
}