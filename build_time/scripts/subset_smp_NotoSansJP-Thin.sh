#!/bin/bash

# Get the top of the tree.
TOPDIR="`dirname $0`/../.."
echo TOPDIR=\"${TOPDIR}\"

# The font and subset text.
FONT="${TOPDIR}/src_fonts/NotoSansJP/NotoSansJP-Thin.otf"
TEXT='ab'
UNICODES='U+01F150,U+01F151'

# Get the command.
SUBSET_CMD="${TOPDIR}/build_time/src/make_subset.py"
echo SUBSET_CMD=\"${SUBSET_CMD}\"

# Point to the libraries.
export PYTHONPATH=${PYTHONPATH}:${TOPDIR}/run_time/src/gae_server/third_party/fonttools/Lib/

# Run the command.
echo python ${SUBSET_CMD} ${FONT} --text=${TEXT} --unicodes=${UNICODES}
python ${SUBSET_CMD} ${FONT} --text=${TEXT} --unicodes=${UNICODES}

