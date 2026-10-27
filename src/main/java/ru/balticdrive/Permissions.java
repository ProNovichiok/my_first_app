package ru.balticdrive;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.io.IOException;
public final class Permissions {
 public static void file(Path p)throws IOException{set(p,"rw-------");}
 public static void directory(Path p)throws IOException{set(p,"rwx------");}
 private static void set(Path p,String permissions)throws IOException{try{Files.setPosixFilePermissions(p,PosixFilePermissions.fromString(permissions));}catch(UnsupportedOperationException ignored){/* Windows: use NTFS access control, documented in LAUNCH.md. */}}
}