package com.github.googlei18n.tachyfont;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
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
  static byte hmtxBit = (1 << 0);
  static byte vmtxBit = (1 << 1);
  static byte cffBit = (1 << 2);

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
    System.out.println("codepoint: gid(s)");
    for (String requestedChar : requestedChars) {
      int codePoint = requestedChar.codePointAt(0);
      Integer gid = cmapMap.get(codePoint);
      System.out.printf("  0x%05x: %5d", codePoint, gid);
      requestedGids.add(gid);
      Set<Integer> closureGids = closureMap.get(gid);
      if (closureGids != null) {
        // TODO(bstell: check if the closure covered other chars.
        requestedGids.addAll(closureGids);
        for (int cgid : closureGids) {
          System.out.printf(", %5d", cgid);
        }
      }
      System.out.printf("\n");
    }
    
    // Get the glyph info.
    GlyphsInfo glyphsInfo = getGlyphsInto(jarFile);

    // Create the glyph bundle.
    byte[] bundle = getGlyphBundle(jarFile, glyphsInfo, requestedGids);

    // For development: report the results.
    System.out.println("\nbundle bytes");
    System.out.println("length = " + bundle.length);
    int lineCount = 8;
    for (int i = 0; i < bundle.length; i++) {
      if ((i % lineCount) == 0) {
        System.out.printf("  ");
      }
      System.out.printf("0x%02x, ", bundle[i]);
      if ((i != 0) && ((i % lineCount) == lineCount - 1)) {
        System.out.printf(" /* 0x%1$04X - %1$d */\n", i - lineCount + 1);
      }
    }

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
      indexInput.readInt();
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
    int numberGlyphs;
    List<GlyphEntry> glyphEntries = new ArrayList<GlyphEntry>();
    GlyphsInfo(boolean hasHmtx, boolean hasVmtx, boolean isCff, int numberGlyphs) {
      this.hasHmtx = hasHmtx;
      this.hasVmtx = hasVmtx;
      this.isCff = isCff;
      this.numberGlyphs = numberGlyphs;
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
    boolean hasHmtx = (flags & hmtxBit) == hmtxBit;
    boolean hasVmtx = (flags & vmtxBit) == vmtxBit;
    boolean isCff = (flags & cffBit) == cffBit;
    GlyphsInfo glyphInfo = new GlyphsInfo(hasHmtx, hasVmtx, isCff, numberGlyphs);
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

  private byte[] getGlyphBundle(JarFile jarFile, GlyphsInfo glyphsInfo, Set<Integer> gids) throws IOException {
    // Get the glyph data
    JarEntry glyphDataJarEntry = jarFile.getJarEntry("glyph_data");
    InputStream glyphDataStream = jarFile.getInputStream(glyphDataJarEntry);
    // Put the data into a byteArrayStream to support 'seeking' to offset
    int glyphDataSize = glyphDataStream.available();
    byte[] buffer = new byte[glyphDataSize];
    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
    int readLength;
    while ((readLength = glyphDataStream.read(buffer, 0, glyphDataSize)) != -1) {
      byteArrayOutputStream.write(buffer, 0, readLength);
    }
    buffer = byteArrayOutputStream.toByteArray();
    ByteArrayInputStream glyphDataByteArrayInputStream =
        new ByteArrayInputStream(buffer);

    // Create a holder for the bundle.
    ByteArrayOutputStream bundleOutputStream = new ByteArrayOutputStream();
    DataOutputStream bundleData = new DataOutputStream(bundleOutputStream);

    // Write the bundle header.
    bundleData.writeShort(gids.size());
    byte flags = glyphsInfo.hasHmtx ? hmtxBit : 0;
    flags |= glyphsInfo.hasVmtx ? vmtxBit : 0;
    flags |= glyphsInfo.isCff ? cffBit : 0;
    bundleData.writeByte(flags);

    // Write the per-glyph data.
    // The CFF data offset is off by one.
    int delta = glyphsInfo.isCff ? -1 : 0;
    int bytesLength = 1000;
    byte[] bytes = new byte[bytesLength];
    List<GlyphEntry> glyphEntries = glyphsInfo.glyphEntries;
    for (int gid : gids) {
      // Write the GlyphEntry data.
      GlyphEntry glyphEntry = glyphEntries.get(gid);
      bundleData.writeShort(gid);
      if (glyphsInfo.hasHmtx) {
        bundleData.writeShort(glyphEntry.hmtx);
      }
      if (glyphsInfo.hasVmtx) {
        bundleData.writeShort(glyphEntry.vmtx);
      }
      int offset = glyphEntry.offset;
      int length = glyphEntry.length;
      bundleData.writeInt(offset);
      bundleData.writeShort(length);
      if (length > bytesLength) {
        bytesLength *= 2;
        bytes = new byte[bytesLength];
      }
      glyphDataByteArrayInputStream.reset();
      glyphDataByteArrayInputStream.skip(offset + delta);
      glyphDataByteArrayInputStream.read(bytes, 0, length);
      bundleData.write(bytes, 0, length);
    }
    
    return bundleOutputStream.toByteArray();
  }
}






