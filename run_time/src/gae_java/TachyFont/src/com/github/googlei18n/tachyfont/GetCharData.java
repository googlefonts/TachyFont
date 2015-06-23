package com.github.googlei18n.tachyfont;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

import javax.servlet.http.*;

@SuppressWarnings("serial")
public class GetCharData extends HttpServlet {
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    resp.setContentType("text/plain");
    // Get the codepoints.
    String jarFilename = "fonts/noto/sans/NotoSansJP-Thin_subset_smp.TachyFont.jar";
    JarFile jarFile = new JarFile("WEB-INF/" + jarFilename);
    Map<Integer, Integer> cmapMap = getCmapMap(jarFile);
    Iterator<Entry<Integer, Integer>> cmapIterator = cmapMap.entrySet().iterator();
    resp.getWriter().println("code to gid:");
    while (cmapIterator.hasNext()) {
      Entry<Integer, Integer> pair = cmapIterator.next();
      resp.getWriter().println("  " + pair.getKey() + " = " + pair.getValue());
    }

    Map<Integer, Set<Integer>> closureMap = getClosureMap(jarFile);
    Iterator<Entry<Integer, Set<Integer>>> closureMapIterator =
        closureMap.entrySet().iterator();
    resp.getWriter().println("gid to closure:");
    while (closureMapIterator.hasNext()) {
      Entry<Integer, Set<Integer>> pair = closureMapIterator.next();
      // TODO(bstell): this is not yet debugged.
      resp.getWriter().println(pair.getKey() + " = " + pair.getValue());
    }

    // TODO(bstell): look in the closure file for other gids to include.
    for (Integer value : cmapMap.values()) {
      System.out.println("look for the closure of gid = " + value);
    }
    // TODO(bstell): create and return the glyph bundle.
    jarFile.close();
  }

  private Map<Integer, Integer> getCmapMap(JarFile jarFile) throws IOException {
    JarEntry codePointsJarEntry = jarFile.getJarEntry("codepoints");
    InputStream codePointsStream = jarFile.getInputStream(codePointsJarEntry);
    DataInputStream codePointsDataStream = new DataInputStream(codePointsStream);

    JarEntry gidsJarEntry = jarFile.getJarEntry("gids");
    InputStream gidsStream = jarFile.getInputStream(gidsJarEntry);
    DataInputStream gidsDataStream = new DataInputStream(gidsStream);

    HashMap<Integer, Integer> cmapMap = new HashMap<Integer, Integer>();
    while (codePointsDataStream.available() > 0) {
      Integer codePoint = codePointsDataStream.readInt();
      Integer gid = gidsDataStream.readUnsignedShort();
      cmapMap.put(codePoint, gid);
    }
    return cmapMap;
  }

  private Map<Integer, Set<Integer>> getClosureMap(JarFile jarFile) throws IOException {
    JarEntry closureIndexJarEntry = jarFile.getJarEntry("closure_idx");
    InputStream closureIndexStream = jarFile.getInputStream(closureIndexJarEntry);
    DataInputStream closureIndexDataStream = new DataInputStream(closureIndexStream);

    JarEntry closureDataJarEntry = jarFile.getJarEntry("closure_data");
    InputStream closureDataStream = jarFile.getInputStream(closureDataJarEntry);
    int closureDataSize = closureDataStream.available();
    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
    byte[] buffer = new byte[closureDataSize];
    int readLength;
    while ((readLength = closureDataStream.read(buffer, 0, closureDataSize)) != -1)
      byteArrayOutputStream.write(buffer, 0, readLength);
    buffer = byteArrayOutputStream.toByteArray();

    ByteArrayInputStream closureDataByteArrayInputStream =
        new ByteArrayInputStream(buffer);
    DataInputStream closureDataInputStream =
        new DataInputStream(closureDataByteArrayInputStream);
    HashMap<Integer, Set<Integer>> closureMap = new HashMap<Integer, Set<Integer>>();
    Integer gid = -1;
    while (closureIndexDataStream.available() > 0) {
      gid++;
      Integer offset = closureIndexDataStream.readInt();
      Integer size = closureIndexDataStream.readUnsignedShort();
      if (size == 0) {
        continue;
      }
      // TODO(bstell): the following is not yet debugged.
      Set<Integer> closureGids = new HashSet<Integer>();
      closureDataByteArrayInputStream.reset();
      closureDataByteArrayInputStream.skip(offset);
      while (size > 0) {
        Integer closureGid = closureDataInputStream.readUnsignedShort();
        closureGids.add(closureGid);
        size -= 2;
      }
      closureMap.put(gid, closureGids);
    }
    return closureMap;
  }
}
