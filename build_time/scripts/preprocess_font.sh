#!/bin/bash

TOP_DIR=../..
cd ${TOP_DIR}
TOOLS_DIR=build_time/src
LOG_OPTIONS=--log=DEBUG
DEBUG_OPTIONS=--reuse_clean
FONT=$1
DEST_DIR=${PWD}/run_time/src/gae_server/fonts/
FONTTOOLS_DIR=run_time/src/gae_server/third_party/fonttools-master/Lib/
PYTHONPATH=${PYTHONPATH}:${FONTTOOLS_DIR}

echo /usr/bin/env python ${TOOLS_DIR}/main.py ${LOG_OPTIONS} ${DEBUG_OPTIONS} ${FONT} ${DEST_DIR}
/usr/bin/env python ${TOOLS_DIR}/main.py ${LOG_OPTIONS} ${DEBUG_OPTIONS} ${FONT} ${DEST_DIR}

