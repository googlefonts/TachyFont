from build.closure_taker import ClosureTaker
import unittest
from fontTools.ttLib import TTFont

class TestClosureTaker(unittest.TestCase):
  
  def setUp(self):
    self.font =  TTFont('test_data/my_font.ttf')
    self.closureTaker = ClosureTaker(self.font)
    
  def test_c(self):
    self.closureTaker.clear()
    self.closureTaker.addGlyphNames(['c'])
    gids = self.closureTaker.closure()
    self.assertTrue( gids==[3]  , 'Closure of c is [c]')
    
  def tearDown(self):
    self.font.close()
  
if __name__ == '__main__':
    unittest.main()