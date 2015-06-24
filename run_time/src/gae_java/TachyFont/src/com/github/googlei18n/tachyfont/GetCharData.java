package com.github.googlei18n.tachyfont;

import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.TreeMap;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

import javax.servlet.http.*;

@SuppressWarnings("serial")
public class GetCharData extends HttpServlet {
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    // Get the codepoints.
    // Pretend data for these chars was requested.
    String[] requestedChars = { "\uD83C\uDE15", "a", "b", "c", "\"",  "\u2014", };

    // Get the preprocessed font.
    String jarFilename = "fonts/noto/sans/NotoSansJP-Thin.TachyFont.jar";
    JarFile jarFile = new JarFile("WEB-INF/" + jarFilename);
    
    // Get the cmap info.
    Map<Integer, Integer> cmapMap = getCmapMap(jarFile);

    // Get the closure info.
    Map<Integer, Set<Integer>> closureMap = getClosureMap(jarFile);

    // Determine the glyphs including the closure glyphs.
    Set<Integer> requestedGids = new TreeSet<Integer>();
    for (String requestedChar : requestedChars) {
      int codePoint = requestedChar.codePointAt(0);
      Integer gid = cmapMap.get(codePoint);
      requestedGids.add(gid);
      Set<Integer> closureGids = closureMap.get(gid);
      if (closureGids != null) {
        // TODO(bstell: check if the closure covered other chars.
        requestedGids.addAll(closureGids);
      }
    }
    
    GlyphsInfo glyphsInfo = getGlyphsInto(jarFile);
    
    System.out.println("requested chars: " + Arrays.toString(requestedChars));
    System.out.println("gids: " + requestedGids);

    // TODO(bstell): get the glyph info.
    byte[] bundle = getGlyphBundle(jarFile, requestedGids);

    // TODO(bstell): create the glyph bundle.

    // For development: send something to the display.
    resp.setContentType("text/plain");
    resp.getWriter().println("requested chars: " + Arrays.toString(requestedChars));
    resp.getWriter().println("gids: " + requestedGids);
    jarFile.close();
  }

  private Map<Integer, Integer> getCmapMap(JarFile jarFile) throws IOException {
    JarEntry codePointsJarEntry = jarFile.getJarEntry("codepoints");
    InputStream codePointsStream = jarFile.getInputStream(codePointsJarEntry);
    DataInputStream codePointsDataStream = new DataInputStream(codePointsStream);

    JarEntry gidsJarEntry = jarFile.getJarEntry("gids");
    InputStream gidsStream = jarFile.getInputStream(gidsJarEntry);
    DataInputStream gidsDataStream = new DataInputStream(gidsStream);

    Map<Integer, Integer> cmapMap = new TreeMap<Integer, Integer>();
    while (codePointsDataStream.available() > 0) {
      Integer codePoint = codePointsDataStream.readInt();
      Integer gid = gidsDataStream.readUnsignedShort();
      cmapMap.put(codePoint, gid);
    }
    return cmapMap;
  }

  private Map<Integer, Set<Integer>> getClosureMap(JarFile jarFile) throws IOException {
    JarEntry closureIndexJarEntry = jarFile.getJarEntry("closure_idx");
    InputStream index = jarFile.getInputStream(closureIndexJarEntry);
    DataInputStream indexInput = new DataInputStream(index);

    JarEntry closureDataJarEntry = jarFile.getJarEntry("closure_data");
    InputStream closureDataStream = jarFile.getInputStream(closureDataJarEntry);
    DataInputStream dataInput = new DataInputStream(closureDataStream);
    Map<Integer, Set<Integer>> closureMap = new TreeMap<Integer, Set<Integer>>();
    int gid = -1;
    while (indexInput.available() > 0) {
      gid++;
      Integer offset = indexInput.readInt();
      Integer size = indexInput.readUnsignedShort();
      if (size == 0) {
        continue;
      }
      if (size < 0) {
        System.out.printf("gid %d: size = %d\n", gid, size);
        continue;
      }
      Set<Integer> closureGids = new TreeSet<Integer>();
      while (size > 0) {
        int closureGid = dataInput.readUnsignedShort();
        size -= 2;
        if (closureGid != gid) {
          closureGids.add(closureGid);
        }
      }
      if (!closureGids.isEmpty()) {
        closureMap.put(gid, closureGids);
      }
    }
    return closureMap;
  }
  
  class GlyphEntry {
    int glyphId;
    int hmtx;
    int vmtx;
    int offset;
    int length;
    GlyphEntry(int glyphId, int hmtx, int vmtx, int offset, int length) {
      this.glyphId = glyphId;
      this.hmtx = hmtx;
      this.vmtx = vmtx;
      this.offset = offset;
      this.length = length;
    }
  }
  
  class GlyphsInfo {
    boolean hasHmtx;
    boolean hasVmtx;
    boolean isCff;
    List<GlyphEntry> glyphEntries = new ArrayList<GlyphEntry>();
    GlyphsInfo(boolean hasHmtx, boolean hasVmtx, boolean isCff) {
      this.hasHmtx = hasHmtx;
      this.hasVmtx = hasVmtx;
      this.isCff = isCff;
    }
    void addGlyphEntry(int glyphId, int hmtx, int vmtx, int offset, int length) {
      GlyphEntry glyphEntry = new GlyphEntry(glyphId, hmtx, vmtx, offset, length);
      this.glyphEntries.add(glyphEntry);
    }
  }

  private GlyphsInfo getGlyphsInto(JarFile jarFile) throws IOException {
    // Get the information about the glyphs and where their data location.
    JarEntry glyphInfoJarEntry = jarFile.getJarEntry("glyph_table");
    InputStream glyphInfoStream = jarFile.getInputStream(glyphInfoJarEntry);
    DataInputStream glyphInfoInput = new DataInputStream(glyphInfoStream);
    int flags = glyphInfoInput.readUnsignedShort();
    int numberGlyphs = glyphInfoInput.readUnsignedShort();
    int hmtxBit = (1 << 0);
    int vmtxBit = (1 << 1);
    int cffBit = (1 << 2);
    boolean hasHmtx = (flags & hmtxBit) == hmtxBit;
    boolean hasVmtx = (flags & vmtxBit) == vmtxBit;
    boolean isCff = (flags & cffBit) == cffBit;
    GlyphsInfo glyphInfo = new GlyphsInfo(hasHmtx, hasVmtx, isCff);
    for (int i = 0; i < numberGlyphs; i++) {
      int gid = glyphInfoInput.readUnsignedShort();
      int hmtx = hasHmtx ? (int)glyphInfoInput.readShort() : 0;
      int vmtx = hasVmtx ? (int)glyphInfoInput.readShort() : 0;
      int offset = glyphInfoInput.readInt();
      int length = glyphInfoInput.readUnsignedShort();
      glyphInfo.addGlyphEntry(gid, hmtx, vmtx, offset, length);
    }
    return glyphInfo;
  }

  private byte[] getGlyphBundle(JarFile jarFile, Set<Integer> gids) throws IOException {
    // TODO(bstell): fix this. Maybe use a ByteArrayOutputStream
    byte[] bundle = new byte[1024];

    JarEntry glyphDataJarEntry = jarFile.getJarEntry("glyph_data");
    InputStream glyphDataStream = jarFile.getInputStream(glyphDataJarEntry);
    DataInputStream dataInput = new DataInputStream(glyphDataStream);
//    Map<Integer, Set<Integer>> closureMap = new TreeMap<Integer, Set<Integer>>();
//    Integer gid = -1;
//    while (indexInput.available() > 0) {
//      gid++;
//      Integer offset = indexInput.readInt();
//      Integer size = indexInput.readUnsignedShort();
//      if (size == 0) {
//        continue;
//      }
//      if (size < 0) {
//        System.out.printf("gid %d: size = %d\n", gid, size);
//        continue;
//      }
//      Set<Integer> closureGids = new TreeSet<Integer>();
//      while (size > 0) {
//        Integer closureGid = dataInput.readUnsignedShort();
//        size -= 2;
//        if (closureGid.intValue() != gid.intValue()) {
//          closureGids.add(closureGid);
//        }
//      }
//      if (!closureGids.isEmpty()) {
//        closureMap.put(gid, closureGids);
//      }
//    }
    return bundle;
  }
}
