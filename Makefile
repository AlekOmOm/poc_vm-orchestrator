

.PHONY: help
help:
	@echo "DevOps Cockpit POC - Available Commands:"
	@echo "  make setup       - Build Docker container and install all dependencies"
	@echo "  make dev         - Start all services (Postgres, Backend, Frontend)"
	@echo "  make stop        - Stop all services"
	@echo "  make clean       - Remove all generated files and Docker volumes"
	@echo "  make db-init     - (Re)Initialize the database schema"

DB_CONTAINER_NAME=vm_orchestrator_poc_db

.PHONY: setup
setup:
	@docker-compose up -d postgres
	@echo "📦 Installing backend dependencies..."
	@npm install
	@echo "📦 Installing frontend dependencies..."
	@cd frontend && npm install --legacy-peer-deps
	@make db-init

.PHONY: db-init
db-init:
	@echo "⏳ Waiting for database to be ready..."
	@while ! docker exec $(DB_CONTAINER_NAME) pg_isready -U user -d vm_orchestrator_poc; do sleep 1; done
	@echo "🗄️  Initializing database schema..."
	@docker exec -i $(DB_CONTAINER_NAME) psql -U user -d vm_orchestrator_poc < db/database.sql
	@echo "✅ Database initialized"

.PHONY: dev
dev:
	@echo "🚀 Starting all services..."
	@docker-compose up -d postgres
	@npm run --prefix frontend dev & node src/server.js

.PHONY: stop
stop:
	@echo "🛑 Stopping all services..."
	@docker-compose down

.PHONY: clean
clean: stop
	@echo "🧹 Cleaning up..."
	@rm -rf node_modules frontend/node_modules frontend/dist
	@docker-compose down -v --remove-orphans
	@echo "✅ Cleanup complete"