#!/bin/bash

# This is a sample script used for preprocessing fonts in the open source
# tree.

echo '****'

# The preprocess.sh command needs to run in the scripts directory.
cd `dirname $0`
#echo cwd = $PWD

# The font to preprocess (relative to the top dir).
FONT='src_fonts/NotoSansJP/NotoSansJP-Thin_subset_smp.otf'

# Get the command.
PREPROCESS_CMD="./preprocess_font.sh"

# Run the command.
echo ${PREPROCESS_CMD} ${FONT} NotoSansJP
${PREPROCESS_CMD} ${FONT} NotoSansJP

