from .ai import SillyAI
from .game import Game
from .items import Item

if __name__ == "__main__":
    game = Game(ai_class=SillyAI)
    game.player.silver = 1000
    game.run(60 * 24)
    game.player.silver -= 1000
    print(game.summary())
