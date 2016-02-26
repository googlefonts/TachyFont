'use strict';

/**
 * @license
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

/**
 * @fileoverview Code to parse a CFF dict. For a detailed description of a CFF
 * dict @see
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format
 * @see http://www.microsoft.com/typography/otspec/otff.htm
 * @author bstell@google.com (Brian Stell)
 */

goog.provide('tachyfont.CffDict');

goog.require('goog.log');
goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.Logger');
goog.require('tachyfont.utils');



/**
 * A class holding the CFF DICT information.
 * @param {string} name The name of the DICT
 * @param {!DataView} dataView A DataView for the DICT bytes.
 * @constructor @struct @final
 */
tachyfont.CffDict = function(name, dataView) {
  /** @private {string} */
  this.name_ = name;

  /** @private {!DataView} */
  this.dataView_ = dataView;

  if (goog.DEBUG) {
    /** @private {!Array.<string>} */
    this.operators_ = [];
  }

  /**
   * Map of operator->operand.
   * @private {!Object.<string, !tachyfont.CffDict.OperandsOperatorSet_>}
   */
  this.dict_ = {};

  /**
   * The DICT operators map.
   * This is only used during debugging.
   * @dict @private {!Object.<string,string>}
   */
  this.dictOperators_;
};


/**
 * Initialize a CFF DICT.
 * @private
 */
tachyfont.CffDict.prototype.init_ = function() {
  var binaryEditor = new tachyfont.BinaryFontEditor(this.dataView_, 0);

  while (binaryEditor.offset < this.dataView_.byteLength) {
    var operandsOperatorSet =
        tachyfont.CffDict.readOperandsOperator_(binaryEditor);
    if (goog.DEBUG) {
      if (this.dictOperators_ &&
          operandsOperatorSet.operator in this.dictOperators_) {
        goog.log.info(tachyfont.Logger.logger, '  ' +
            operandsOperatorSet.operands + ' ' +
            this.dictOperators_[operandsOperatorSet.operator]);
      } else {
        goog.log.info(tachyfont.Logger.logger, '  ' +
            operandsOperatorSet.operands + ' ' +
            operandsOperatorSet.operator);
      }
    }
    this.operators_.push(operandsOperatorSet.operator);
    this.dict_[operandsOperatorSet.operator] = operandsOperatorSet;
  }
};


/**
 * Load a CFF DICT.
 * @param {string} name The name of the dict.
 * @param {!ArrayBuffer} buffer The font bytes.
 * @param {number} offset The offset in the font bytes to the DICT.
 * @param {number} length The length of the DICT.
 * @param {!Object.<string,string>=} opt_dictOperators A map of the DICT
 *     operators to the logical names.
 * @return {!tachyfont.CffDict}
 */
tachyfont.CffDict.loadDict =
    function(name, buffer, offset, length, opt_dictOperators) {
  var dataView = new DataView(buffer, offset, length);
  //tachyfont.utils.hexDump(name, dataView);
  var dict = new tachyfont.CffDict(name, dataView);
  if (goog.DEBUG) {
    if (opt_dictOperators) {
      dict.setOperators(
          /** @type {!Object.<string, string>} */ (opt_dictOperators));
    }
  }
  dict.init_();
  return dict;
};


if (goog.DEBUG) {
  /**
   * For debug set the DICT operators map.
   * @param {!Object.<string,string>} dictOperators The DICT operators map.
   */
  tachyfont.CffDict.prototype.setOperators = function(dictOperators) {
    this.dictOperators_ = dictOperators;
  };
}


/**
 * Get the dict name.
 * @return {string} The Dict name.
 */
tachyfont.CffDict.prototype.getName = function() {
  return this.name_;
};


/**
 * Get the dict operators.
 * @return {!Array.<string>} The Dict operators.
 */
tachyfont.CffDict.prototype.getOperators = function() {
  return this.operators_;
};


/**
 * Get a CFF DICT operands as an array.
 * @param {string} operator The operator of the operands/operator set.
 * @return {!Array.<number>} The array of operands.
 */
tachyfont.CffDict.prototype.getOperands = function(operator) {
  if (operator in this.dict_) {
    return this.dict_[operator].operands;
  }
  throw new RangeError(this.name_ + ' getOperands: ' + operator);
};


/**
 * Get a CFF DICT operand.
 * @param {string} operator The operator of the operands/operator.
 * @param {number} index The index of desired operand.
 * @return {number} The operand.
 */
tachyfont.CffDict.prototype.getOperand = function(operator, index) {
  if (operator in this.dict_ && index < this.dict_[operator].operands.length) {
    return this.dict_[operator].operands[index];
  }
  throw new RangeError(this.name_ + ' getOperand: ' + operator + '/' + index);
};


/**
 * Get a CFF DICT OperandsOperatorSet.
 * @param {string} operator The operator of the operands/operator.
 * @return {!tachyfont.CffDict.OperandsOperatorSet_ } The OperandsOperatorSet.
 */
tachyfont.CffDict.prototype.getOperandsOperatorSet = function(operator) {
  if (operator in this.dict_) {
    return this.dict_[operator];
  }
  throw new RangeError(this.name_ + ' getOperandsOperatorSet: ' + operator);
};


/**
 * Update a operand entry in a CFF DICT.
 * Note: this does not support modifying nibbles.
 * @param {string} operator The operator.
 * @param {number} index The index of the operand.
 * @param {number} delta The delta change to the operand.
 */
tachyfont.CffDict.prototype.updateDictEntryOperand =
    function(operator, index, delta) {
  var operandsOperatorSet = this.dict_[operator];
  var operand = operandsOperatorSet.operands[index] + delta;
  var length = operandsOperatorSet.operandLengths[index];
  var operandOffset = 0;
  for (var i = 0; i < index; i++) {
    operandOffset += operandsOperatorSet.operandLengths[i];
  }
  var operandValues = tachyfont.CffDict.numberToOperand_(operand, length);

  // Update the operand value.
  var binaryEditor = new tachyfont.BinaryFontEditor(this.dataView_,
      operandsOperatorSet.offset + operandOffset);
  for (var i = 0; i < operandValues.length; i++) {
    binaryEditor.setUint8(operandValues[i]);
  }
  operandsOperatorSet.operands[index] = operand;
};



/**
 * A class holding an operands/operator set.
 * @param {!Array.<number>} operands The operands.
 * @param {string} operator The operator.
 * @param {number} offset The starting offset of the operands/operator.
 * @param {!Array.<number>} operandLengths The lengths of the operands.
 * @constructor @struct @final
 * @private
 */
tachyfont.CffDict.OperandsOperatorSet_ =
    function(operands, operator, offset, operandLengths) {
  /** @type {string} */
  this.operator = operator;

  /** @type {!Array.<number>} */
  this.operands = operands;

  /** @type {number} */
  this.offset = offset;

  /** @type {!Array.<number>} */
  this.operandLengths = operandLengths;
};


/*
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 *
 * Table 3 Operand Encoding
 * Size   b0-range    Value-range       Value-calculation
 *   1     32-246    -107 to +107       b0-139
 *   2    247-250    +108 to +1131      (b0-247)*256+b1+108
 *   2    251-254   -1131 to -108      -(b0-251)*256-b1-108
 *   3      28     -32768 to +32767     b1<<8|b2
 *   5      29    -(2^31) to +(2^31-1)  b1<<24|b2<<16|b3<<8|b4
 *
 * Reserved operand leading bytes: 22-27, 31, and 255
 */


/**
 * Give a number and length convert it to an operand.
 * Note: this does not handle nibbles.
 * @param {number} number The number to convert.
 * @param {number} length The length in bytes to convert the number to.
 * @return {!Array.<number>} The byte values for the operand.
 * @private
 */
tachyfont.CffDict.numberToOperand_ = function(number, length) {
  var b0, b1, b2, b3, b4;
  if (length == 1 && number >= -107 && number <= 107) {
    // b0-139 = number
    return [number + 139];
  } else if (length == 2 && number >= 108 && number <= 1131) {
    // (b0-247)*256+b1+108 = number
    number -= 108;
    b0 = (number >> 8) + 247;
    b1 = number & 0xff;
    return [b0, b1];
  } else if (length == 2 && number <= -108 && number >= -1131) {
    // -(b0-251)*256-b1-108 = number
    number = -number - 108;
    b0 = (number >> 8) + 251;
    b1 = number & 0xff;
    return [b0, b1];
  } else if (length == 3 && number >= -32768 && number <= 32767) {
    // b1<<8|b2 = number
    b1 = number >> 8;
    b2 = number & 0xff;
    return [28, b1, b2];
  } else if (length == 5 && number >= -2147483648 && number <= 2147483647) {
    // b1<<24|b2<<16|b3<<8|b4 = number
    b1 = (number >> 24) & 0xff;
    b2 = (number >> 16) & 0xff;
    b3 = (number >> 8) & 0xff;
    b4 = number & 0xff;
    return [29, b1, b2, b3, b4];
  }
  throw new Error('invalid length/number: ' + length + '/' + number);
};


/**
 * Get a CFF DICT Operands/Operator set.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor The binary editor at the
 *     position of the Operands/Operator.
 * @return {!tachyfont.CffDict.OperandsOperatorSet_} The operands operator set.
 * @throws {Error} If a reserved operant is found.
 * @private
 */
tachyfont.CffDict.readOperandsOperator_ = function(binaryEditor) {
  var operands = [], operandLengths = [], operator = '',
      offset = binaryEditor.offset;

  var operand = '', b0, b1, b2, b3, b4, op, isUndefined;
  while (operands.length <= 48) {
    // Get the operand.
    operand = isUndefined;
    b0 = binaryEditor.getUint8();
    if ((b0 >= 22 && b0 <= 27) || b0 == 31 || b0 == 255) {
      if (goog.DEBUG) {
        goog.log.info(tachyfont.Logger.logger,
            b0 + ' is a reserved operand value');
      }
      throw new Error(tachyfont.utils.numberToHex(b0, 2) +
          'is reserved operand value');
    }
    if (b0 >= 32 && b0 <= 246) {
      operand = b0 - 139;
      operandLengths.push(1);
    } else if (b0 >= 247 && b0 <= 250) {
      b1 = binaryEditor.getUint8();
      operandLengths.push(2);
      operand = (b0 - 247) * 256 + b1 + 108;
    } else if (b0 >= 251 && b0 <= 254) {
      b1 = binaryEditor.getUint8();
      operandLengths.push(2);
      operand = -(b0 - 251) * 256 - b1 - 108;
    } else if (b0 == 28) {
      b1 = binaryEditor.getUint8();
      b2 = binaryEditor.getUint8();
      operandLengths.push(3);
      operand = b1 << 8 | b2;
    } else if (b0 == 29) {
      b1 = binaryEditor.getUint8();
      b2 = binaryEditor.getUint8();
      b3 = binaryEditor.getUint8();
      b4 = binaryEditor.getUint8();
      operandLengths.push(5);
      operand = b1 << 24 | b2 << 16 | b3 << 8 | b4;
    } else if (b0 == 30) {
      operand = Number(tachyfont.CffDict.parseNibbles_(binaryEditor,
          operandLengths));
    }
    if (operand !== isUndefined) {
      operands.push(operand);
      continue;
    }

    // Get the operator.
    op = b0;
    if (op == 12) {
      operator = '12 ';
      op = binaryEditor.getUint8();
    }
    operator += op.toString();
    break;
  }
  return new tachyfont.CffDict.OperandsOperatorSet_(operands, operator, offset,
      operandLengths);
};


/**
 * Get a CFF DICT nibble operand.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor The binary editor.
 * @param {!Array.<number>} operandLengths The length of the operands.
 * @return {string} The nibble operand.
 * @private
 */
tachyfont.CffDict.parseNibbles_ = function(binaryEditor, operandLengths) {
  var operand = '', aByte, nibbles = [], nibble, operandsCnt = 0;
  var operandLength = 1; // Add one for the nibble indicator (30)  byte.
  while (operandsCnt++ <= 48) {
    aByte = binaryEditor.getUint8();
    operandLength++;
    nibbles[0] = aByte >> 4;
    nibbles[1] = aByte & 0xf;
    for (var i = 0; i < 2; i++) {
      nibble = nibbles[i];
      if (nibble <= 9) {
        operand += nibble.toString();
      } else if (nibble == 0xa) {
        operand += '.';
      } else if (nibble == 0xb) {
        operand += 'E';
      } else if (nibble == 0xC) {
        operand += '-E';
      } else if (nibble == 0xe) {
        operand += '-';
      } else if (nibble == 0xf) {
        operandLengths.push(operandLength);
        return operand;
      } else {
        throw new Error('invalid nibble');
      }
    }
  }
  throw new Error('nibble too long');
};


/**
 * Define the CFF DICT operators.
 * @enum {string}
 */
tachyfont.CffDict.Operator = {
  FD_ARRAY: '12 36',
  FD_SELECT: '12 37',
  CHAR_STRINGS: '17',
  CHARSET: '15',
  PRIVATE: '18'
};


if (goog.DEBUG) {
  /**
   * Top DICT operator to description map.  This map is used to convert the
   * operators to meaningfull text.
   * @dict {!Object.<string,string>}
   */
  tachyfont.CffDict.OperatorDescriptions = {
    '0': 'version',
    '1': 'Notice',
    '12 0': 'Copyright',
    '2': 'FullName',
    '3': 'FamilyName',
    '4': 'Weight',
    '5': 'FontBBox',
    '6': 'BlueValues',
    '7': 'OtherBlue',
    '10': 'StdHW',
    '11': 'StdVW',
    '12 1': 'IsFixedPitch',
    '12 2': 'ItalicAngle',
    '12 3': 'UnderlinePosition',
    '12 4': 'UnderlineThickness',
    '12 5': 'PaintType',
    '12 6': 'CharstringType',
    '12 7': 'FontMatrix',
    '12 8': 'StrokeWidth',
    '12 12': 'StemSnapH',
    '12 13': 'StemSnapV',
    '12 17': 'LanguageGroup',
    '13': 'UniqueID',
    '14': 'XUID',
    '15': 'charset',
    '16': 'Encoding',
    '17': 'CharStrings',
    '18': 'Private',
    '19': 'Subrs',
    '20': 'DefaultWidthX',
    '21': 'NominalWidthX',
    '12 20': 'SyntheticBase',
    '12 21': 'PostScript',
    '12 22': 'BaseFontName',
    '12 23': 'BaseFontBlen',
    '12 30': 'ROS',
    '12 31': 'CIDFontVersion',
    '12 32': 'CIDFontRevision',
    '12 33': 'CIDFontType',
    '12 34': 'CIDCount',
    '12 35': 'UIDBase',
    '12 36': 'FDArray',
    '12 37': 'FDSelect',
    '12 38': 'FontName'
  };
}
