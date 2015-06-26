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

import com.google.gson.Gson;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.jar.JarFile;

import javax.servlet.http.*;

/**
 * A servlet that handle char data requests.
 */
@SuppressWarnings("serial")
public class GetCharData extends HttpServlet {

  @Override
  public void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    Gson gson = new Gson();
    CharRequest charRequest = gson.fromJson(req.getReader(), CharRequest.class);

    // TODO(bstell): the processing of the JAR file should be done somewhere 
    // else and cached. this routine should use the cached results of the JAR 
    // processing.
    // Convert to the preprocessed font.
    JarFile jarFile = TachyFontData.fontNameToJarFile(charRequest.font);
    // Get the cmap info.
    Map<Integer, Integer> cmapMap = TachyFontData.getCmapMap(jarFile);
    // Get the closure info.
    Map<Integer, Set<Integer>> closureMap = TachyFontData.getClosureMap(jarFile);

    // Determine the glyphs including the closure glyphs.
    Set<Integer> requestedGids = new TreeSet<Integer>();
    // System.out.println("codepoint: gid(s)");
    for (int codePoint : charRequest.arr) {
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
    
    // Get the glyph info.
    GlyphsInfo glyphsInfo = TachyFontData.getGlyphsInto(jarFile);

    // Create the glyph bundle.
    byte[] bundle = TachyFontData.getGlyphBundle(jarFile, glyphsInfo, requestedGids);

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

    // TODO(bstell): determine the correct content type.
    resp.setContentType("text/richtext");
    resp.getOutputStream().write(bundle, 0, bundle.length);
    jarFile.close();
  }
}
