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

from os import path

tachyfont_major_version = 1
tachyfont_minor_version = 0

BASE_DIR = path.dirname(__file__)

def fontname_to_zipfile(fontname):
  family_dir = ''
  if fontname[0:10] == 'NotoSansJP':
    family_dir = 'NotoSansJP/'
  elif fontname[0:8] == 'NotoSans':
    family_dir = 'NotoSans/'
  elif fontname[0:5] == 'Arimo':
    family_dir = 'Arimo/'
  zip_path = BASE_DIR + '/fonts/' + family_dir + fontname + '.TachyFont.jar'
  return zip_path

