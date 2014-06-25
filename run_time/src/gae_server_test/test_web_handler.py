import webapp2
import unittest
import webtest
from gae_server.incremental_fonts import IncrementalFonts


class AppTest(unittest.TestCase):

  def setUp(self):
    app = webapp2.WSGIApplication([('/', IncrementalFonts)])
    self.testapp = webtest.TestApp(app)

  # Test the handler.
  def testIncrementalFonts(self):
    response = self.testapp.get('/')
    self.assertEqual(response.status_int, 200)
    self.assertEqual(
        response.normal_body,
        'incremental fonts server under development, try back later')
    self.assertEqual(response.content_type, 'text/plain')
