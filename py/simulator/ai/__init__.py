from .base import AI
from .fisher import FisherAI
from .silly import SillyAI

AIS: dict[str, type] = {
    "silly": SillyAI,
    "fisher": FisherAI,
}


def get_ai(name: str) -> type:
    return AIS[name]
