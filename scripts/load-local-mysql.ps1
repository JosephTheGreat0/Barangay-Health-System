param(
  [string]$MysqlUser = "root",
  [string]$MysqlPassword = "",
  [string]$MysqlHost = "localhost",
  [int]$MysqlPort = 3306,
  [string]$MysqlBinPath = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sqlPath = Join-Path $root "mysql-init\init.sql"

function Find-MySqlClient {
  param([string]$ExplicitPath)

  if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
    return (Resolve-Path $ExplicitPath).Path
  }

  $fromPath = Get-Command mysql -ErrorAction SilentlyContinue
  if ($fromPath) {
    return $fromPath.Source
  }

  $candidates = @(
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 26.7\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Workbench 8.0\mysql.exe",
    "C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "mysql.exe was not found. Pass -MysqlBinPath with the full path to mysql.exe."
}

if (-not $MysqlPassword) {
  $MysqlPassword = Read-Host "MySQL password for $MysqlUser"
}

$mysql = Find-MySqlClient $MysqlBinPath
Write-Host "Using MySQL client: $mysql"
Write-Host "Loading schema from: $sqlPath"

Get-Content -Raw -LiteralPath $sqlPath | & $mysql "--host=$MysqlHost" "--port=$MysqlPort" "--user=$MysqlUser" "-p$MysqlPassword"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Local MySQL databases and tables are ready."
