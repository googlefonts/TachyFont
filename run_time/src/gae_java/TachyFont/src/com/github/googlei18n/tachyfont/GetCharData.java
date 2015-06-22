package com.github.googlei18n.tachyfont;

import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.zip.GZIPOutputStream;

import javax.servlet.http.*;

@SuppressWarnings("serial")
public class GetCharData extends HttpServlet {
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    // Get the codepoints.
    String jarFilename = "fonts/noto/sans/NotoSansJP-Thin_subset_smp.TachyFont.jar";
    JarFile jarFile = new JarFile("WEB-INF/" + jarFilename);
    JarEntry codePointsJarEntry = jarFile.getJarEntry("codepoints");
    InputStream codePointsStream = jarFile.getInputStream(codePointsJarEntry);
    DataInputStream codePointsDataStream = new DataInputStream(codePointsStream);
    List<Integer> codePoints = new ArrayList<Integer>();
    Integer codePoint;
    while ((codePoint = codePointsDataStream.readInt()) != null) {
      // TODO(bstell): get the gids and make a codepoint->gid map
      System.out.println(codePoint);
    }
    // TODO(bstell): look in the closure file for other gids to include. 
    // TODO(bstell): create and return the glyph bundle.
    jarFile.close();
  }
}
