test:
	python -m pytest --cov=simulator --cov=vault --cov-report=html simulator vault

run:
	python -m simulator fisher baseline
	python -m simulator fisher low
	python -m simulator fisher mid
	python -m simulator fisher high

steak:
	docker run -it --rm -v ${PWD}:/app/out -e DISCORD_TOKEN tyrrrz/discordchatexporter:stable export -c ${DISCORD_STEAK_CHANNEL_ID} --format json -o /app/out/steak_prices.json
