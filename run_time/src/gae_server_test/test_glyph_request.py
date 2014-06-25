from gae_server.incremental_fonts import GlyphRequest
import unittest
import webtest
import webapp2
from binascii import a2b_hex
from static_constants import GLYPH_REQUEST_RESPONSE_FOR_NOTO_ABC, NOTO_FONT, ARRAY_ABC


class AppTest(unittest.TestCase):

  def setUp(self):
    app = webapp2.WSGIApplication([('/', GlyphRequest)])
    self.testapp = webtest.TestApp(app)

  # Test the handler.
  def test_GlyphRequest(self):
    glyph_request = {'font': NOTO_FONT, 'arr': ARRAY_ABC}
    response = self.testapp.post_json('/', glyph_request)
    expected_response = GLYPH_REQUEST_RESPONSE_FOR_NOTO_ABC
    self.assertEqual(response.body, a2b_hex(expected_response))
    self.assertEqual(response.status_int, 200)
