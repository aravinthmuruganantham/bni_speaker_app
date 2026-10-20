# Developer shortcuts for the BNI speaker timer.
# One Node process (dev-server.js) serves both the frontend (public/) and the API (api/),
# so `make dev` starts everything on a single port.

# Pick up optional local settings (ADMIN_PIN, Upstash keys, PORT); skipped when .env is absent.
-include .env

# Uncommon port so it does not clash with other local projects; override: make dev PORT=5000
PORT ?= 4817
export

.DEFAULT_GOAL := help
.PHONY: help dev

# List the available targets.
help:
	@echo "make dev   start the app (frontend + API) on http://localhost:$(PORT)"

# Start the dev server, after checking that Node is new enough (package.json requires >= 20).
dev:
	@command -v node >/dev/null 2>&1 || { echo "Error: node is not installed"; exit 1; }
	@node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" || { echo "Error: Node 20 or newer is required"; exit 1; }
	@echo "Display: http://localhost:$(PORT)/display"
	@echo "Remote:  http://localhost:$(PORT)/remote"
	@echo "Lineup:  http://localhost:$(PORT)/lineup"
	@node dev-server.js
