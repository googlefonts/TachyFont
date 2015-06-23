package com.github.googlei18n.tachyfont;

import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
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
    while (cmapIterator.hasNext()) {
      Entry<Integer, Integer> pair = cmapIterator.next();
      resp.getWriter().println(pair.getKey() + " = " + pair.getValue());
    }

    // TODO(bstell): look in the closure file for other gids to include.
    for (Integer value : cmapMap.values()) {
      System.out.println("look for the closure of gid = " + value);
    }
    // TODO(bstell): create and return the glyph bundle.
    jarFile.close();
  }
  private HashMap<Integer, Integer> getCmapMap(JarFile jarFile) throws IOException {
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
}
