#!/bin/bash

# This is a sample script used for preprocessing fonts in the open source
# tree.

declare -a fonts=(
  NotoSansSC-Thin.otf
  NotoSansSC-Light.otf
  NotoSansSC-DemiLight.otf
  NotoSansSC-Regular.otf
  NotoSansSC-Medium.otf
  NotoSansSC-Bold.otf
  NotoSansSC-Black.otf
)

for i in "${fonts[@]}"
do
   ./preprocess_font.sh src_fonts/NotoSansSC/${i} NotoSansSC
   status=$?
   # Put a blank line between the results.
   echo
   if [ $status -ne 0 ]; then
     echo preprocessing src_fonts/NotoSansSC/${i} failed, exiting ...
     exit $status
   fi
done
echo "all done"
