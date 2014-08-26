#! /usr/bin/env python

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

import sys
import os
from glob import glob
import subprocess
import shutil
import errno



class Paths:
	TOOL = '/build_time/src/pyprepfnt'
	BASE = os.path.dirname(os.path.abspath(__file__))
	SOURCE = BASE + '/src_fonts/'
	COOKED = BASE + '/cooked/'
	FILE_PLACES = {BASE + '/run_time/src/gae_server/fonts/' : [ 'base'],
				   BASE + '/run_time/src/gae_server/data/' : ['closure_data','closure_idx','codepoints','gids','glyph_data','glyph_table'] }

def makedir(dir):
	try:
		os.makedirs(dir)
	except OSError as exception:
		if exception.errno != errno.EEXIST:
			raise

def process(font_path,outdir):
	is_otf = font_path.endswith('.otf')
	argv = [Paths.BASE+Paths.TOOL]
	#to enable cache font uncomment
	#argv.append('--changefont')
	if is_otf:
		argv.append('--hinting')
	argv.append('--output')
	argv.append(outdir)
	argv.append(font_path)
	subprocess.check_call(argv)

def copy(src,destination):
	makedir(destination)
	shutil.copy(src,destination)


def main(args):
	makedir(Paths.COOKED)
	for name,subdirs,files in os.walk(Paths.SOURCE):
		if subdirs and not files:
			version_dirs = subdirs[:]
		if not subdirs and files:
			version = version_dirs.pop(0)
			assert name.endswith(version)
			for font_file in files:
				outdir = Paths.COOKED+version
				font_filename, font_extension = os.path.splitext(font_file)
				if font_extension not in ['.otf','.ttf']:
					continue
				destdir = '/'+version+font_filename
				print 'Found \'{}\'. Use following name in javascript: {}'.format(name+'/'+font_file,version+font_filename)
				process(name+'/'+font_file,outdir)
				for dest_folder in Paths.FILE_PLACES:
					dest  = dest_folder+destdir
					for file_to_copy in Paths.FILE_PLACES[dest_folder]:
						copy(outdir+'/'+font_filename+'/'+file_to_copy,dest)



if __name__ == '__main__':
	try:
		main(sys.argv[1:])
	except:
		print "Unexpected error:", sys.exc_info()[0]
	raw_input("Press Enter to exit...")
