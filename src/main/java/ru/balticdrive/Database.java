package ru.balticdrive;
import com.fasterxml.jackson.databind.node.ObjectNode;
import javax.crypto.*;
import javax.crypto.spec.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.Callable;
import static ru.balticdrive.Json.*;
public final class Database implements AutoCloseable {
 private final Connection connection;private final byte[] key;
 public Database(Config c)throws Exception{
  Files.createDirectories(c.dataDir);Permissions.directory(c.dataDir);connection=DriverManager.getConnection("jdbc:sqlite:"+c.dataDir.resolve("rental.sqlite"));Permissions.file(c.dataDir.resolve("rental.sqlite"));key=HexFormat.of().parseHex(c.key);
  execute("PRAGMA journal_mode=WAL");execute("PRAGMA busy_timeout=5000");execute("PRAGMA foreign_keys=ON");
  execute("CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,car TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,days INTEGER NOT NULL,total INTEGER NOT NULL,deposit INTEGER NOT NULL,status TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL,claim_hash TEXT UNIQUE,chat_hash TEXT,chat_enc TEXT,form_hash TEXT UNIQUE,form_expires INTEGER,pii TEXT,consent TEXT,terms TEXT NOT NULL,closed INTEGER,paid INTEGER NOT NULL DEFAULT 0)");
  execute("CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,booking TEXT,event TEXT NOT NULL)");
  execute("CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
  if(rows("PRAGMA table_info(bookings)").stream().noneMatch(x->s(x,"name").equals("closed")))execute("ALTER TABLE bookings ADD COLUMN closed INTEGER");
 }
 public synchronized int execute(String sql,Object... args){try(PreparedStatement p=connection.prepareStatement(sql)){bind(p,args);return p.execute()?0:p.getUpdateCount();}catch(SQLException e){throw new IllegalStateException("Ошибка базы данных",e);}}
 public synchronized List<ObjectNode> rows(String sql,Object...args){try(PreparedStatement p=connection.prepareStatement(sql)){bind(p,args);try(ResultSet r=p.executeQuery()){var out=new ArrayList<ObjectNode>();var m=r.getMetaData();while(r.next()){ObjectNode n=M.createObjectNode();for(int i=1;i<=m.getColumnCount();i++)n.set(m.getColumnLabel(i),M.valueToTree(r.getObject(i)));out.add(n);}return out;}}catch(SQLException e){throw new IllegalStateException("Ошибка базы данных",e);}}
 private void bind(PreparedStatement p,Object[] args)throws SQLException{for(int i=0;i<args.length;i++)p.setObject(i+1,args[i]);}
 public synchronized ObjectNode one(String sql,Object...args){var rows=rows(sql,args);return rows.isEmpty()?null:rows.getFirst();}
 public ObjectNode get(String id){return one("SELECT * FROM bookings WHERE id=?",id);}
 public synchronized <T>T tx(Callable<T> fn){execute("BEGIN IMMEDIATE");try{T out=fn.call();execute("COMMIT");return out;}catch(Exception e){execute("ROLLBACK");if(e instanceof RuntimeException r)throw r;throw new IllegalStateException(e);}}
 public void audit(String id,String event){execute("INSERT INTO audit(at,booking,event) VALUES(?,?,?)",System.currentTimeMillis(),id,event);}
 public void expire(){execute("UPDATE bookings SET status='expired',closed=expires,claim_hash=NULL,form_hash=NULL WHERE status IN ('hold','pending') AND expires < ?",System.currentTimeMillis());}
 public boolean overlaps(String car,String start,String end,String except){expire();return one("SELECT id FROM bookings WHERE car=? AND start < ? AND end > ? AND id != ? AND status IN ('hold','pending','confirmed','active') LIMIT 1",car,end,start,except)!=null;}
 public static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 public static String token(){byte[] b=new byte[24];new SecureRandom().nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
 public String encrypt(Object value){try{byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));byte[] result=cipher.doFinal(bytes(value));int split=result.length-16;return Base64.getEncoder().encodeToString(iv)+"."+Base64.getEncoder().encodeToString(Arrays.copyOfRange(result,split,result.length))+"."+Base64.getEncoder().encodeToString(Arrays.copyOf(result,split));}catch(Exception e){throw new IllegalStateException("Ошибка шифрования");}}
 public com.fasterxml.jackson.databind.JsonNode decrypt(String value){if(value==null||value.isBlank())return M.nullNode();try{String[] parts=value.split("\\.");byte[] iv=Base64.getDecoder().decode(parts[0]),tag=Base64.getDecoder().decode(parts[1]),data=Base64.getDecoder().decode(parts[2]);byte[] packed=Arrays.copyOf(data,data.length+tag.length);System.arraycopy(tag,0,packed,data.length,tag.length);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));return parse(new String(cipher.doFinal(packed),StandardCharsets.UTF_8));}catch(Exception e){throw new IllegalStateException("Не удалось расшифровать данные. Проверьте DATA_KEY.");}}
 public synchronized void close()throws SQLException{connection.close();}
}