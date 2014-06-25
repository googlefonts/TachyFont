from gae_server.incremental_fonts import GlyphRequest
import unittest
import webtest
import webapp2


class AppTest(unittest.TestCase):
    def setUp(self):
      app = webapp2.WSGIApplication([('/', GlyphRequest)])
      self.testapp = webtest.TestApp(app)

    # Test the handler.
    def test_GlyphRequest(self):
        response = self.testapp.post_json('/')
        self.assertEqual(response.status_int, 200)