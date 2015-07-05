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

import javax.servlet.http.*;

/**
 * A servlet that handle char data requests.
 */
@SuppressWarnings("serial")
public class CharDataServlet extends HttpServlet {

  @Override
  // TODO(bstell): the rename this file to indicate it is a servlet file.
  public void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    Gson gson = new Gson();
    CharRequest charRequest = gson.fromJson(req.getReader(), CharRequest.class);

    String fontname = charRequest.getFontname();
    TachyFontData tachyFontData = GetTachyFontData.getTachyFontData(fontname);

    byte[] bundle = tachyFontData.getGlyphBundleForChars(charRequest.getCodePoints());

    // TODO(bstell): determine the correct content type.
    resp.setContentType("text/richtext");
    resp.getOutputStream().write(bundle, 0, bundle.length);
  }
}
