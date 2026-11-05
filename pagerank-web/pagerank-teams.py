#! /usr/bin/python3

# Fall '26
# Brent Reeves
# Student Team preference -> pagerank -> teams
#
import networkx as nx
import csv
import sys
import argparse

# csv has preferences for each person:
# name1, first-choice, 2nd-choice... 6th-choice
# name2...
def read_csv_from_stdin():
    # sys.stdin behaves like an open file object
    rows = []
    reader = csv.reader(sys.stdin)
    for row in reader:
        rows.append(row)
    return rows

# in: preferences array
# out: weighted tuples (name1, name2, weight)
def tuples(array_2d, in_weights):
    tuples = []
    for row in array_2d:
        tuples.extend((row[0], item, in_weights[index]) for index, item in enumerate(row[1:7]))
    return tuples

# pretty print preferences
def pp_rows(edges):
    print("Edges start")
    for edge in edges:
        print(edge)
    print("Edges end\n")

# in: weighted tuples
# out: names sorted by pagerank
def ranked(in_weighted_edges):
    G = nx.DiGraph()
    G.add_weighted_edges_from(in_weighted_edges)
    pagerank_scores = nx.pagerank(G, alpha=0.85)
    sorted_pagerank = sorted(pagerank_scores.items(), key=lambda item: item[1], reverse=True)
    return sorted_pagerank

# Todo: handle case where person gets none of their prefs
# 
def preference_teams(preference_rows, ranklist, team_size=3):
    preferences = {row[0]: row[1:] for row in preference_rows}
    assigned = set()
    result = []

    for ranked_item in ranklist:
        name = ranked_item[0] if isinstance(ranked_item, tuple) else ranked_item
        if name in assigned or name not in preferences:
            continue

        team = [name]
        assigned.add(name)
        for choice in preferences[name]:
            if choice not in assigned:
                team.append(choice)
                assigned.add(choice)
            if len(team) == team_size:
                break

        if len(team) == team_size:
            result.append(team)
        else:
            assigned.difference_update(team)

    return result

def final_report(in_sorted, in_weights, in_title='Preferences'):
    print(f"{in_title} Pagerank\n(weights {in_weights})")
    for node, score in in_sorted:
        print(f"{score:.4f} {node}")

def teams(sorted_list, team_size):
    teams = []
    for i in range(0, len(sorted_list), team_size):
        teams.append(sorted_list[i:i + team_size])
    return teams

# --------------------------------------------------------------------------------------

def main(argv):
    # in_weights = [6, 5, 4, 3, 2, 1]   # linear
    # in_weights = [21, 13, 8, 5, 3, 2] # reverse Fibonacci start 21
    in_weights = [13, 8, 5, 3, 2, 1]  # reverse Fibonacci start 18
    in_title = '' 
    in_size = 3

    parser = argparse.ArgumentParser()
    parser.add_argument("-s", "--size", type=int, help="Size of Teams", default=3)
    parser.add_argument("-w", "--weights", help="comma-separated list of weights", default="[13,8,5,3,2,1]")
    parser.add_argument("-t", "--title",  help="Class title", default="Preferences")

    args = parser.parse_args()

    if args.weights:
        weights = eval(args.weights)

    if args.title:
        in_title = args.title

    if args.size:
        in_size = args.size

    rows = read_csv_from_stdin()
    pp_rows(rows)
    weighted_edges = tuples(rows, weights)
    ranklist = ranked(weighted_edges)
    # print(ranklist)

    final_report(ranklist   , weights, in_title )

    print("\nPagerank Teams")
    for team in preference_teams(rows, ranklist, in_size):
        print(team)


if __name__ == "__main__":
    main(sys.argv[1:])
