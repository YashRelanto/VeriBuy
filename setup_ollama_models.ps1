# VeriBuy — Ollama Model Setup Script
# Pulls qwen3:0.6b into the Ollama container

Write-Host "`n=== VeriBuy Ollama Setup ===" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start ollama container
Write-Host "`nStarting Ollama container..." -ForegroundColor Yellow
docker compose up -d ollama

# Wait for container to be ready
Write-Host "Waiting for Ollama to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Pull the model
Write-Host "`nPulling qwen3:0.6b model (this may take a while depending on your connection)..." -ForegroundColor Yellow
docker exec veribuy-ollama ollama pull qwen3:0.6b

Write-Host "`n✅ Setup complete! qwen3:0.6b is ready." -ForegroundColor Green
Write-Host "Run the backend with: cd backend && uvicorn app.main:app --reload" -ForegroundColor Cyan
