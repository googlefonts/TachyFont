import unittest
from fontTools.ttLib import TTFont
from closure_taker import ClosureTaker

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
    Expected result is array: [3]
    """
    self.closureTaker.clear()
    self.closureTaker.add_glyph_names(['c'])
    gids = self.closureTaker.closure()
    self.assertTrue( gids==[3]  , 'Closure of c is [c]')
    
  def test_clear(self):
    """
    Takes closure of cleared input lists
    Expected result is array: []
    """
    self.closureTaker.clear()
    gids = self.closureTaker.closure()
    self.assertTrue( gids==[]  , 'Closure of empty is []')
    
  def tearDown(self):
    """
    Closes font
    """
    self.font.close()
 
  
if __name__ == '__main__':
    unittest.main()