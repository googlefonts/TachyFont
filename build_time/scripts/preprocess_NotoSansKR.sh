#!/bin/bash

# This is a sample script used for preprocessing fonts in the open source
# tree.

declare -a fonts=(
  NotoSansKR-Thin.otf
  NotoSansKR-Light.otf
  NotoSansKR-DemiLight.otf
  NotoSansKR-Regular.otf
  NotoSansKR-Medium.otf
  NotoSansKR-Bold.otf
  NotoSansKR-Black.otf
)

for i in "${fonts[@]}"
do
   ./preprocess_font.sh src_fonts/NotoSansKR/${i} NotoSansKR
   status=$?
   # Put a blank line between the results.
   echo
   if [ $status -ne 0 ]; then
     echo preprocessing src_fonts/NotoSansKR/${i} failed, exiting ...
     exit $status
   fi
done
echo "all done"
