"""
  Copyright 2014 Google Inc. All rights reserved.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
"""

import logging
from os import path
import StringIO
from time import sleep
from time import time
import zipfile
import webapp2
from incremental_fonts_utils import prepare_bundle

tachyfont_major_version = 1
tachyfont_minor_version = 0

BASE_DIR = path.dirname(__file__)


class IncrementalFonts(webapp2.RequestHandler):

  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write('incremental fonts server under development, '
                            'try back later')


class GlyphRequest(webapp2.RequestHandler):
  """Service for glyph requests including associated glyphs.
  """

  def post(self):
    bandwidth = self.request.headers.get('X-TachyFont-bandwidth', '0')
    self.response.headers.add_header('Access-Control-Allow-Origin', '*')
    # HACK
    # GAE is brain dead and only uses gzip compression for richtext resources.
    # Specifically, it does not allow the application to choose to use gzip.
    # Therefore, we set mime_type for binary data as richtext.
    self.response.headers['Content-Type'] = 'text/richtext'
    f = StringIO.StringIO(prepare_bundle(self.request, tachyfont_major_version,
                                         tachyfont_minor_version))
    bandwidth_limited_write(f, self.response.out, bandwidth, True)

  def options(self):
    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Access-Control-Allow-Headers'] = '*, X-TachyFont-bandwidth'
    self.response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'

class DoLogging(webapp2.RequestHandler):
  """Dump logging messages into the server logs.

  """
  logger = logging.getLogger()
  logger.setLevel(logging.INFO)

  def post(self):
    self.response.headers.add_header('Access-Control-Allow-Origin', '*')
    logging.info(self.request.body + '')


class IncrFont(webapp2.RequestHandler):
  chunk_size = 512

  # 3G (at least according to WebPageTest.org) is 1.6 Mbps / 768 Kbps
  # so download is 200 KBps; 5 mS / KB
  def get(self, fontname):
    self.response.headers['Access-Control-Allow-Origin'] = '*'
    bandwidth = self.request.headers.get('X-TachyFont-bandwidth', '0')
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.headers['Content-Type'] = 'text/richtext'
    basename = fontname.split('/')[0]
    zipfilename = BASE_DIR + '/fonts/' + basename + '.TachyFont.jar'
    zf = zipfile.ZipFile(zipfilename, 'r')
    base = zf.open('base', 'r')
    bandwidth_limited_write(base, self.response.out, bandwidth, True)

  def options(self, other):
    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Access-Control-Allow-Headers'] = '*, X-TachyFont-bandwidth'
    self.response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'


class WebFont(webapp2.RequestHandler):
  chunk_size = 512

  # 3G (at least according to WebPageTest.org) is 1.6 Mbps / 768 Kbps
  # so download is 200 KBps; 5 mS / KB
  def get(self, fontname):
    bandwidth = self.request.get('bandwidth')
    self.response.headers['Content-Type'] = 'application/binary'
    filename = BASE_DIR + '/fonts/' + fontname
    f = open(filename, 'rb')
    bandwidth_limited_write(f, self.response.out, bandwidth, False)


def bandwidth_limited_write(in_file, out_file, kbits_per_sec_str,
                            post_delay_compression):
  """Bandwidth limited writing.

  Args:
    in_file: file, the file to read the data from.
    out_file: file, the file to write the data to.
    kbits_per_sec_str: string, the bandwidth speed.
    post_delay_compression: bool, a hack to compensate for compressed data
        vs uncompressed data.
  """
  try:
    kbits_per_sec = float(kbits_per_sec_str)
  except ValueError:
    kbits_per_sec = 0
  if not kbits_per_sec:
    while True:
      data = in_file.read()
      if not data:
        return
      out_file.write(data)

  kbytes_per_sec = kbits_per_sec / 8
  ms_per_k = 1000 / kbytes_per_sec
  if post_delay_compression:
    ms_per_k /= 2
  chunk_size = 512
  t0 = time()
  chunks_sent = 0
  delay_per_chunk = (ms_per_k / 1024.0) / 1024 * chunk_size
  while True:
    chunk = in_file.read(chunk_size)
    if not chunk:
      break
    chunks_sent += 1
    needed_sleep_time = chunks_sent * delay_per_chunk - (time() - t0)
    if needed_sleep_time > 0:
      sleep(needed_sleep_time)
    out_file.write(chunk)


app = webapp2.WSGIApplication([
    ('/incremental_fonts/request', GlyphRequest),
    ('/incremental_fonts/logger', DoLogging),
    (r'/incremental_fonts/webfonts/(.*)', WebFont),
    (r'/incremental_fonts/incrfonts/(.*)', IncrFont),
    ('/incremental_fonts/.*', IncrementalFonts)
], debug=True)
