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

import java.io.IOException;
import java.io.InputStream;
import java.util.jar.JarFile;
import java.util.jar.JarInputStream;

/**
 * A class that maps a fontname to a TachyFont JAR file.
 */
public class FontNameMapping {

  public static String toJarFileName(String fontname) throws IOException {
    // TODO(bstell): needs work. The mapping should come from a data file.
    String filename = "";
    // TODO(bstell): have the mapping defined in a resource file.
    if (fontname.equals("NotoSansJP-Thin")) {
      filename = "fonts/noto/sans/NotoSansJP-Thin.TachyFont.jar";
    } else if (fontname.equals("NotoSansJP-Thin_subset_bmp")) {
      filename = "fonts/noto/sans/NotoSansJP-Thin_subset_bmp.TachyFont.jar";
    } else if (fontname.equals("NotoSansJP-Thin_subset_smp")) {
      filename = "fonts/noto/sans/NotoSansJP-Thin_subset_smp.TachyFont.jar";
    } else {
      throw new IOException();
    }
    return filename;
  }


  // TODO(bstell): get rid of this function.  
  public static JarFile fontNameToJarFile(String fontname) throws IOException {
    // TODO(bstell): needs work.
    String filename = FontNameMapping.toJarFileName(fontname);
    InputStream stream = FontNameMapping.class.getResourceAsStream(filename);
    JarInputStream jarInput = new JarInputStream(stream);
    jarInput.close();

    JarFile jarFile = new JarFile(filename);
    return jarFile;
  }
}
