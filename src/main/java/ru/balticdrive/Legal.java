package ru.balticdrive;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static ru.balticdrive.Json.*;
public final class Legal {
 public static String resource(String path){try(var in=Legal.class.getResourceAsStream(path)){if(in==null)throw new IllegalStateException("Нет ресурса "+path);return new String(in.readAllBytes(),StandardCharsets.UTF_8);}catch(Exception e){throw new IllegalStateException("Не удалось прочитать шаблон",e);}}
 public static String esc(Object value){return String.valueOf(value==null?"":value).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
 public static String template(String source,Map<String,String> values,boolean escape){var matcher=java.util.regex.Pattern.compile("\\{\\{([a-zA-Z0-9_.]+)}}").matcher(source);StringBuilder out=new StringBuilder();while(matcher.find()){String value=values.getOrDefault(matcher.group(1),"");matcher.appendReplacement(out,java.util.regex.Matcher.quoteReplacement(escape?esc(value):value));}matcher.appendTail(out);return out.toString();}
 private static String document(String name,JsonNode company){var values=new HashMap<String,String>();company.properties().forEach(e->values.put(e.getKey(),e.getValue().asText()));if(values.getOrDefault("inn","").isBlank())values.put("inn","не указан");return template(resource("/templates/"+name+".txt"),values,false);}
 public static String consent(JsonNode c){return document("consent",c);}
 public static String privacy(JsonNode c){return document("privacy",c);}
 public static String page(String title,String text,boolean demo){return "<!doctype html><html lang=\"ru\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>"+esc(title)+"</title><link rel=\"stylesheet\" href=\"/style.css\"><body><main class=\"legal\"><a href=\"/\">← На главную</a><h1>"+esc(title)+"</h1>"+(demo?"<p class=\"notice\">Демонстрационный документ. Оператор не указан. Реальные данные не принимаются.</p>":"")+"<p>"+esc(text)+"</p></main></body></html>";}
}