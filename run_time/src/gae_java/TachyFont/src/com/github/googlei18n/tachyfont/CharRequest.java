/*
 * Copyright 2015 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */
package com.github.googlei18n.tachyfont;

import java.util.ArrayList;
import java.util.List;

/**
 * A class the Gson can write the char request parameters into.
 */
public class CharRequest {
  String font;
  ArrayList<Integer> arr;
  
  public String getFontname() {
    return font;
  }

  public List<Integer> getCodePoints() {
    return arr;
  }

  @Override
  public String toString() {
    return "fontname='" + this.font + "', codepoints=" + arr.toString();
  }
}

