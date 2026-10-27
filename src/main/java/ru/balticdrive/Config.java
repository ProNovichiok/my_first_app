package ru.balticdrive;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static ru.balticdrive.Json.*;
public final class Config {
 public final JsonNode company,cars; public final String publicUrl,adminToken,key,botToken,botUsername,host; public final int port;public final boolean demo,legalReady,botEnabled,trustProxy;public final Path dataDir,filesDir;
 public Config(Path base,Map<String,String> overrides,boolean checkProduction)throws Exception{
  Map<String,String> env=new HashMap<>();Path file=base.resolve(".env");
  if(Files.exists(file))for(String line:Files.readAllLines(file,StandardCharsets.UTF_8)){line=line.strip();if(line.isEmpty()||line.startsWith("#")||!line.contains("="))continue;int at=line.indexOf('=');env.put(line.substring(0,at).strip(),line.substring(at+1).strip());}
  env.putAll(System.getenv());env.putAll(overrides);
  company=parse(Files.readString(base.resolve("config/company.json")));cars=parse(Files.readString(base.resolve("config/cars.json")));
  publicUrl=env.getOrDefault("PUBLIC_URL","http://localhost:3000").replaceAll("/$","");adminToken=env.getOrDefault("ADMIN_TOKEN","");key=env.getOrDefault("DATA_KEY","");botToken=env.getOrDefault("BOT_TOKEN","");botUsername=env.getOrDefault("BOT_USERNAME","CarArendaKLNGBot");host=env.getOrDefault("HOST","127.0.0.1");port=Integer.parseInt(env.getOrDefault("PORT","3000"));demo=!"false".equals(env.get("DEMO_MODE"));legalReady="true".equals(env.get("LEGAL_READY"));botEnabled="true".equals(env.get("BOT_ENABLED"));trustProxy="1".equals(env.get("TRUST_PROXY"));dataDir=base.resolve(env.getOrDefault("DATA_DIR","data")).normalize().toAbsolutePath();filesDir=base.resolve(env.getOrDefault("FILES_DIR","private")).normalize().toAbsolutePath();
  if(!key.matches("(?i)[a-f0-9]{64}")||adminToken.length()<32)throw new IllegalStateException("Нужны DATA_KEY (64 hex) и ADMIN_TOKEN (минимум 32 символа). Запустите start.cmd.");
  if(checkProduction&&!demo){
   boolean invalid=!legalReady||!publicUrl.startsWith("https://")||s(company,"inn").isBlank()||s(company,"legalName").contains("ДЕМО")||s(company,"email").endsWith(".invalid");
   for(JsonNode c:cars)invalid|=c.path("demo").asBoolean(true)||s(c,"vin").isBlank()||s(c,"plate").isBlank()||s(c,"sts").isBlank()||s(c,"insurance").isBlank();
   if(invalid)throw new IllegalStateException("Рабочий режим заблокирован: заполните реквизиты, автопарк, HTTPS и LEGAL_READY. См. docs/LAUNCH.md.");
  }
 }
 public JsonNode car(String id){for(JsonNode c:cars)if(s(c,"id").equals(id))return c;throw new Failure(404,"Автомобиль не найден.");}
}