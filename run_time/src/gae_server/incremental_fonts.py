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

import webapp2
from os import path, stat
from incremental_fonts_utils import prepare_bundle
import logging
import StringIO
from time import time, sleep

BASE_DIR = path.dirname(__file__)


class IncrementalFonts(webapp2.RequestHandler):

  def get(self):
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.out.write('incremental fonts server under development, try back later')


class GlyphRequest(webapp2.RequestHandler):
  """Service for glyph requests from the server Takes closure of glyphs and returns them as a bundle

  """

  def post(self):
    bandwidth = self.request.headers.get('X-TachyFont-bandwidth')
    self.response.headers.add_header('Access-Control-Allow-Origin', '*')
    #HACK 
    #Since GAE is brain dead, it decides using gzip compression only for text 
    #resources and does not allow the application to decide. 
    #Therefore, we set mime_type for binary data as text.
    self.response.headers['Content-Type'] = 'text/richtext'
    f = StringIO.StringIO(prepare_bundle(self.request))
    bandwidth_limited_write(f, self.response.out, bandwidth, True)


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
    bandwidth = self.request.headers.get('X-TachyFont-bandwidth')
    self.response.headers['Content-Type'] = 'text/plain'
    self.response.headers['Content-Type'] = 'text/richtext'
    filename = BASE_DIR + '/fonts/' + fontname
    f = open(filename, 'rb')
    bandwidth_limited_write(f, self.response.out, bandwidth, True)

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

def bandwidth_limited_write(in_file, out_file, Kbps_str, post_delay_compression):
  try:
    Kbps = float(Kbps_str)
  except:
    Kbps = 0
  if not Kbps:
    while True:
      data = in_file.read()
      if not data:
        return
      out_file.write(data)

  KBps = Kbps / 8
  ms_per_k = 1000 / KBps
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
    if (needed_sleep_time > 0):
      sleep(needed_sleep_time)
    out_file.write(chunk)


app = webapp2.WSGIApplication([
    ('/incremental_fonts/request', GlyphRequest),
    ('/incremental_fonts/logger', DoLogging),
    (r'/incremental_fonts/webfonts/(.*)', WebFont),
    (r'/incremental_fonts/incrfonts/(.*)', IncrFont),
    ('/incremental_fonts/.*', IncrementalFonts)
], debug=True)
