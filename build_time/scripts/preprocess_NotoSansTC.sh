#!/bin/bash

# This is a sample script used for preprocessing fonts in the open source
# tree.

declare -a fonts=(
  NotoSansTC-Thin.otf
  NotoSansTC-Light.otf
  NotoSansTC-DemiLight.otf
  NotoSansTC-Regular.otf
  NotoSansTC-Medium.otf
  NotoSansTC-Bold.otf
  NotoSansTC-Black.otf
)

for i in "${fonts[@]}"
do
   ./preprocess_font.sh src_fonts/NotoSansTC/${i} NotoSansTC
   status=$?
   # Put a blank line between the results.
   echo
   if [ $status -ne 0 ]; then
     echo preprocessing src_fonts/NotoSansTC/${i} failed, exiting ...
     exit $status
   fi
done
echo "all done"
