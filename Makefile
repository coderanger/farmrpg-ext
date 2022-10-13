build:
	zip -r -FS dist/farmrpg-ext.zip * --exclude '*.git*' --exclude dist/ --exclude 'py/**' --exclude 'wiki/**' --exclude 'docs/**' --exclude '**/.DS_Store' --exclude 'tools/'
