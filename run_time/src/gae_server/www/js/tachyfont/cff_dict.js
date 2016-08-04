'use strict';

/**
 * @license
 * Copyright 2015-2016 Google Inc. All rights reserved.
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
 * @fileoverview This code parses a CFF (Adobe's Compact Font Format) DICT
 * embedded in an OpenType font. For a detailed description of a CFF dict @see
 * http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
 * For a detailed description of the OpenType font format
 * @see http://www.microsoft.com/typography/otspec/otff.htm
 */

goog.provide('tachyfont.CffDict');

goog.require('tachyfont.BinaryFontEditor');
goog.require('tachyfont.utils');



/**
 * This class reads in the information in a CFF DICT in the font data and can
 * modify the DICT values in the font data.
 * When lazily loading glyph data the offsets in the CFF Top DICT need to be
 * adjusted to handle the increased size of the CFF CharStrings INDEX.
 * @param {string} name The name of the DICT
 * @param {!DataView} dataView A DataView for the DICT bytes.
 * @constructor @struct @final
 */
tachyfont.CffDict = function(name, dataView) {
  /** @private {string} */
  this.name_ = name;

  /** @private {!DataView} */
  this.dataView_ = dataView;


  /**
   * Map of operator->operand(s).
   * @private {!Object<string, !tachyfont.CffDict.OperandsOperatorSet>}
   */
  this.dict_ = {};
  var binaryEditor = new tachyfont.BinaryFontEditor(this.dataView_, 0);
  var operandsOperatorSet;
  while (binaryEditor.getOffset() < this.dataView_.byteLength) {
    operandsOperatorSet = tachyfont.CffDict.readOperandsOperator(binaryEditor);
    this.dict_[operandsOperatorSet.operator] = operandsOperatorSet;
  }

};


/**
 * @typedef {(number|string)}
 */
tachyfont.CffDict.Operand;


/**
 * @typedef {{value: !tachyfont.CffDict.Operand, length: number}}
 */
tachyfont.CffDict.OperandInfo;


/**
 * Gets the DataView.
 * @return {!DataView}
 */
tachyfont.CffDict.prototype.getDataView = function() {
  return this.dataView_;
};


/**
 * Gets the dict.
 * This holds the operator/operands sets from the CFF DICT.
 * @return {!Object<string, !tachyfont.CffDict.OperandsOperatorSet>}
 */
tachyfont.CffDict.prototype.getDict = function() {
  return this.dict_;
};


/**
 * Gets the dict name.
 * @return {string} The Dict name.
 */
tachyfont.CffDict.prototype.getName = function() {
  return this.name_;
};


/**
 * Gets the CFF DICT operands for an operator.
 * @param {string} operator The operator of the operands/operator set.
 * @return {?Array<!tachyfont.CffDict.OperandInfo>} The array of operands.
 */
tachyfont.CffDict.prototype.getOperands = function(operator) {
  if (operator in this.dict_) {
    return this.dict_[operator].operands;
  }
  return null;
};


/**
 * Gets a CFF DICT operand.
 * @param {string} operator The operator of the operands/operator.
 * @param {number} index The index of desired operand.
 * @return {?tachyfont.CffDict.Operand} The operand.
 */
tachyfont.CffDict.prototype.getOperand = function(operator, index) {
  if (operator in this.dict_ && index < this.dict_[operator].operands.length) {
    return this.dict_[operator].operands[index].value;
  }
  return null;
};


/**
 * Gets a CFF DICT OperandsOperatorSet.
 * @param {string} operator The operator of the operands/operator.
 * @return {?tachyfont.CffDict.OperandsOperatorSet} The OperandsOperatorSet.
 */
tachyfont.CffDict.prototype.getOperandsOperatorSet = function(operator) {
  if (operator in this.dict_) {
    return this.dict_[operator];
  }
  return null;
};


/**
 * Updates a operand entry in a CFF DICT.
 * Note:
 *     1. This does not support modifying nibbles.
 *     2. The new operand(s) must exactly fit in the existing space.
 * @param {string} operator The operator.
 * @param {number} index The index of the operand.
 * @param {number} delta The delta change to the operand.
 */
tachyfont.CffDict.prototype.updateDictEntryOperand =
    function(operator, index, delta) {
  var operandsOperatorSet = this.dict_[operator];
  var operand = operandsOperatorSet.operands[index].value + delta;
  if (typeof operand != 'number') {
    throw new Error('operator is not a number: ' + operator);
  }
  var length = operandsOperatorSet.operands[index].length;
  var operandOffset = 0;
  for (var i = 0; i < index; i++) {
    operandOffset += operandsOperatorSet.operands[i].length;
  }
  var operandValues = tachyfont.CffDict.numberToOperand(
      /** @type {number} */ (operand), length);

  // Update the operand value.
  var binaryEditor = new tachyfont.BinaryFontEditor(this.dataView_,
      operandsOperatorSet.offset + operandOffset);
  for (var i = 0; i < operandValues.length; i++) {
    binaryEditor.setUint8(operandValues[i]);
  }
  operandsOperatorSet.operands[index].value = operand;
};


/**
 * @typedef {{operator: string, offset: number,
 *     operands: !Array<!tachyfont.CffDict.OperandInfo>}}
 */
tachyfont.CffDict.OperandsOperatorSet;


// Information from
// http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
// on how CFF encodes operands.
//
// Table 3 Operand Encoding
// Size   b0-range    Value-range       Value-calculation
//   1     32-246    -107 to +107       b0-139
//   2    247-250    +108 to +1131      (b0-247)*256+b1+108
//   2    251-254   -1131 to -108      -(b0-251)*256-b1-108
//   3      28     -32768 to +32767     b1<<8|b2
//   5      29    -(2^31) to +(2^31-1)  b1<<24|b2<<16|b3<<8|b4
//
// Reserved operand leading bytes: 22-27, 31, and 255


/**
 * Given a number and length converts it to an operand.
 * Note: this does not handle nibbles.
 * @param {number} number The number to convert.
 * @param {number} length The length in bytes to convert the number to.
 * @return {!Array<number>} The byte values for the operand.
 */
tachyfont.CffDict.numberToOperand = function(number, length) {
  var b0, b1, b2, b3, b4;
  if (length == 1 && number >= -107 && number <= 107) {
    // b0-139 = number
    return [number + 139];
  }
  if (length == 2 && number >= 108 && number <= 1131) {
    // (b0-247)*256+b1+108 = number
    number -= 108;
    b0 = (number >> 8) + 247;
    b1 = number & 0xff;
    return [b0, b1];
  }
  if (length == 2 && number <= -108 && number >= -1131) {
    // -(b0-251)*256-b1-108 = number
    number = -number - 108;
    b0 = (number >> 8) + 251;
    b1 = number & 0xff;
    return [b0, b1];
  }
  if (length == 3 && number >= -32768 && number <= 32767) {
    // b1<<8|b2 = number
    b1 = number >> 8;
    b2 = number & 0xff;
    return [28, b1, b2];
  }
  if (length == 5 && number >= -2147483648 && number <= 2147483647) {
    // b1<<24|b2<<16|b3<<8|b4 = number
    b1 = (number >> 24) & 0xff;
    b2 = (number >> 16) & 0xff;
    b3 = (number >> 8) & 0xff;
    b4 = number & 0xff;
    return [29, b1, b2, b3, b4];
  }
  // Library fatal error: the library cannot handle the request which means it
  // will not be able to modify the font.
  throw new Error('invalid length/number: ' + length + '/' + number);
};


/**
 * Reads a CFF DICT Operands/Operator set.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor The binary editor at the
 *     position of the Operands/Operator.
 * @return {!tachyfont.CffDict.OperandsOperatorSet} The operands operator set.
 * @throws {Error} If a reserved operant is found.
 */
tachyfont.CffDict.readOperandsOperator = function(binaryEditor) {
  var operands = [];
  var operator = '';
  var offset = binaryEditor.getOffset();

  var operand;
  var operandLength;
  var b0, b1, b2, b3, b4;
  var op;
  while (operands.length <= 48) {
    // Get the operand.
    operand = null;
    operandLength = 0;
    b0 = binaryEditor.getUint8();
    if ((b0 >= 22 && b0 <= 27) || b0 == 31 || b0 == 255) {
      // Library fatal error: something is deeply wrong; possibly a bad font.
      // Recovery is not possible.
      throw new Error('bad operand: ' + tachyfont.utils.numberToHex(b0, 2));
    }
    if (b0 >= 32 && b0 <= 246) {
      operand = b0 - 139;
      operandLength = 1;
    } else if (b0 >= 247 && b0 <= 250) {
      b1 = binaryEditor.getUint8();
      operandLength = 2;
      operand = (b0 - 247) * 256 + b1 + 108;
    } else if (b0 >= 251 && b0 <= 254) {
      b1 = binaryEditor.getUint8();
      operandLength = 2;
      operand = -(b0 - 251) * 256 - b1 - 108;
    } else if (b0 == 28) {
      b1 = binaryEditor.getUint8();
      b2 = binaryEditor.getUint8();
      operandLength = 3;
      operand = b1 << 8 | b2;
    } else if (b0 == 29) {
      b1 = binaryEditor.getUint8();
      b2 = binaryEditor.getUint8();
      b3 = binaryEditor.getUint8();
      b4 = binaryEditor.getUint8();
      operandLength = 5;
      operand = b1 << 24 | b2 << 16 | b3 << 8 | b4;
    } else if (b0 == 30) {
      var operandSet = tachyfont.CffDict.parseNibbles_(binaryEditor);
      operand = Number(operandSet.value);
      operandLength = operandSet.length;
    }
    if (operand !== null) {
      operands.push({value: operand, length: operandLength});
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

  return {
    operator: operator,
    operands: operands,
    offset: offset
  };
};


/**
 * Reads a CFF DICT nibble operand.
 * CFF nibbles are a 4 bit variable length encoding terminated by a 'F' (15
 * decimal) in either the upper nibble or upper nibble.
 * @param {!tachyfont.BinaryFontEditor} binaryEditor The binary editor.
 * @return {!tachyfont.CffDict.OperandInfo} The nibble operand.
 * @private
 */
tachyfont.CffDict.parseNibbles_ = function(binaryEditor) {
  var operand = '';
  var aByte;
  var nibbles = [];
  var nibble;
  var operandsCnt = 0;
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
        return {value: operand, length: operandLength};
      } else {
        // Library fatal error: something is deeply wrong; possibly a bad font
        // and recovery is not possible.
        throw new Error('invalid nibble');
      }
    }
  }
  // Library fatal error: something is deeply wrong; possibly a bad font and
  // recovery is not possible.
  throw new Error('nibble too long');
};


/**
 * Defines the CFF DICT operators used in by tachyfont when lazily loading glyph
 * data.
 * @type {Object<string, string>}
 */
tachyfont.CffDict.Operator = {
  FD_ARRAY: '12 36',
  FD_SELECT: '12 37',
  CHAR_STRINGS: '17',
  CHARSET: '15',
  PRIVATE: '18'
};


