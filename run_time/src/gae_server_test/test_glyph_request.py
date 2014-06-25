from gae_server.incremental_fonts import GlyphRequest
import unittest
import webtest
import webapp2
from binascii import a2b_hex


class AppTest(unittest.TestCase):

  def setUp(self):
    app = webapp2.WSGIApplication([('/', GlyphRequest)])
    self.testapp = webtest.TestApp(app)

  # Test the handler.
  def test_GlyphRequest(self):
    glyph_request = {'font': 'noto', 'arr': [97, 98, 99]}  # a,b,c
    response = self.testapp.post_json('/', glyph_request)
    expected_response = (
        '0003010001005e0000000000740002005effec03d7045c001a0025000021272306062322263510253735342623220607273636333216151125323635350706061514160354230852a37ca2b8020fba6c77579b443753c460c7c2fe0a97ada2bdad699c6749aa9b014e1007417d773420872c32b0c0fd147da3966307076a72565c000200ae00000074006c000200aeffec047b06140014002100000132121110022322262723060723113311140733361722061515141633323635342602b6d9ecf0d56fae370e1f0681b40a0a6fc7a69093a7949192045cfed5fef4fef0fed7504f78130614fe867171a495bce008e1c1d9cdd0d0000000030071000000e0005000010071ffec0393045e0016000005220011100033321617072623220615141633323715060266edfef8010bf7509d33378b62a69e9e9b918c7214012301100114012b211a9634d1cfc7d340a03b0000')
    self.assertEqual(response.body, a2b_hex(expected_response))
    self.assertEqual(response.status_int, 200)
