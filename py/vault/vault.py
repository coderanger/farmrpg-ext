from __future__ import annotations

import random
from enum import Enum

import attrs
import structlog


@attrs.define
class Code:
    a: int
    b: int
    c: int
    d: int

    @classmethod
    def from_number(cls, n: int) -> Code:
        return cls(
            a=(n // 1000) % 10,
            b=(n // 100) % 10,
            c=(n // 10) % 10,
            d=n % 10,
        )


class GuessResult(Enum):
    NONE = 1
    CORRECT = 2
    WRONG_PLACE = 3


@attrs.define
class Guess:
    n: Code
    a: GuessResult = GuessResult.NONE
    b: GuessResult = GuessResult.NONE
    c: GuessResult = GuessResult.NONE
    d: GuessResult = GuessResult.NONE

    def score(self, goal: Code):
        # This code is messy and can probably be better.
        digits = {goal.a, goal.b, goal.c, goal.d}
        # Check first digit.
        if self.n.a == goal.a:
            self.a = GuessResult.CORRECT
        elif self.n.a in digits:
            self.a = GuessResult.WRONG_PLACE
        else:
            self.a = GuessResult.NONE
        # Check second digit.
        if self.n.b == goal.b:
            self.b = GuessResult.CORRECT
        elif self.n.b in digits:
            self.b = GuessResult.WRONG_PLACE
        else:
            self.b = GuessResult.NONE
        # Check third digit.
        if self.n.c == goal.c:
            self.c = GuessResult.CORRECT
        elif self.n.c in digits:
            self.c = GuessResult.WRONG_PLACE
        else:
            self.c = GuessResult.NONE
        # Check last digit.
        if self.n.d == goal.d:
            self.d = GuessResult.CORRECT
        elif self.n.d in digits:
            self.d = GuessResult.WRONG_PLACE
        else:
            self.d = GuessResult.NONE

    @property
    def success(self):
        return (
            self.a == GuessResult.CORRECT
            and self.b == GuessResult.CORRECT
            and self.c == GuessResult.CORRECT
            and self.d == GuessResult.CORRECT
        )


@attrs.define
class AI:
    a_available: set[int] = attrs.Factory(lambda: set(range(10)))
    b_available: set[int] = attrs.Factory(lambda: set(range(10)))
    c_available: set[int] = attrs.Factory(lambda: set(range(10)))
    d_available: set[int] = attrs.Factory(lambda: set(range(10)))

    known_digits: set[int] = attrs.Factory(set)
    excluded_digits: set[int] = attrs.Factory(set)

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="ai")

    def next_guess(self) -> Code:
        raise NotImplementedError

    def update(self, guess: Guess):
        # Process first digit.
        if guess.a == GuessResult.CORRECT:
            self.a_available = {guess.n.a}
            self.known_digits.add(guess.n.a)
        elif guess.a == GuessResult.WRONG_PLACE:
            self.a_available.discard(guess.n.a)
            self.known_digits.add(guess.n.a)
        else:
            self.a_available.discard(guess.n.a)
            self.b_available.discard(guess.n.a)
            self.c_available.discard(guess.n.a)
            self.d_available.discard(guess.n.a)
            self.excluded_digits.add(guess.n.a)
        # Process second digit.
        if guess.b == GuessResult.CORRECT:
            self.b_available = {guess.n.b}
            self.known_digits.add(guess.n.b)
        elif guess.b == GuessResult.WRONG_PLACE:
            self.b_available.discard(guess.n.b)
            self.known_digits.add(guess.n.b)
        else:
            self.a_available.discard(guess.n.b)
            self.b_available.discard(guess.n.b)
            self.c_available.discard(guess.n.b)
            self.d_available.discard(guess.n.b)
            self.excluded_digits.add(guess.n.b)
        # Process third digit.
        if guess.c == GuessResult.CORRECT:
            self.c_available = {guess.n.c}
            self.known_digits.add(guess.n.c)
        elif guess.c == GuessResult.WRONG_PLACE:
            self.c_available.discard(guess.n.c)
            self.known_digits.add(guess.n.c)
        else:
            self.a_available.discard(guess.n.c)
            self.b_available.discard(guess.n.c)
            self.c_available.discard(guess.n.c)
            self.d_available.discard(guess.n.c)
            self.excluded_digits.add(guess.n.c)
        # Process last digit.
        if guess.d == GuessResult.CORRECT:
            self.d_available = {guess.n.d}
            self.known_digits.add(guess.n.d)
        elif guess.d == GuessResult.WRONG_PLACE:
            self.d_available.discard(guess.n.d)
            self.known_digits.add(guess.n.d)
        else:
            self.a_available.discard(guess.n.d)
            self.b_available.discard(guess.n.d)
            self.c_available.discard(guess.n.d)
            self.d_available.discard(guess.n.d)
            self.excluded_digits.add(guess.n.d)
        self.log.debug(
            "Updating from guess",
            guess=guess,
            a=self.a_available,
            b=self.b_available,
            c=self.c_available,
            d=self.d_available,
            digits=self.known_digits,
        )


class AIOne(AI):
    def next_guess(self) -> Code:
        return Code(
            a=self.a_available.copy().pop(),
            b=self.b_available.copy().pop(),
            c=self.c_available.copy().pop(),
            d=self.d_available.copy().pop(),
        )


class AITwo(AIOne):
    def next_guess(self) -> Code:
        # The simplest case.
        if (
            len(self.a_available) == 1
            and len(self.b_available) == 1
            and len(self.c_available) == 1
            and len(self.d_available) == 1
        ):
            return Code(
                a=list(self.a_available)[0],
                b=list(self.b_available)[0],
                c=list(self.c_available)[0],
                d=list(self.d_available)[0],
            )
        return super().next_guess()


class AIThree(AI):
    def next_guess(self) -> Code:
        choices = set()
        # For the first digit, just get something available.
        a_choice = self.a_available.copy().pop()
        choices.add(a_choice)
        # Try to find values not already used if possible.

        def filter_choice(vals: set[int]) -> int:
            filtered = vals - choices
            if len(self.known_digits) >= 4:
                filtered &= self.known_digits
            if filtered:
                return random.choice(list(filtered))
            else:
                return random.choice(list(vals))

        b_choice = filter_choice(self.b_available)
        choices.add(b_choice)

        c_choice = filter_choice(self.c_available)
        choices.add(c_choice)

        d_choice = filter_choice(self.d_available)
        choices.add(d_choice)

        return Code(a=a_choice, b=b_choice, c=c_choice, d=d_choice)


@attrs.define
class Vault:
    goal: Code
    guesses: list[Guess] = attrs.Factory(list)

    log: structlog.stdlib.BoundLogger = structlog.stdlib.get_logger(mod="vault")

    @classmethod
    def random(cls) -> Vault:
        return cls(goal=Code.from_number(random.randint(0, 9999)))

    def guess(self, n: Code) -> Guess:
        self.log.debug("Got guess", guess=n)
        guess = Guess(n=n)
        guess.score(self.goal)
        self.guesses.append(guess)
        return guess

    @classmethod
    def run(cls, ai_class: type) -> int:
        vault = cls.random()
        vault.log.debug("Starting trial", goal=vault.goal)
        ai: AI = ai_class()
        for _ in range(100):
            code = ai.next_guess()
            guess = vault.guess(code)
            if guess.success:
                break
            ai.update(guess)
        return len(vault.guesses)
