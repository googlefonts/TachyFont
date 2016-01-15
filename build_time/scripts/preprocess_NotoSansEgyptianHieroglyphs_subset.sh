#!/bin/bash

# This script preprocess the subset of 'a' followed by 24 characters then 'z'.
echo '****'

# The preprocess.sh command needs to run in the scripts directory.
cd `dirname $0`
echo cwd = $PWD

# The font to preprocess (relative to the top dir).
FONT='src_fonts/NotoSans/NotoSansEgyptianHieroglyphs-Regular_subset_A001_A005.ttf'

# Get the command.
PREPROCESS_CMD="./preprocess_font.sh"

# Run the command.
echo ${PREPROCESS_CMD} ${FONT} NotoSans
${PREPROCESS_CMD} ${FONT} NotoSans

