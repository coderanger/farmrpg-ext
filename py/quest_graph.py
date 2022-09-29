import typer

import fixtures


def quest_graph_cmd():
    quests = {q.id: q for q in fixtures.load_quests()}
    # print("flowchart TD")
    print(
        """
digraph mygraph {
  fontname="Helvetica,Arial,sans-serif"
  node [fontname="Helvetica,Arial,sans-serif"]
  edge [fontname="Helvetica,Arial,sans-serif"]
  node [shape=box];
"""
    )
    for q in quests.values():
        if "99 Bottles" in q.name:
            continue
        if q.prereq:
            # print(f"  Q{q.prereq}[{quests[q.prereq].name}] --> Q{q.id}[{q.name}]")
            print(f'  "{quests[q.prereq].name}" -> "{q.name}"')
    print("}")


if __name__ == "__main__":
    typer.run(quest_graph_cmd)
