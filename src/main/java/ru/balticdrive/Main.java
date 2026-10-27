package ru.balticdrive;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import static ru.balticdrive.Json.*;
public final class Main {
 public static void setup(Path base)throws Exception{
  Path env=base.resolve(".env");if(Files.exists(env))return;String text=Files.readString(base.resolve(".env.example"));byte[] key=new byte[32],admin=new byte[32];new SecureRandom().nextBytes(key);new SecureRandom().nextBytes(admin);text=text.replace("ADMIN_TOKEN=","ADMIN_TOKEN="+HexFormat.of().formatHex(admin)).replace("DATA_KEY=","DATA_KEY="+HexFormat.of().formatHex(key));Files.writeString(env,text,StandardCharsets.UTF_8,StandardOpenOption.CREATE_NEW);Permissions.file(env);System.out.println("Создан локальный .env. Пароль кабинета — ADMIN_TOKEN в этом файле.");
 }
 public static void main(String[] args)throws Exception{
  System.setOut(new java.io.PrintStream(System.out,true,StandardCharsets.UTF_8));System.setErr(new java.io.PrintStream(System.err,true,StandardCharsets.UTF_8));
  System.setProperty("sun.net.httpserver.maxReqTime","20");System.setProperty("sun.net.httpserver.maxRspTime","30");System.setProperty("jdk.httpserver.maxConnections","128");
  Path base=Path.of("").toAbsolutePath();setup(base);Config c=new Config(base,Map.of(),true);
  if(Arrays.asList(args).contains("--export")||Arrays.asList(args).contains("--seed-demo")){
   try(Database db=new Database(c)){Bookings service=new Bookings(c,db);Documents docs=new Documents(c,db);if(Arrays.asList(args).contains("--seed-demo"))service.seed();docs.purge();for(var b:db.rows("SELECT id FROM bookings WHERE pii IS NOT NULL"))docs.contract(s(b,"id"));docs.report();System.out.println("Документы и Excel сохранены: "+c.filesDir);}return;
  }
  Web web=new Web(c);try{web.docs.purge();web.docs.report();}catch(Exception e){System.err.println("Не удалось обновить файлы. Закройте Excel и повторите экспорт.");}
  web.start();System.out.println("Балтик Драйв / Java: http://"+c.host+":"+web.port()+" · "+(c.demo?"демонстрация":"рабочий режим"));
  if(c.botEnabled)web.bot.start();
  ScheduledExecutorService scheduler=Executors.newSingleThreadScheduledExecutor();scheduler.scheduleAtFixedRate(()->{try{web.docs.purge();web.docs.report();}catch(Exception e){System.err.println("Не удалось обновить документы.");}},1,1,TimeUnit.HOURS);
  Runtime.getRuntime().addShutdownHook(new Thread(()->{scheduler.shutdownNow();try{web.close();}catch(Exception ignored){}}));
 }
}