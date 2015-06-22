#!/bin/bash

TOP_DIR=../..
cd ${TOP_DIR}
TOOLS_DIR=build_time/src
#LOG_OPTIONS=--log=DEBUG
LOG_OPTIONS=--log=INFO
#DEBUG_OPTIONS=--reuse_clean
HINTING_OPTIONS=--hinting
FONTPATH=$1
DEST_DIR=run_time/src/gae_server/fonts
FONTTOOLS_DIR=run_time/src/gae_server/third_party/fonttools/Lib/
PYTHONPATH=${FONTTOOLS_DIR}:${PYTHONPATH}
OTS_VALIDATOR=/usr/local/google/home/bstell/ots/trunk/out/Default/validator_checker

trap "echo 'caught signal; exiting ...'; exit 1" SIGHUP SIGINT SIGTERM

# Generate the filename of the 'cleaned' version.
fontname="${FONTPATH##*/}"
fontname_sans_ext=${fontname%.*}
ext="${fontname##*.}"
cleanfile=${DEST_DIR}/${fontname_sans_ext}_clean.${ext}

# Preprocess the font.
CMD="/usr/bin/env python ${TOOLS_DIR}/main.py ${LOG_OPTIONS} ${DEBUG_OPTIONS} ${HINTING_OPTIONS} ${FONTPATH} ${DEST_DIR}"
${CMD}
status=$?
if [ $status -ne 0 ]; then
  echo "preprocessing FAILED, exiting..."
  exit $status
fi

# Validate the cleaned font
if [ ! -e ${OTS_VALIDATOR} ]; then
  echo "OTS validator not present, skipping..."
else
  ${OTS_VALIDATOR} ${cleanfile}
  status=$?
  if [ $status -ne 0 ]; then
    echo "OTS validation FAILED, exiting..."
    exit $status
  fi
fi

exit $status
