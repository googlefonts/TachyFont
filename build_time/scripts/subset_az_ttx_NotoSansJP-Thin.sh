#!/bin/bash

# This is a sample script used for preprocessing fonts in the open source
# tree.

# Get the top of the tree.
TOPDIR="`dirname $0`/../.."
#echo TOPDIR=\"${TOPDIR}\"

SUBSET_POSTFIX='_az_ttx'
# The font and subset text.
FONT="${TOPDIR}/src_fonts/NotoSansJP/NotoSansJP-Thin.otf"
TEXT='az'
UNICODES=''

# Get the command.
SUBSET_CMD="${TOPDIR}/build_time/src/make_subset.py"
#echo SUBSET_CMD=\"${SUBSET_CMD}\"

# Point to the libraries.
export PYTHONPATH=${PYTHONPATH}:${TOPDIR}/run_time/src/gae_server/third_party/fonttools/Lib/

# Run the command.
echo python ${SUBSET_CMD} ${FONT} --subset_postfix=${SUBSET_POSTFIX} --text=${TEXT} --unicodes=${UNICODES}
python ${SUBSET_CMD} ${FONT} --subset_postfix=${SUBSET_POSTFIX} --text=${TEXT} --unicodes=${UNICODES}

