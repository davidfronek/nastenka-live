param(
  [Parameter(Mandatory = $false)]
  [string]$CsvPath = ".\data\users.import.template.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $CsvPath)) {
  Write-Error "CSV file not found: $CsvPath"
}

npm run users:import --prefix . -- $CsvPath
