package com.github.googlei18n.tachyfont;

import java.io.IOException;
//import java.io.InputStream;
import java.util.Enumeration;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

import javax.servlet.http.*;

@SuppressWarnings("serial")
public class TachyFontServlet extends HttpServlet {
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    resp.setContentType("text/plain");
    String jarFilename = "fonts/noto/sans/NotoSansJP-Thin_subset_smp.TachyFont.jar";
    JarFile jarFile = new JarFile("WEB-INF/" + jarFilename);
    resp.getWriter().println("Jar file: " + jarFilename);
    Enumeration<JarEntry> enumEntries = jarFile.entries();
    resp.getWriter().println("jar file entries:");
    while (enumEntries.hasMoreElements()) {
      JarEntry jarEntry = enumEntries.nextElement();
      resp.getWriter().println("  " + jarEntry.getName());
    }

//    JarEntry base = jarFile.getJarEntry("base");
//    InputStream baseStream = jarFile.getInputStream(base);
//    JarEntry closure_data = jarFile.getJarEntry("closure_data");
//    JarEntry closure_idx = jarFile.getJarEntry("closure_idx");
//    JarEntry codepoints = jarFile.getJarEntry("codepoints");
//    JarEntry gids = jarFile.getJarEntry("gids");
//    JarEntry glyph_data = jarFile.getJarEntry("glyph_data");
//    JarEntry glyph_table = jarFile.getJarEntry("glyph_table");

    jarFile.close();
  }
}
