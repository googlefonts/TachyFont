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

def fontname_to_zipfile(family, weight):
  family_dir = ''
  filename = ''
  if family == 'Noto Sans JP':
    family_dir = 'NotoSansJP/'
    if weight == '100':
      filename = 'NotoSansJP-Thin'
    elif weight == '300':
      filename = 'NotoSansJP-Light'
    elif weight == '350':
      filename = 'NotoSansJP-DemiLight'
    elif weight == '400':
      filename = 'NotoSansJP-Regular'
    elif weight == '500':
      filename = 'NotoSansJP-Medium'
    elif weight == '700':
      filename = 'NotoSansJP-Bold'
    elif weight == '900':
      filename = 'NotoSansJP-Black'
    else:
      print 'unsupported family/weight: "{}"/{}'.format(family, weight)
  elif family == 'Noto Sans':
    # TODO(bstell): make this work.
    print 'unsupported family/weight: "{}"/{}'.format(family, weight)
    family_dir = 'NotoSans/'
  elif family == 'Arimo':
    # TODO(bstell): make this work.
    print 'unsupported family/weight: "{}"/{}'.format(family, weight)
    family_dir = 'Arimo/'
  zip_path = BASE_DIR + '/fonts/' + family_dir + '/' + filename + '.TachyFont.jar'
  return zip_path

