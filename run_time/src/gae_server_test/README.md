prerequisites:
- webtest installed from http://webtest.readthedocs.org/en/latest/
- webapp2 installed

To run server tests:

cd into the directory above this one and test_all in this directory; eg,

- cd into the run_time/src folder
- with ./gae_server_test/test_all command run all test

Running shaped 3G/4G Network tests


-Install trickle, 'sudo apt-get install trickle'
-Run trickle to see all commandline options
-Before issuing command make sure google-chrome is closed
-Use 'trickle -u <upload_rate_in_KBps> -d <download_rate_in_KBps> -L <latency_in_ms> google-chrome'
  e.g. to test on 3G connection 'trickle -u 96 -d 205 -L 150 google-chrome'
-Enter the website on this google-chrome

