#!/bin/bash

echo '****'

# The preprocess.sh command needs to run in the scripts directory.
cd `dirname $0`
#echo cwd = $PWD

# The font to preprocess (relative to the top dir).
FONT='src_fonts/NotoSansJP/NotoSansJP-Thin_subset_bmp.otf'

# Get the command.
PREPROCESS_CMD="./preprocess_font.sh"

# Run the command.
echo ${PREPROCESS_CMD} ${FONT}
${PREPROCESS_CMD} ${FONT}

