#!/bin/bash

# This script creates a subset of 'a' followed by 24 characters then 'z'.

# Get the top of the tree.
TOPDIR="`dirname $0`/../.."
#echo TOPDIR=\"${TOPDIR}\"

SUBSET_POSTFIX='_A001_A005'
# The font and subset text.
FONT="${TOPDIR}/src_fonts/NotoSans/NotoSansEgyptianHieroglyphs-Regular.ttf"
TEXT=''
UNICODES='U+000D,U+0020,U+00A0,U+FEFF,U+013000,U+013001,U+013002,U+013003,U+013004'


# Get the command.
SUBSET_CMD="${TOPDIR}/build_time/src/make_subset.py"
#echo SUBSET_CMD=\"${SUBSET_CMD}\"

# Point to the libraries.
export PYTHONPATH=${PYTHONPATH}:${TOPDIR}/run_time/src/gae_server/third_party/fonttools/Lib/

# Run the command.
echo python ${SUBSET_CMD} ${FONT} --subset_postfix=${SUBSET_POSTFIX} --text=${TEXT} --unicodes=${UNICODES}
python ${SUBSET_CMD} ${FONT} --subset_postfix=${SUBSET_POSTFIX} --text=${TEXT} --unicodes=${UNICODES}

