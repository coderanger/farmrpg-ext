from simulator.utils import format_number, parse_time


def test_format_number():
    assert format_number(1) == "1.00"
    assert format_number(1.0) == "1.00"
    assert format_number(1.5) == "1.50"
    assert format_number(1000) == "1000.00"
    assert format_number(5000) == "5.00k"
    assert format_number(7_500_000) == "7.50M"
    assert format_number(7_500_000, precision=0) == "8M"
    assert format_number(7_500_000, precision=1) == "7.5M"


def test_parse_time():
    assert parse_time("1d", 60) == 1440
    assert parse_time("5.5d", 60) == 7920
    assert parse_time("5d12h", 60) == 7920
    assert parse_time("5d 12h", 60) == 7920
    assert parse_time("1.1h", 1) == 3960
