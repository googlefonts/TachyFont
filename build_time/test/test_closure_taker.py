from build.closure_taker import ClosureTaker
import unittest
from fontTools.ttLib import TTFont

class TestClosureTaker(unittest.TestCase):
  
  def setUp(self):
    """
    Loads font and initializes ClosureTaker
    """
    self.font =  TTFont('test_data/NotoSans-Regular_subset.ttf')
    self.closureTaker = ClosureTaker(self.font)
    
  def test_c(self):
    """
    Takes closure of character 'c'
    Expected result is array: [3,0]
    """
    self.closureTaker.clear()
    self.closureTaker.addGlyphNames(['c'])
    gids = self.closureTaker.closure()
    self.assertTrue( gids==[3,0]  , 'Closure of c is [c,.notdef]')
    
  def test_clear(self):
    """
    Takes closure of cleared input lists
    Expected result is array: [0]
    """
    self.closureTaker.clear()
    gids = self.closureTaker.closure()
    self.assertTrue( gids==[0]  , 'Closure of empty is [.notdef]')
    
  def tearDown(self):
    """
    Closes font
    """
    self.font.close()
 
  
if __name__ == '__main__':
    unittest.main()