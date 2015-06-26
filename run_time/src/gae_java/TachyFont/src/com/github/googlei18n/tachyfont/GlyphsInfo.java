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

import java.util.ArrayList;
import java.util.List;

/**
 * A class that holds information about a set of glyphs.
 */
public class GlyphsInfo {
  static byte hmtxBit = (1 << 0);
  static byte vmtxBit = (1 << 1);
  static byte cffBit = (1 << 2);
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
