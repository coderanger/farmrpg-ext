import logging
import statistics

import structlog
import typer

from .vault import AIOne, AIThree, AITwo, Vault

AIS = {
    "one": AIOne,
    "two": AITwo,
    "three": AIThree,
}


def vault(ai: str, verbose: bool = False, trials: int = 1000):
    if not verbose:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO)
        )
    log = structlog.get_logger(mod="main")
    log.info("Running trials", trials=trials, ai=ai)
    results = [Vault.run(AIS[ai]) for _ in range(trials)]
    print(f"Mean: {statistics.mean(results)} ({statistics.stdev(results)})")
    quartiles = statistics.quantiles(results)
    print(f"Median: {statistics.median(results)} ({quartiles[0]}-{quartiles[-1]})")


if __name__ == "__main__":
    typer.run(vault)
