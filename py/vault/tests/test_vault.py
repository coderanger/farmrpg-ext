from vault.vault import AI, Code, Guess, GuessResult, Vault


def test_code_from_number():
    code = Code.from_number(1234)
    assert code.a == 1
    assert code.b == 2
    assert code.c == 3
    assert code.d == 4


def test_code_from_number_leading_zero():
    code = Code.from_number(987)
    assert code.a == 0
    assert code.b == 9
    assert code.c == 8
    assert code.d == 7


def test_guess_score_no_match():
    guess = Guess(n=Code(a=0, b=0, c=0, d=0))
    guess.score(Code(a=1, b=1, c=1, d=1))
    assert guess.a == GuessResult.NONE
    assert guess.b == GuessResult.NONE
    assert guess.c == GuessResult.NONE
    assert guess.d == GuessResult.NONE


def test_guess_score_match():
    guess = Guess(n=Code(a=1, b=2, c=3, d=4))
    guess.score(Code(a=1, b=2, c=3, d=4))
    assert guess.a == GuessResult.CORRECT
    assert guess.b == GuessResult.CORRECT
    assert guess.c == GuessResult.CORRECT
    assert guess.d == GuessResult.CORRECT


def test_guess_score_partial():
    guess = Guess(n=Code(a=1, b=5, c=5, d=9))
    guess.score(Code(a=0, b=9, c=5, d=4))
    assert guess.a == GuessResult.NONE
    assert guess.b == GuessResult.WRONG_PLACE
    assert guess.c == GuessResult.CORRECT
    assert guess.d == GuessResult.WRONG_PLACE


def test_ai_update():
    ai = AI()
    ai.update(
        Guess(
            n=Code(a=1, b=2, c=3, d=4),
            a=GuessResult.CORRECT,
            b=GuessResult.NONE,
            c=GuessResult.WRONG_PLACE,
            d=GuessResult.CORRECT,
        )
    )
    assert ai.a_available == {1}
    assert ai.b_available == {0, 1, 3, 4, 5, 6, 7, 8, 9}
    assert ai.c_available == {0, 1, 4, 5, 6, 7, 8, 9}
    assert ai.d_available == {4}
    assert ai.known_digits == {1, 3, 4}
