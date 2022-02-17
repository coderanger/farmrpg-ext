from .base import AI
from .fisher import FisherAI
from .silly import SillyAI
from .steak import SimpleSteakAI, SleepySteakAI, ThresholdSteakAI

AIS: dict[str, type] = {
    "silly": SillyAI,
    "fisher": FisherAI,
    "simple_steak": SimpleSteakAI,
    "threshold_steak": ThresholdSteakAI,
    "sleepy_steak": SleepySteakAI,
}


def get_ai(name: str) -> type:
    return AIS[name]
