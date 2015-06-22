package com.github.googlei18n.tachyfont;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import java.util.zip.GZIPOutputStream;

import javax.servlet.http.*;

@SuppressWarnings("serial")
public class GetBase extends HttpServlet {
  @Override
  public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    // Get the TachyFont base.
    String jarFilename = "fonts/noto/sans/NotoSansJP-Thin_subset_smp.TachyFont.jar";
    JarFile jarFile = new JarFile("WEB-INF/" + jarFilename);
    JarEntry base = jarFile.getJarEntry("base");
    InputStream baseStream = jarFile.getInputStream(base);

    // Send the data.
    byte[] buffer = new byte[4096];
    int bytesRead = 0;
    resp.setContentType("application/x-font-otf");
    OutputStream outputStream = resp.getOutputStream();
    GZIPOutputStream gzipOutputStream = new GZIPOutputStream(outputStream);
    resp.setHeader("Content-Encoding", "gzip");
    while ((bytesRead = baseStream.read(buffer)) != -1) {
      gzipOutputStream.write(buffer, 0, bytesRead);
    }
    gzipOutputStream.close();
    jarFile.close();
  }
}
