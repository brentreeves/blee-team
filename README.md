# The Blee Team 

Three ways to make teams from a list of preferences that looks like so:

name1,choice1,choice2,choice3,choice4,choice5,choice6  
name2,choice1,choice2,choice3,choice4,choice5,choice6
...

See prefs.txt file as an example.

Each algorithm is implemented by a stand-alone html file which has no server connections, doesn't call home.

To use, drag and drop the prefs file onto an html file.

## genetic

Switch 2 random team members and see if the happiness increases.  Repeat a zillion times to achieve a... local maximum!

## Gayle-Shapley

The most-requested folks get to be team-captains and choose their team-members, one at a time.

## pagerank-web

Pretend that the preference list is a web of html pages.

Rank order them and then let the highest ranked players get their preferences.
