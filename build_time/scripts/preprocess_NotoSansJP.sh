#!/bin/bash

declare -a fonts=(
  NotoSansJP-Thin.otf
  NotoSansJP-Light.otf
  NotoSansJP-DemiLight.otf
  NotoSansJP-Regular.otf
  NotoSansJP-Medium.otf
  NotoSansJP-Bold.otf
  NotoSansJP-Black.otf
)

for i in "${fonts[@]}"
do
   ./preprocess_font.sh src_fonts/NotoSansJP/${i}
   status=$?
   # Put a blank line between the results.
   echo
   if [ $status -ne 0 ]; then
     echo preprocessing src_fonts/NotoSansJP/${i} failed, exiting ...
     exit $status
   fi
done
echo "all done"
