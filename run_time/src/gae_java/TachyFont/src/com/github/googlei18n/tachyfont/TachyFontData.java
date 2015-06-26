/*
 * Copyright 2015 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
package com.github.googlei18n.tachyfont;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

/**
 * A class that handle the TachyFont data in the JAR file.
 */
public class TachyFontData {
  static byte hmtxBit = (1 << 0);
  static byte vmtxBit = (1 << 1);
  static byte cffBit = (1 << 2);


  public static JarFile fontNameToJarFile(String fontname) throws IOException {
    // TODO(bstell): needs work.
    String filename = "";
    if (fontname.equals("NotoSansJP-Thin")) {
      filename = "fonts/noto/sans/NotoSansJP-Thin.TachyFont.jar";
    }
    JarFile jarFile = new JarFile("WEB-INF/" + filename);
    return jarFile;
  }


  public static byte[] getBase(String fontname) throws IOException {
    JarFile jarFile = fontNameToJarFile(fontname);
    JarEntry base = jarFile.getJarEntry("base");
    InputStream baseStream = jarFile.getInputStream(base);
    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
    int readLength;
    int readSize = 4096;
    byte[] tmpBuffer = new byte[readSize];
    while ((readLength = baseStream.read(tmpBuffer, 0, readSize)) != -1) {
      byteArrayOutputStream.write(tmpBuffer, 0, readLength);
    }
    byte[] buffer = byteArrayOutputStream.toByteArray();
    return buffer;
  }

  public static Map<Integer, Set<Integer>> getClosureMap(JarFile jarFile) throws IOException {
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
  

  public static Map<Integer, Integer> getCmapMap(JarFile jarFile) throws IOException {
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

  
  public static byte[] getGlyphBundle(JarFile jarFile, GlyphsInfo glyphsInfo, Set<Integer> gids) 
      throws IOException {
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

  
  public static GlyphsInfo getGlyphsInto(JarFile jarFile) throws IOException {
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
      int hmtx = hasHmtx ? (int) glyphInfoInput.readShort() : 0;
      int vmtx = hasVmtx ? (int) glyphInfoInput.readShort() : 0;
      int offset = glyphInfoInput.readInt();
      int length = glyphInfoInput.readUnsignedShort();
      glyphInfo.addGlyphEntry(gid, hmtx, vmtx, offset, length);
    }
    return glyphInfo;
  }

}
