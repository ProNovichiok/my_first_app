package ru.balticdrive;
import java.nio.channels.*;
import java.nio.file.*;
public final class InstanceLock implements AutoCloseable {
 private final FileChannel channel;private final FileLock lock;
 public InstanceLock(Path directory)throws Exception{Files.createDirectories(directory);channel=FileChannel.open(directory.resolve("application.lock"),StandardOpenOption.CREATE,StandardOpenOption.WRITE);FileLock acquired;try{acquired=channel.tryLock();}catch(OverlappingFileLockException e){channel.close();throw new IllegalStateException("Приложение уже запущено для этой базы.");}if(acquired==null){channel.close();throw new IllegalStateException("Приложение уже запущено для этой базы. Оставьте один экземпляр.");}lock=acquired;Files.writeString(directory.resolve("application.pid"),Long.toString(ProcessHandle.current().pid()));}
 public void close()throws Exception{try{lock.release();}finally{channel.close();}}
}