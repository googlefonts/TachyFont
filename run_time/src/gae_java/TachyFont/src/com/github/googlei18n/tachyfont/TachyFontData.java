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
import java.util.jar.JarInputStream;

/**
 * A class that handle the TachyFont data in the JAR file.
 */
public class TachyFontData {
  static byte hmtxBit = (1 << 0);
  static byte vmtxBit = (1 << 1);
  static byte cffBit = (1 << 2);
  private String fontname;
  private Class classInJar;
  private JarInputStream jarIn;
  private byte[] baseData = null;
  // The cmap info.
  Map<Integer, Integer> cmapMap = null;
  // The closure (related glyphs) info.
  Map<Integer, Set<Integer>> closureMap = null;
  // Metadata describing the glyphs.
  GlyphsInfo glyphsInfo = null;
  byte[] glyphDataBytes = null;

  
  public void init() throws IOException {
    try {
      // Get the data out of the jar.
      JarEntry jarEntry;
      byte[] closureDataBytes = null;
      byte[] closureIndexBytes = null;
      byte[] codepointsBytes = null;
      byte[] gidsBytes = null;
      byte[] glyphTableBytes = null;
      while ((jarEntry = jarIn.getNextJarEntry()) != null) {
        if (!jarEntry.isDirectory()) {
          String name = jarEntry.getName();
          switch(name) {
            case "base":
              System.out.println("need to handle base data");
              this.baseData = readBytes(jarIn);
              break;
            case "closure_data":
              closureDataBytes = readBytes(jarIn);
              break;
            case "closure_idx":
              closureIndexBytes = readBytes(jarIn);
              break;
            case "codepoints":
              codepointsBytes = readBytes(jarIn);
              break;
            case "gids":
              gidsBytes = readBytes(jarIn);
              break;
            case "glyph_data":
              this.glyphDataBytes = readBytes(jarIn);
              break;
            case "glyph_table":
              glyphTableBytes = readBytes(jarIn);
              break;
            default:
              System.out.println("do not recognize \"" + name + "\"");
              throw new IOException();
          }
        }
      }
      // Check all data was read.
      if (this.baseData == null || 
          closureDataBytes == null ||
          closureIndexBytes == null ||
          codepointsBytes == null ||
          gidsBytes == null ||
          this.glyphDataBytes == null ||
          glyphTableBytes == null
          ) {
        throw new IOException();
      }

      // TODO(bstell): convert the data into more usable forms.
      // Get the cmap info.
      this.cmapMap = this.buildCmapMap(codepointsBytes, gidsBytes);
      // Get the closure info.
      this.closureMap = 
          this.buildClosureMap(closureDataBytes, closureIndexBytes);
      // Metadata describing the glyphs.
      this.glyphsInfo = this.buildGlyphsInfo(glyphTableBytes);

    } finally {
    }
  }
  
  
  private byte[] readBytes(InputStream in) throws IOException {
    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
    int readLength;
    int readSize = 4096;
    byte[] tmpBuffer = new byte[readSize];
    while ((readLength = in.read(tmpBuffer, 0, readSize)) != -1) {
      byteArrayOutputStream.write(tmpBuffer, 0, readLength);
    }
    byte[] buffer = byteArrayOutputStream.toByteArray();
    return buffer;

  }
  
  public TachyFontData(String fontname, JarInputStream jarIn) {
    this.fontname = fontname;
    this.jarIn = jarIn;
  }

  public byte[] getBase() {
    return this.baseData;
  }


  /**
   * Get the TachyFont data file for the font.
   *
   * @param fontname The name of the font.
   * @return An input stream for the file.
   * @throws IOException
   */
  public static JarInputStream fontNameToJarStream(String fontname) throws IOException {
    String filename = FontNameMapping.toJarFileName(fontname);
    InputStream stream = TachyFontData.class.getResourceAsStream(filename);
    JarInputStream jarInput = new JarInputStream(stream);
    return jarInput;
  }


  /**
   * Position the stream at the indicated entry. If not found then throw.
   * 
   * @param name Name of the JarEntry.
   * @param jarInputStream The Jar.
   * @throws IOException
   */
  // TODO(bstell) get rid of this function (it does not work).
  public static void positionStreamAtEntry(JarInputStream jarInputStream, String name)
      throws IOException {

    throw new IOException();
  }
  

  private Map<Integer, Set<Integer>> buildClosureMap(
      byte[] closureIndexBytes, byte[] closureDataBytes) throws IOException {
    InputStream index = new ByteArrayInputStream(closureIndexBytes);
    DataInputStream indexInput = new DataInputStream(index);

    InputStream closureDataStream = new ByteArrayInputStream(closureDataBytes);
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
  


  private Map<Integer, Integer> buildCmapMap(
      byte[] codepointsBytes, byte[] gidsBytes) throws IOException {
    InputStream codePointsStream = new ByteArrayInputStream(codepointsBytes);
        //jarFile.getInputStream(codePointsJarEntry);
    DataInputStream codePointsDataStream = new DataInputStream(codePointsStream);

    InputStream gidsStream = new ByteArrayInputStream(gidsBytes);
    DataInputStream gidsDataStream = new DataInputStream(gidsStream);

    Map<Integer, Integer> cmapMap = new TreeMap<Integer, Integer>();
    while (codePointsDataStream.available() > 0) {
      Integer codePoint = codePointsDataStream.readInt();
      Integer gid = gidsDataStream.readUnsignedShort();
      cmapMap.put(codePoint, gid);
    }
    return cmapMap;
  }


  public byte[] getGlyphBundle(Set<Integer> gids) 
      throws IOException {
    ByteArrayInputStream glyphDataByteArrayInputStream =
        new ByteArrayInputStream(this.glyphDataBytes);

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

  
  /**
   * Get the glyph data for a given list of characters.
   * 
   * @return The glyph data.
   */
  public byte[] getGlyphBundleForChars(List<Integer> codepoints) 
      throws IOException {

    // Determine the glyphs including the closure glyphs.
    Set<Integer> requestedGids = new TreeSet<Integer>();
    // System.out.println("codepoint: gid(s)");
    for (int codePoint : codepoints) {
      Integer gid = cmapMap.get(codePoint);
      // System.out.printf("  0x%05x: %5d", codePoint, gid);
      requestedGids.add(gid);
      Set<Integer> closureGids = closureMap.get(gid);
      if (closureGids != null) {
        // TODO(bstell): check if the closure covered other chars.
        requestedGids.addAll(closureGids);
        // for (int cgid : closureGids) {
          // System.out.printf(", %5d", cgid);
        // }
      }
      // System.out.printf("\n");
    }
    
    // Create the glyph bundle.
    byte[] bundle = this.getGlyphBundle(requestedGids);

    //  // For development: report the results.
    //  System.out.println("\nbundle bytes");
    //  System.out.println("length = " + bundle.length);
    //  int lineCount = 8;
    //  for (int i = 0; i < bundle.length; i++) {
    //    if ((i % lineCount) == 0) {
    //      System.out.printf("  ");
    //    }
    //    System.out.printf("0x%02x, ", bundle[i]);
    //    if ((i != 0) && ((i % lineCount) == lineCount - 1)) {
    //      System.out.printf(" /* 0x%1$04X - %1$d */\n", i - lineCount + 1);
    //    }
    //  }

    return bundle;
  }


private GlyphsInfo buildGlyphsInfo(byte[] glyphTableBytes) throws IOException {
    // Get the information about the glyphs and where their data location.
    InputStream glyphInfoStream = new ByteArrayInputStream(glyphTableBytes);
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
