#!/usr/bin/env python

import sys

if sys.version_info[0] == 3:
    from BitVector.BitVector import __version__
    from BitVector.BitVector import __author__
    from BitVector.BitVector import __date__
    from BitVector.BitVector import __url__
    from BitVector.BitVector import __copyright__
    from BitVector.BitVector import BitVector
else:
    from BitVector import __version__
    from BitVector import __author__
    from BitVector import __date__
    from BitVector import __url__
    from BitVector import __copyright__
    from BitVector import BitVector




