import random

from .base import AI


class SteakAI(AI):
    """Base class for steak AI experiments."""

    def _buy_steaks(self, price: int) -> bool:
        return False

    def _sell_steaks(self, price: int) -> bool:
        return not self._buy_steaks(price)

    def _buy_kabobs(self, price: int) -> bool:
        return False

    def _sell_kabobs(self, price: int) -> bool:
        return not self._buy_kabobs(price)

    def process(self) -> None:
        market = self.game.steak_market
        player = self.game.player

        if self._buy_steaks(market.steak_price):
            market.buy_steaks(player)
        elif self._sell_steaks(market.steak_price):
            market.sell_steaks(player)

        if self._buy_kabobs(market.kabob_price):
            market.buy_kabobs(player)
        elif self._sell_kabobs(market.kabob_price):
            market.sell_kabobs(player)

    def finish(self) -> None:
        market = self.game.steak_market
        player = self.game.player
        market.sell_steaks(player)
        market.sell_kabobs(player)


class SimpleSteakAI(SteakAI):
    """The simplest behavior, sell over average, buy below."""

    def _buy_steaks(self, price: int) -> bool:
        return price < 50_000

    def _buy_kabobs(self, price: int) -> bool:
        return price < 10_000


class ThresholdSteakAI(SteakAI):
    """Buy and sell thresholds."""

    # BUY_STEAK = 40_000
    # SELL_STEAK = 55_000
    # BUY_KABOB = 9_900
    # SELL_KABOB = 10_100

    BUY_STEAK = 30_000
    SELL_STEAK = 60_000
    BUY_KABOB = 9_600
    SELL_KABOB = 10_250

    def _buy_steaks(self, price: int) -> bool:
        return price <= self.BUY_STEAK

    def _sell_steaks(self, price: int) -> bool:
        return price >= self.SELL_STEAK

    def _buy_kabobs(self, price: int) -> bool:
        return price <= self.BUY_KABOB

    def _sell_kabobs(self, price: int) -> bool:
        return price >= self.SELL_KABOB


class SleepySteakAI(ThresholdSteakAI):
    """ "Like Threshold but it has to work and sleep."""

    WORK_HOURS = range(9, 17)
    SLEEP_HOURS = range(0, 8)

    def _is_playing(self) -> bool:
        hour = self.game.time.hour
        if hour in self.SLEEP_HOURS:
            return False
        if hour in self.WORK_HOURS:
            # 50% chance to be blocked until the next hour.
            work_blocked = getattr(self, "work_blocked", None)
            if hour == work_blocked:
                return False
            if random.random() < 0.5:
                self.work_blocked = hour
                return False
            else:
                self.work_blocked = None
                return True
        return True

    def _buy_steaks(self, price: int) -> bool:
        if self._is_playing():
            return super()._buy_steaks(price)
        return False

    def _sell_steaks(self, price: int) -> bool:
        if self._is_playing():
            return super()._sell_steaks(price)
        return False

    def _buy_kabobs(self, price: int) -> bool:
        if self._is_playing():
            return super()._buy_kabobs(price)
        return False

    def _sell_kabobs(self, price: int) -> bool:
        if self._is_playing():
            return super()._sell_kabobs(price)
        return False
