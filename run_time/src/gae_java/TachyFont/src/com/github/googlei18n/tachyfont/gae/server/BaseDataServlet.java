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
package com.github.googlei18n.tachyfont.gae.server;

import com.github.googlei18n.tachyfont.GetTachyFontData;
import com.github.googlei18n.tachyfont.TachyFontData;

import java.io.IOException;
import java.io.OutputStream;

import javax.servlet.http.*;

/**
 * A servlet to send the TachyFont base data.
 */
@SuppressWarnings("serial")
public class BaseDataServlet extends HttpServlet {
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    // Get the TachyFont base.
    String pathInfo = req.getPathInfo();
    String[] pathParts = pathInfo.split("/");
    if (!("".equals(pathParts[0])) || !("base".equals(pathParts[2]))) {
      throw new IOException();
    }
    String fontname = pathParts[1];
    TachyFontData tachyFontData = GetTachyFontData.getTachyFontData(fontname);
    byte[] buffer = tachyFontData.getBase();

    // TODO(bstell): Check that the transfer is compressed.
    resp.setContentType("application/binary");
    OutputStream outputStream = resp.getOutputStream();
    outputStream.write(buffer);
  }
}
