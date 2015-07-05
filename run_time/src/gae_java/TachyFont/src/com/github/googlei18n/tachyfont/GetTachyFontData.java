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

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.jar.JarInputStream;

/**
 * Gets the TachyFontData.
 */
public class GetTachyFontData {
  public static TachyFontData getTachyFontData(String fontname) throws IOException {
    InputStream inputStream = null;
    try {
      // Convert the name to the JAR path.
      String filename = FontNameMapping.toJarFileName(fontname);
      inputStream = new FileInputStream("WEB-INF/" + filename);
      JarInputStream jarIn = new JarInputStream(inputStream);
      TachyFontData tachyFontData = new TachyFontData(fontname, jarIn);
      tachyFontData.init();
      return tachyFontData;
    } finally {
      if (inputStream != null) {
        inputStream.close();
      }
    }
  }

  public static TachyFontData getTachyFontData(String fontname, Class<?> klass)
      throws IOException {
    InputStream inputStream = null;
    try {
      // Convert the name to the JAR path.
      String filename = FontNameMapping.toJarFileName(fontname);
      inputStream = klass.getResourceAsStream(filename);
      JarInputStream jarIn = new JarInputStream(inputStream);
      TachyFontData tachyFontData = new TachyFontData(fontname, jarIn);
      tachyFontData.init();
      return tachyFontData;
    } finally {
      if (inputStream != null) {
        inputStream.close();
      }
    }
  }
}