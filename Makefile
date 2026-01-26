# StepFever Makefile
# Usage: make clean | make build | make deploy

.PHONY: all clean build deploy dev test lint typecheck install preview help

# Default target
all: build

# Install dependencies
install:
	bun install

# Development server
dev: install
	bun dev

# Run all tests (unit + fuzz)
test:
	bun test

# Run E2E tests
test-e2e:
	bun test:e2e

# Lint with Biome
lint:
	bun run lint

# Fix lint issues
lint-fix:
	bun run lint:fix

# TypeScript type checking
typecheck:
	bun run typecheck

# Full production build (install + typecheck + lint + build)
build: install
	bun run typecheck
	bun run lint
	bun run build

# Quick build (skip checks)
build-quick: install
	bun run build

# Preview production build locally
preview:
	bun run --filter=@stepfever/web preview

# Clean all build artifacts and caches
clean:
	@echo "Cleaning build artifacts..."
	rm -rf node_modules
	rm -rf packages/*/node_modules
	rm -rf packages/*/dist
	rm -rf packages/web/src/generated/songs.json
	rm -rf .turbo
	rm -rf packages/*/.turbo
	rm -rf packages/web/.vite
	rm -rf playwright-report
	rm -rf test-results
	@echo "Clean complete."

# Clean only build outputs (keep node_modules)
clean-dist:
	@echo "Cleaning dist folders..."
	rm -rf packages/*/dist
	rm -rf packages/web/src/generated/songs.json
	rm -rf .turbo
	rm -rf packages/*/.turbo
	@echo "Dist clean complete."

# Deploy to Vercel (production)
deploy: build
	@echo "Deploying to Vercel..."
	npx vercel --prod

# Deploy preview to Vercel
deploy-preview: build
	@echo "Deploying preview to Vercel..."
	npx vercel

# Help
help:
	@echo "StepFever Makefile Commands:"
	@echo ""
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Full production build (typecheck + lint + build)"
	@echo "  make build-quick  - Quick build (skip checks)"
	@echo "  make clean        - Remove all build artifacts and node_modules"
	@echo "  make clean-dist   - Remove only dist folders (keep node_modules)"
	@echo "  make deploy       - Deploy to Vercel (production)"
	@echo "  make deploy-preview - Deploy preview to Vercel"
	@echo "  make test         - Run unit tests"
	@echo "  make test-e2e     - Run E2E tests"
	@echo "  make lint         - Run linter"
	@echo "  make lint-fix     - Fix lint issues"
	@echo "  make typecheck    - Run TypeScript type check"
	@echo "  make preview      - Preview production build locally"
	@echo "  make help         - Show this help"
