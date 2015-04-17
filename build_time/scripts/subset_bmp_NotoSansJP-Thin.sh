#!/bin/bash

# Get the top of the tree.
TOPDIR="`dirname $0`/../.."
#echo TOPDIR=\"${TOPDIR}\"

SUBSET_POSTFIX='_bmp'
# The font and subset text.
FONT="${TOPDIR}/src_fonts/NotoSansJP/NotoSansJP-Thin.otf"
TEXT='ab'
#UNICODES='U+20-3401,U+3402-3fff,U+01F110,U+01F112,U+01F113'
#UNICODES='U+3402'
UNICODES=''

# Get the command.
SUBSET_CMD="${TOPDIR}/build_time/src/make_subset.py"
#echo SUBSET_CMD=\"${SUBSET_CMD}\"

# Point to the libraries.
export PYTHONPATH=${PYTHONPATH}:${TOPDIR}/run_time/src/gae_server/third_party/fonttools/Lib/

# Run the command.
echo python ${SUBSET_CMD} ${FONT} --subset_postfix=${SUBSET_POSTFIX} --text=${TEXT} --unicodes=${UNICODES}
python ${SUBSET_CMD} ${FONT} --subset_postfix=${SUBSET_POSTFIX} --text=${TEXT} --unicodes=${UNICODES}

