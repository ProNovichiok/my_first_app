package ru.balticdrive;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
public final class Json {
 public static final ObjectMapper M=new ObjectMapper();
 public static JsonNode parse(String s){try{return M.readTree(s);}catch(Exception e){throw new Failure(400,"Некорректный JSON.");}}
 public static ObjectNode obj(Object... pairs){ObjectNode n=M.createObjectNode();for(int i=0;i<pairs.length;i+=2)n.set(pairs[i].toString(),M.valueToTree(pairs[i+1]));return n;}
 public static String str(Object value){try{return M.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("Ошибка JSON");}}
 public static byte[] bytes(Object value){return str(value).getBytes(StandardCharsets.UTF_8);}
 public static String s(JsonNode n,String field){return n.path(field).asText("");}
 public static long num(JsonNode n,String field){return n.path(field).asLong();}
 public static class Failure extends RuntimeException {public final int status;public Failure(int s,String m){super(m);status=s;}}
}